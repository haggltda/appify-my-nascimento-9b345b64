-- Planejamento Orçamentário (Financeiro) — orçamento do escritório
-- administrativo, versionado por Classificação (conta_contabil) + Detalhe.
-- Independente do orçamento por contrato (orcamento_ciclo/orcamento_contrato/
-- orcamento_contrato_linha, módulo Controladoria & Orçamento) — não mexe lá.
--
-- Status (Na Vigência / Vão entrar em vigência / Histórico) NUNCA é gravado
-- em coluna — é sempre calculado no frontend a partir de inicio_vigencia/
-- fim_vigencia comparadas com a data de hoje. Isso evita depender de cron
-- pra "virar o status" quando uma vigência futura começa.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.planejamento_orcamentario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_contabil_id uuid NOT NULL REFERENCES public.conta_contabil(id),
  detalhe text NOT NULL,
  detalhe_key text GENERATED ALWAYS AS (lower(btrim(detalhe))) STORED,
  inicio_vigencia date NOT NULL,
  fim_vigencia date NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT po_fim_apos_inicio CHECK (fim_vigencia > inicio_vigencia),
  -- Range fim-exclusivo '[)' de propósito: reproduz o mockup, onde o
  -- registro anterior termina no MESMO DIA em que o novo começa, sem violar
  -- a constraint de não-sobreposição.
  CONSTRAINT po_sem_sobreposicao EXCLUDE USING gist (
    empresa_id WITH =,
    conta_contabil_id WITH =,
    detalhe_key WITH =,
    daterange(inicio_vigencia, fim_vigencia, '[)') WITH &&
  )
);

CREATE INDEX idx_po_empresa ON public.planejamento_orcamentario(empresa_id);
CREATE INDEX idx_po_conta ON public.planejamento_orcamentario(conta_contabil_id);
CREATE INDEX idx_po_vigencia ON public.planejamento_orcamentario(inicio_vigencia, fim_vigencia);

CREATE TRIGGER po_set_updated BEFORE UPDATE ON public.planejamento_orcamentario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defesa em profundidade: mesmo que alguém tente um UPDATE direto (fora das
-- RPCs), um registro que já virou Histórico não pode ser alterado, exceto
-- por admin/controladoria (ex: correção excepcional).
CREATE OR REPLACE FUNCTION public.planejamento_orcamentario_guard_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.fim_vigencia <= CURRENT_DATE
     AND NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria')) THEN
    RAISE EXCEPTION 'Orçamento em Histórico não pode ser alterado.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER po_guard_historico_trg BEFORE UPDATE ON public.planejamento_orcamentario
  FOR EACH ROW EXECUTE FUNCTION public.planejamento_orcamentario_guard_historico();

ALTER TABLE public.planejamento_orcamentario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_orc_select" ON public.planejamento_orcamentario FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "po_orc_insert" ON public.planejamento_orcamentario FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'diretor_adm'))
    AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );

CREATE POLICY "po_orc_update" ON public.planejamento_orcamentario FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'diretor_adm'))
    AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid()))
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'diretor_adm'))
    AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid()))
  );

-- Nenhuma policy de DELETE é criada de propósito: com RLS habilitada e sem
-- policy de DELETE, a exclusão fica bloqueada no banco pra todo mundo,
-- inclusive via API direta — é a forma real de garantir "nunca excluir um
-- orçamento", não só esconder o botão no frontend.

-- ============================================================================
-- RPCs
-- ============================================================================

-- Sempre cria uma NOVA VERSÃO (botão "+ Novo Orçamento"). Cobre os dois
-- cenários do mockup (início hoje/passado vs início futuro) com a mesma
-- lógica: acha a versão "Na Vigência" atual (se existir) e encerra seu
-- fim_vigencia na data de início da nova; insere a nova versão.
CREATE OR REPLACE FUNCTION public.salvar_planejamento_orcamentario(
  _empresa_id uuid,
  _conta_contabil_id uuid,
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

  -- Trava as versões existentes desta Classificação+Detalhe pra evitar
  -- corrida entre dois salvamentos simultâneos.
  PERFORM 1 FROM public.planejamento_orcamentario
   WHERE empresa_id = _empresa_id AND conta_contabil_id = _conta_contabil_id AND detalhe_key = v_key
   FOR UPDATE;

  -- Regra: no máximo UMA versão "Entrará em Vigência" por Classificação+
  -- Detalhe. Checagem explícita em vez de tentar encadear automaticamente —
  -- evita criar um registro "fantasma" que ficaria com cobertura errada.
  SELECT * INTO v_futura FROM public.planejamento_orcamentario
   WHERE empresa_id = _empresa_id AND conta_contabil_id = _conta_contabil_id AND detalhe_key = v_key
     AND inicio_vigencia > CURRENT_DATE
   ORDER BY inicio_vigencia LIMIT 1;

  IF v_futura.id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe uma versão programada para iniciar em %. Edite-a ou aguarde essa vigência começar antes de cadastrar uma nova.',
      to_char(v_futura.inicio_vigencia, 'DD/MM/YYYY');
  END IF;

  -- Versão "Na Vigência" atual, que cede espaço para a nova.
  SELECT * INTO v_atual FROM public.planejamento_orcamentario
   WHERE empresa_id = _empresa_id AND conta_contabil_id = _conta_contabil_id AND detalhe_key = v_key
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
      (empresa_id, conta_contabil_id, detalhe, inicio_vigencia, fim_vigencia, valor, created_by, updated_by)
    VALUES (_empresa_id, _conta_contabil_id, btrim(_detalhe), _inicio, _fim, _valor, auth.uid(), auth.uid())
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Já existe um orçamento cadastrado com período conflitante para esta Classificação/Detalhe.';
  END;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_planejamento_orcamentario(uuid, uuid, text, date, date, numeric) TO authenticated;

-- Corrige um registro EXISTENTE sem versionar (ícone de lápis na tabela) —
-- ex: valor digitado errado. Não recebe conta_contabil_id de propósito: no
-- v1, editar não permite trocar a Classificação (pra isso, cadastra nova
-- versão). Não permite editar um registro que já virou Histórico.
CREATE OR REPLACE FUNCTION public.editar_planejamento_orcamentario(
  _id uuid,
  _detalhe text,
  _inicio date,
  _fim date,
  _valor numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT * INTO v_row FROM public.planejamento_orcamentario WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;
  IF v_row.fim_vigencia <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível editar um orçamento que já está em Histórico. Cadastre uma nova versão.';
  END IF;
  IF _fim <= _inicio THEN
    RAISE EXCEPTION 'O fim da vigência deve ser posterior ao início.';
  END IF;
  IF lower(btrim(_detalhe)) = '' THEN
    RAISE EXCEPTION 'Informe o Detalhe do orçamento.';
  END IF;

  BEGIN
    UPDATE public.planejamento_orcamentario
       SET detalhe = btrim(_detalhe), inicio_vigencia = _inicio, fim_vigencia = _fim,
           valor = _valor, updated_by = auth.uid()
     WHERE id = _id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'O período informado conflita com outra versão já cadastrada para esta Classificação/Detalhe.';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_planejamento_orcamentario(uuid, text, date, date, numeric) TO authenticated;
