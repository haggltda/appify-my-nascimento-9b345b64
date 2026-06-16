-- ============================================
-- PACOTE 01 — Dimensões (ALTER + UPDATE + INSERT + STAGING)
-- ============================================

ALTER TABLE public.conta_contabil
  ADD COLUMN IF NOT EXISTS classe_contabil text,
  ADD COLUMN IF NOT EXISTS tipo_gerencial text,
  ADD COLUMN IF NOT EXISTS direto_indireto text,
  ADD COLUMN IF NOT EXISTS fixo_variavel text;

ALTER TABLE public.centros_custo
  ADD COLUMN IF NOT EXISTS dimensao text,
  ADD COLUMN IF NOT EXISTS categoria_gerencial text,
  ADD COLUMN IF NOT EXISTS direto_indireto text,
  ADD COLUMN IF NOT EXISTS fixo_variavel text,
  ADD COLUMN IF NOT EXISTS exige_contrato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impacta_dre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status_cadastro text NOT NULL DEFAULT 'APROVADO_ORIGEM',
  ADD COLUMN IF NOT EXISTS origem_cadastro text;

ALTER TABLE public.regra_contabilizacao
  ADD COLUMN IF NOT EXISTS impacta_caixa text;

CREATE TABLE IF NOT EXISTS public.stg_bancos_contas_detectadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_banco_conta text NOT NULL,
  nome_banco_conta text,
  empresa_codigo_detectada text,
  empresa_nome_detectada text,
  origem_detectada text,
  qtd_linhas_detectadas integer DEFAULT 0,
  tipo_conta_financeira text,
  conta_contabil_sugerida text,
  status_de_para_conta text,
  status_carga text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stg_bancos_contas_detectadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stg_bancos_contas_detectadas_admin_all" ON public.stg_bancos_contas_detectadas;
CREATE POLICY "stg_bancos_contas_detectadas_admin_all" ON public.stg_bancos_contas_detectadas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "stg_bancos_contas_detectadas_read" ON public.stg_bancos_contas_detectadas;
CREATE POLICY "stg_bancos_contas_detectadas_read" ON public.stg_bancos_contas_detectadas
  FOR SELECT TO authenticated USING (true);
