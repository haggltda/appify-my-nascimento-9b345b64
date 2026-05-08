
-- ============================================
-- PACOTE 02 — STAGING TABLES (DDL only)
-- ============================================

-- 20
CREATE TABLE IF NOT EXISTS public.stg_mapa_de_para_contabil_financeiro (
  id_de_para text PRIMARY KEY,
  origem_base text,
  arquivo_origem text,
  chave_de_para text,
  tipo_movimento text,
  classificacao_original text,
  contexto_gerencial text,
  categoria_despesa_top text,
  empresas_detectadas_top text,
  centros_custo_top text,
  bancos_top text,
  qtd_linhas_afetadas integer,
  qtd_valor_valido integer,
  valor_total numeric,
  valor_abs_total numeric,
  codigo_evento_sugerido text,
  descricao_evento_sugerido text,
  conta_debito_codigo_sugerida text,
  conta_debito_nome_sugerida text,
  conta_debito_origem text,
  conta_credito_codigo_sugerida text,
  conta_credito_nome_sugerida text,
  conta_credito_origem text,
  conta_resultado_ref_codigo text,
  conta_resultado_ref_nome text,
  conta_resultado_ref_origem text,
  ids_sugestoes_contas_relacionadas text,
  tipo_gerencial text,
  direto_indireto text,
  fixo_variavel text,
  impacta_caixa text,
  impacta_dre_competencia text,
  impacta_dre_caixa text,
  impacta_balanco text,
  gera_partida_caixa text,
  gera_competencia_estimada text,
  grau_confianca text,
  status_de_para text,
  pendencia text,
  exemplos_historico text,
  observacao_migracao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 21
CREATE TABLE IF NOT EXISTS public.stg_mapa_de_para_bancos_pacote02 (
  id_de_para_banco text PRIMARY KEY,
  banco_original text,
  empresa_detectada text,
  qtd_linhas_afetadas integer,
  valor_abs_total numeric,
  origens_detectadas text,
  tipos_movimento_top text,
  classificacoes_top text,
  conta_contabil_codigo_sugerida text,
  conta_contabil_nome_sugerida text,
  origem_de_para text,
  grau_confianca text,
  status_de_para_banco text,
  id_sugestao_conta text,
  pendencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 22
CREATE TABLE IF NOT EXISTS public.stg_sugestoes_novas_contas (
  id_sugestao_conta text PRIMARY KEY,
  codigo_conta_sugerido text,
  nome_conta_sugerido text,
  codigo_conta_pai_sugerido text,
  nome_conta_pai_sugerido text,
  nivel_sugerido integer,
  classe_contabil_sugerida text,
  grupo_contabil_sugerido text,
  natureza_sugerida text,
  tipo_conta_sugerido text,
  tipo_gerencial_padrao text,
  direto_indireto_padrao text,
  fixo_variavel_padrao text,
  linha_dre_padrao text,
  impacta_dre text,
  impacta_caixa text,
  entra_orcamento text,
  motivo_sugestao text,
  origem_referencia text,
  grau_confianca text,
  qtd_lancamentos_afetados integer,
  valor_total_abs_afetado numeric,
  origens_afetadas text,
  exemplos_historico_ou_item text,
  status_aprovacao text NOT NULL DEFAULT 'AGUARDANDO_APROVACAO_USUARIO',
  decisao_usuario text,
  observacao_usuario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 23
CREATE TABLE IF NOT EXISTS public.stg_pendencias_de_para (
  id_pendencia text PRIMARY KEY,
  origem_pendencia text,
  id_referencia text,
  arquivo_origem text,
  classificacao_ou_item text,
  tipo_movimento text,
  contexto_gerencial text,
  qtd_linhas_afetadas integer,
  valor_abs_total numeric,
  tipo_pendencia text,
  descricao_pendencia text,
  id_sugestao_conta text,
  status_pendencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 24
CREATE TABLE IF NOT EXISTS public.stg_plano_contas_proposto (
  codigo_conta text PRIMARY KEY,
  conta_reduzida text,
  nome_conta text,
  codigo_conta_pai text,
  nivel integer,
  tipo_conta text,
  natureza text,
  classe_original text,
  grupo_principal_original text,
  grupo_contabil_normalizado text,
  classe_contabil_normalizada text,
  tipo_gerencial_padrao text,
  direto_indireto_padrao text,
  fixo_variavel_padrao text,
  linha_dre_padrao text,
  grupo_dre_original text,
  exige_contrato text,
  centro_custo_padrao text,
  entra_fluxo text,
  entra_orcamento text,
  saldo_inicial numeric,
  dre_codigo_original text,
  dre_descricao_original text,
  ativo text,
  origem_conta text,
  status_aprovacao text,
  status_carga text,
  id_sugestao_conta text,
  observacao_migracao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 25
CREATE TABLE IF NOT EXISTS public.stg_mapa_de_para_orcamento_contratos (
  id_de_para_orcamento text PRIMARY KEY,
  origem_base text,
  arquivo_origem text,
  item_orcamento_original text,
  qtd_linhas_com_valor integer,
  valor_total numeric,
  valor_abs_total numeric,
  cenarios_top text,
  empresas_top text,
  contratos_top text,
  clientes_top text,
  servicos_top text,
  status_contrato_top text,
  conta_orcamento_codigo_sugerida text,
  conta_orcamento_nome_sugerida text,
  conta_orcamento_origem text,
  id_sugestao_conta text,
  tipo_gerencial text,
  direto_indireto text,
  fixo_variavel text,
  linha_dre_gerencial text,
  natureza_orcamento text,
  impacta_dre_orcada text,
  gera_lancamento_contabil text,
  grau_confianca text,
  status_de_para text,
  pendencia text,
  observacao text,
  descricoes_outros_top text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 26
CREATE TABLE IF NOT EXISTS public.stg_aprovacao_contas (
  id_sugestao_conta text PRIMARY KEY,
  codigo_conta_sugerido text,
  nome_conta_sugerido text,
  codigo_conta_pai_sugerido text,
  nome_conta_pai_sugerido text,
  classe_contabil_sugerida text,
  tipo_gerencial_padrao text,
  direto_indireto_padrao text,
  fixo_variavel_padrao text,
  linha_dre_padrao text,
  qtd_lancamentos_afetados integer,
  valor_total_abs_afetado numeric,
  origens_afetadas text,
  motivo_sugestao text,
  status_aprovacao text NOT NULL DEFAULT 'AGUARDANDO_APROVACAO_USUARIO',
  decisao_usuario text,
  observacao_usuario text,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_stg_aprovacao_contas_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stg_aprovacao_contas_touch ON public.stg_aprovacao_contas;
CREATE TRIGGER trg_stg_aprovacao_contas_touch
BEFORE UPDATE ON public.stg_aprovacao_contas
FOR EACH ROW EXECUTE FUNCTION public.tg_stg_aprovacao_contas_touch();

-- logs
CREATE TABLE IF NOT EXISTS public.stg_logs_processamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote text NOT NULL,
  etapa text,
  status text,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- reconciliacao
CREATE TABLE IF NOT EXISTS public.stg_reconciliacao_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote text NOT NULL,
  indicador text NOT NULL,
  quantidade numeric,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- RLS — admin all, authenticated read
-- ============================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'stg_mapa_de_para_contabil_financeiro',
    'stg_mapa_de_para_bancos_pacote02',
    'stg_sugestoes_novas_contas',
    'stg_pendencias_de_para',
    'stg_plano_contas_proposto',
    'stg_mapa_de_para_orcamento_contratos',
    'stg_aprovacao_contas',
    'stg_logs_processamento',
    'stg_reconciliacao_pacotes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_all" ON public.%I;', t, t);
    EXECUTE format($p$CREATE POLICY "%s_admin_all" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));$p$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_read" ON public.%I;', t, t);
    EXECUTE format($p$CREATE POLICY "%s_read" ON public.%I FOR SELECT TO authenticated USING (true);$p$, t, t);
  END LOOP;
END $$;
