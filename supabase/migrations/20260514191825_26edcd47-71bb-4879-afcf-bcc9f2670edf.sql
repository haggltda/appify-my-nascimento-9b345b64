
-- Enum de origem
DO $$ BEGIN
  CREATE TYPE public.cc_origem AS ENUM ('manual','contrato','licitacao','rateio','corporativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill seguro de origem_cadastro para 'manual' antes de converter
UPDATE public.centros_custo
   SET origem_cadastro = 'manual'
 WHERE origem_cadastro IS NULL
    OR origem_cadastro NOT IN ('manual','contrato','licitacao','rateio','corporativo');

-- Converter coluna existente (text) para enum, preservando valores
ALTER TABLE public.centros_custo
  ALTER COLUMN origem_cadastro DROP DEFAULT;
ALTER TABLE public.centros_custo
  ALTER COLUMN origem_cadastro TYPE public.cc_origem
  USING origem_cadastro::public.cc_origem;
ALTER TABLE public.centros_custo
  ALTER COLUMN origem_cadastro SET DEFAULT 'manual'::public.cc_origem,
  ALTER COLUMN origem_cadastro SET NOT NULL;

-- Novas colunas (rastreabilidade + legado)
ALTER TABLE public.centros_custo
  ADD COLUMN IF NOT EXISTS entidade_origem_tabela text,
  ADD COLUMN IF NOT EXISTS entidade_origem_id uuid,
  ADD COLUMN IF NOT EXISTS codigo_legado boolean NOT NULL DEFAULT false;

-- Marcar todos os existentes como legado para preservar codificações antigas
UPDATE public.centros_custo SET codigo_legado = true WHERE codigo_legado = false;

-- Índice único parcial: 1 entidade origem -> 1 CC (apenas para origens automáticas)
CREATE UNIQUE INDEX IF NOT EXISTS ux_centros_custo_origem_entidade
  ON public.centros_custo (empresa_id, entidade_origem_tabela, entidade_origem_id)
  WHERE origem_cadastro <> 'manual' AND entidade_origem_id IS NOT NULL;

-- Tabela de sequência para numeração padronizada
CREATE TABLE IF NOT EXISTS public.centros_custo_sequencia (
  empresa_id uuid NOT NULL,
  tipo public.cc_tipo NOT NULL,
  origem public.cc_origem NOT NULL,
  proximo integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, tipo, origem)
);

ALTER TABLE public.centros_custo_sequencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_seq_read" ON public.centros_custo_sequencia;
CREATE POLICY "cc_seq_read" ON public.centros_custo_sequencia
  FOR SELECT USING (true);

-- Função para gerar código padronizado
CREATE OR REPLACE FUNCTION public.gerar_codigo_cc(
  _empresa_id uuid,
  _tipo public.cc_tipo,
  _origem public.cc_origem
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp text;
  v_tipo text;
  v_origem text;
  v_seq integer;
BEGIN
  SELECT codigo INTO v_emp FROM public.empresas WHERE id = _empresa_id;
  IF v_emp IS NULL THEN v_emp := 'EMP'; END IF;

  v_tipo := CASE _tipo WHEN 'adm' THEN 'AD' WHEN 'operacional' THEN 'OP' ELSE 'XX' END;
  v_origem := CASE _origem
    WHEN 'manual' THEN 'MN'
    WHEN 'contrato' THEN 'CT'
    WHEN 'licitacao' THEN 'LC'
    WHEN 'rateio' THEN 'RT'
    WHEN 'corporativo' THEN 'CP'
  END;

  INSERT INTO public.centros_custo_sequencia (empresa_id, tipo, origem, proximo)
  VALUES (_empresa_id, _tipo, _origem, 2)
  ON CONFLICT (empresa_id, tipo, origem) DO UPDATE
     SET proximo = centros_custo_sequencia.proximo + 1,
         updated_at = now()
  RETURNING proximo - 1 INTO v_seq;

  RETURN format('%s-%s-%s-%s', v_emp, v_tipo, v_origem, lpad(v_seq::text, 4, '0'));
END;
$$;

-- Trigger: sincroniza CC do contrato
CREATE OR REPLACE FUNCTION public.trg_contrato_sync_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc_id uuid;
  v_codigo text;
  v_nome text;
BEGIN
  -- Encerrado: desativa CC vinculado (se houver)
  IF NEW.status = 'encerrado' AND NEW.centro_custo_id IS NOT NULL THEN
    UPDATE public.centros_custo
       SET ativo = false, updated_at = now()
     WHERE id = NEW.centro_custo_id
       AND origem_cadastro = 'contrato';
    RETURN NEW;
  END IF;

  -- Se já tem CC, nada a fazer
  IF NEW.centro_custo_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Cria automaticamente apenas em implantação ou ativo (e empresa_id presente)
  IF NEW.status NOT IN ('implantacao','ativo') THEN
    RETURN NEW;
  END IF;

  -- Reaproveita CC existente para a mesma entidade origem (idempotência)
  SELECT id INTO v_cc_id
    FROM public.centros_custo
   WHERE empresa_id = NEW.empresa_id
     AND entidade_origem_tabela = 'contrato'
     AND entidade_origem_id = NEW.id
   LIMIT 1;

  IF v_cc_id IS NULL THEN
    v_codigo := public.gerar_codigo_cc(NEW.empresa_id, 'operacional'::public.cc_tipo, 'contrato'::public.cc_origem);
    v_nome := left(coalesce('CT ' || NEW.numero || ' - ' || NEW.objeto, 'Contrato ' || NEW.numero), 200);

    INSERT INTO public.centros_custo (
      empresa_id, codigo, nome, tipo, responsavel, ativo,
      origem_cadastro, entidade_origem_tabela, entidade_origem_id,
      exige_contrato, impacta_dre, codigo_legado
    ) VALUES (
      NEW.empresa_id, v_codigo, v_nome, 'operacional', NEW.gestor, true,
      'contrato', 'contrato', NEW.id,
      true, true, false
    )
    RETURNING id INTO v_cc_id;
  END IF;

  -- Vincula sem disparar recursão (UPDATE direto na NEW)
  NEW.centro_custo_id := v_cc_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contrato_sync_cc_biu ON public.contrato;
CREATE TRIGGER contrato_sync_cc_biu
BEFORE INSERT OR UPDATE OF status, centro_custo_id ON public.contrato
FOR EACH ROW EXECUTE FUNCTION public.trg_contrato_sync_cc();

COMMENT ON COLUMN public.centros_custo.codigo_legado IS 'true = código gerado fora do padrão {EMP}-{TIPO}-{ORIGEM}-{SEQ}; preservado para não quebrar integrações.';
