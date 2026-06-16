ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'nf_entrada_estoque';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'nf_entrada_consumo_contrato';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'nf_entrada_servico_admin';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'pagamento_folha';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'recolhimento_encargos_folha';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'mutuo_intercompany_saida';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'mutuo_intercompany_entrada';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'rateio_admin_intercompany';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'baixa_estoque_contrato';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'provisao_irpj_csll';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'provisao_ferias_13';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'retencao_faturamento';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'imposto_recuperavel';
ALTER TYPE public.regra_evento ADD VALUE IF NOT EXISTS 'imposto_nao_recuperavel';

ALTER TABLE public.regra_contabilizacao
  ADD COLUMN IF NOT EXISTS exige_contrato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_centro_custo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entra_dre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requer_3way_match boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requer_pedido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gatilho text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS codigo_evento text;

CREATE INDEX IF NOT EXISTS idx_regra_contab_codigo_evento
  ON public.regra_contabilizacao(empresa_id, codigo_evento);

CREATE TABLE IF NOT EXISTS public.parametro_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  regime_tributario text NOT NULL CHECK (regime_tributario IN ('lucro_real','lucro_presumido','simples_nacional','mei','imune','isento')),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  municipio_prestacao text,
  municipio_tomador text,
  regra_iss jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_pis jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_cofins jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_irpj_csll jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_retencao_inss jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_retencao_irrf_csrf jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_folha_cpp_rat_terceiros jsonb NOT NULL DEFAULT '{}'::jsonb,
  creditavel_pis_cofins boolean NOT NULL DEFAULT false,
  conta_contabil_padrao_imposto_id uuid REFERENCES public.conta_contabil(id),
  centro_custo_padrao_id uuid REFERENCES public.centros_custo(id),
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT chk_vigencia_fim CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE INDEX IF NOT EXISTS idx_parametro_fiscal_empresa ON public.parametro_fiscal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_parametro_fiscal_vigencia ON public.parametro_fiscal(empresa_id, vigencia_inicio DESC);

DROP TRIGGER IF EXISTS trg_parametro_fiscal_updated_at ON public.parametro_fiscal;
CREATE TRIGGER trg_parametro_fiscal_updated_at
  BEFORE UPDATE ON public.parametro_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.parametro_fiscal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "param_fiscal_select" ON public.parametro_fiscal;
CREATE POLICY "param_fiscal_select" ON public.parametro_fiscal
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR (empresa_id = get_user_empresa(auth.uid())
        AND (has_role(auth.uid(),'controladoria')
          OR has_role(auth.uid(),'fiscal')
          OR has_role(auth.uid(),'financeiro')
          OR has_role(auth.uid(),'diretor_adm')))
  );

DROP POLICY IF EXISTS "param_fiscal_insert" ON public.parametro_fiscal;
CREATE POLICY "param_fiscal_insert" ON public.parametro_fiscal
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR (empresa_id = get_user_empresa(auth.uid())
        AND (has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'fiscal')))
  );

DROP POLICY IF EXISTS "param_fiscal_update" ON public.parametro_fiscal;
CREATE POLICY "param_fiscal_update" ON public.parametro_fiscal
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR (empresa_id = get_user_empresa(auth.uid())
        AND (has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'fiscal')))
  );

DROP POLICY IF EXISTS "param_fiscal_delete" ON public.parametro_fiscal;
CREATE POLICY "param_fiscal_delete" ON public.parametro_fiscal
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));