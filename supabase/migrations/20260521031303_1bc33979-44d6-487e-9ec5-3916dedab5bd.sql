
-- 1. Origem enum
DO $$ BEGIN
  CREATE TYPE public.orcamento_linha_origem AS ENUM ('contrato','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Colunas novas
ALTER TABLE public.orcamento_contrato_linha
  ADD COLUMN IF NOT EXISTS origem public.orcamento_linha_origem NOT NULL DEFAULT 'contrato',
  ADD COLUMN IF NOT EXISTS ciclo_id uuid REFERENCES public.orcamento_ciclo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_contabil_id uuid REFERENCES public.conta_contabil(id) ON DELETE SET NULL;

-- 3. Tornar contrato opcional para linhas manuais
ALTER TABLE public.orcamento_contrato_linha
  ALTER COLUMN orcamento_contrato_id DROP NOT NULL;

-- 4. Índices úteis
CREATE INDEX IF NOT EXISTS idx_ocl_ciclo ON public.orcamento_contrato_linha(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_ocl_origem ON public.orcamento_contrato_linha(origem);
CREATE INDEX IF NOT EXISTS idx_ocl_conta ON public.orcamento_contrato_linha(conta_contabil_id);
CREATE INDEX IF NOT EXISTS idx_ocl_emp_comp ON public.orcamento_contrato_linha(empresa_id, competencia);

-- 5. RLS: drop policies antigas e recriar
ALTER TABLE public.orcamento_contrato_linha ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'public.orcamento_contrato_linha'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orcamento_contrato_linha', p.polname);
  END LOOP;
END $$;

-- SELECT: quem pode atuar na empresa
CREATE POLICY ocl_select ON public.orcamento_contrato_linha
  FOR SELECT USING (public.user_pode_atuar_empresa(auth.uid(), empresa_id));

-- INSERT: presidência/controladoria/admin
CREATE POLICY ocl_insert ON public.orcamento_contrato_linha
  FOR INSERT WITH CHECK (
    public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'presidencia'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
    )
  );

-- UPDATE: idem
CREATE POLICY ocl_update ON public.orcamento_contrato_linha
  FOR UPDATE USING (
    public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'presidencia'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
    )
  );

-- DELETE: apenas linhas manuais
CREATE POLICY ocl_delete ON public.orcamento_contrato_linha
  FOR DELETE USING (
    public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND origem = 'manual'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'presidencia'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
    )
  );

-- 6. Função criar ciclo
CREATE OR REPLACE FUNCTION public.orcamento_criar_ciclo(
  p_empresa_id uuid,
  p_ano integer,
  p_nome text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.user_pode_atuar_empresa(auth.uid(), p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão na empresa';
  END IF;
  INSERT INTO public.orcamento_ciclo(empresa_id, ano, nome, status, data_inicio, data_fim)
  VALUES (p_empresa_id, p_ano, p_nome, 'rascunho', make_date(p_ano,1,1), make_date(p_ano,12,31))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 7. Função copiar ano (cria ciclo destino e duplica linhas como manuais)
CREATE OR REPLACE FUNCTION public.orcamento_copiar_ano(
  p_empresa_id uuid,
  p_ano_origem integer,
  p_ano_destino integer,
  p_reajuste_pct numeric DEFAULT 0,
  p_nome_ciclo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ciclo_id uuid;
  v_nome text;
  v_count integer;
BEGIN
  IF NOT public.user_pode_atuar_empresa(auth.uid(), p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão na empresa';
  END IF;
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'presidencia'::app_role) OR public.has_role(auth.uid(),'controladoria'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para criar orçamento';
  END IF;

  v_nome := COALESCE(p_nome_ciclo, 'OBZ '||p_ano_destino||' v1');
  v_ciclo_id := public.orcamento_criar_ciclo(p_empresa_id, p_ano_destino, v_nome);

  INSERT INTO public.orcamento_contrato_linha(
    empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id,
    competencia, valor_previsto, source, locked, memoria_calculo,
    origem, ciclo_id, conta_contabil_id
  )
  SELECT
    empresa_id,
    NULL,
    dre_linha_id,
    centro_custo_id,
    (make_date(p_ano_destino, EXTRACT(MONTH FROM competencia)::int, 1)),
    valor_previsto * (1 + COALESCE(p_reajuste_pct,0)/100.0),
    'manual'::orcamento_origem_source,
    false,
    COALESCE(memoria_calculo,'') || ' [copiado de '||p_ano_origem||']',
    'manual'::orcamento_linha_origem,
    v_ciclo_id,
    conta_contabil_id
  FROM public.orcamento_contrato_linha
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM competencia)::int = p_ano_origem;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Copiadas % linhas para ciclo %', v_count, v_ciclo_id;
  RETURN v_ciclo_id;
END $$;
