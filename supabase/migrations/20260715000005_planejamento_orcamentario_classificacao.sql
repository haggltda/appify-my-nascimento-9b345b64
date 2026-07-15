-- Catálogo de Classificações do Planejamento Orçamentário — próprio e
-- editável pelo usuário. Substitui o reaproveitamento do plano de contas
-- contábil (conta_contabil), que não reflete a realidade do orçamento
-- administrativo (decisão do Iury). Lista ÚNICA para todo o grupo,
-- compartilhada entre todas as empresas — por isso não tem empresa_id.

CREATE TABLE public.planejamento_orcamentario_classificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_key text GENERATED ALWAYS AS (lower(btrim(nome))) STORED,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (nome_key)
);

CREATE TRIGGER poc_set_updated BEFORE UPDATE ON public.planejamento_orcamentario_classificacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.planejamento_orcamentario_classificacao ENABLE ROW LEVEL SECURITY;

-- Leitura liberada pra qualquer usuário autenticado: o dropdown de
-- Classificação no cadastro de orçamento precisa funcionar pra todo mundo,
-- independente de empresa (lista é global, não filtra por empresa_id).
CREATE POLICY "poc_select" ON public.planejamento_orcamentario_classificacao FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "poc_insert" ON public.planejamento_orcamentario_classificacao FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'diretor_adm'));

CREATE POLICY "poc_update" ON public.planejamento_orcamentario_classificacao FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'diretor_adm'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'diretor_adm'));

-- Sem policy de DELETE de propósito: uma classificação referenciada por
-- orçamentos não pode sumir (a FK abaixo já bloqueia via RESTRICT); o
-- caminho certo pra "remover" é desativar via o campo "ativo".

-- Repontua planejamento_orcamentario da conta_contabil (Contábil) pro novo
-- catálogo. Tabela ainda está vazia (módulo recém-criado), então não há
-- dados pra migrar.
ALTER TABLE public.planejamento_orcamentario
  DROP CONSTRAINT po_sem_sobreposicao,
  DROP CONSTRAINT planejamento_orcamentario_conta_contabil_id_fkey,
  DROP COLUMN conta_contabil_id,
  ADD COLUMN classificacao_id uuid REFERENCES public.planejamento_orcamentario_classificacao(id);

ALTER TABLE public.planejamento_orcamentario
  ALTER COLUMN classificacao_id SET NOT NULL;

DROP INDEX IF EXISTS idx_po_conta;
CREATE INDEX idx_po_classificacao ON public.planejamento_orcamentario(classificacao_id);

ALTER TABLE public.planejamento_orcamentario
  ADD CONSTRAINT po_sem_sobreposicao EXCLUDE USING gist (
    empresa_id WITH =,
    classificacao_id WITH =,
    detalhe_key WITH =,
    daterange(inicio_vigencia, fim_vigencia, '[)') WITH &&
  );

-- Recria as RPCs com o parâmetro renomeado (_conta_contabil_id -> _classificacao_id).
DROP FUNCTION IF EXISTS public.salvar_planejamento_orcamentario(uuid, uuid, text, date, date, numeric);

CREATE OR REPLACE FUNCTION public.salvar_planejamento_orcamentario(
  _empresa_id uuid,
  _classificacao_id uuid,
  _detalhe text,
  _inicio date,
  _fim date,
  _valor numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text := lower(btrim(_detalhe));
  v_futura record;
  v_atual record;
  v_new_id uuid;
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'Informe o Detalhe do orçamento.';
  END IF;
  IF _fim <= _inicio THEN
    RAISE EXCEPTION 'O fim da vigência deve ser posterior ao início.';
  END IF;

  PERFORM 1 FROM public.planejamento_orcamentario
   WHERE empresa_id = _empresa_id AND classificacao_id = _classificacao_id AND detalhe_key = v_key
   FOR UPDATE;

  SELECT * INTO v_futura FROM public.planejamento_orcamentario
   WHERE empresa_id = _empresa_id AND classificacao_id = _classificacao_id AND detalhe_key = v_key
     AND inicio_vigencia > CURRENT_DATE
   ORDER BY inicio_vigencia LIMIT 1;

  IF v_futura.id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe uma versão programada para iniciar em %. Edite-a ou aguarde essa vigência começar antes de cadastrar uma nova.',
      to_char(v_futura.inicio_vigencia, 'DD/MM/YYYY');
  END IF;

  SELECT * INTO v_atual FROM public.planejamento_orcamentario
   WHERE empresa_id = _empresa_id AND classificacao_id = _classificacao_id AND detalhe_key = v_key
     AND inicio_vigencia <= CURRENT_DATE AND fim_vigencia > CURRENT_DATE;

  IF v_atual.id IS NOT NULL THEN
    IF _inicio <= v_atual.inicio_vigencia THEN
      RAISE EXCEPTION 'O início da nova vigência deve ser posterior a %, início da vigência atual.',
        to_char(v_atual.inicio_vigencia, 'DD/MM/YYYY');
    END IF;
    UPDATE public.planejamento_orcamentario
       SET fim_vigencia = _inicio, updated_by = auth.uid()
     WHERE id = v_atual.id;
  END IF;

  BEGIN
    INSERT INTO public.planejamento_orcamentario
      (empresa_id, classificacao_id, detalhe, inicio_vigencia, fim_vigencia, valor, created_by, updated_by)
    VALUES (_empresa_id, _classificacao_id, btrim(_detalhe), _inicio, _fim, _valor, auth.uid(), auth.uid())
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Já existe um orçamento cadastrado com período conflitante para esta Classificação/Detalhe.';
  END;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_planejamento_orcamentario(uuid, uuid, text, date, date, numeric) TO authenticated;
