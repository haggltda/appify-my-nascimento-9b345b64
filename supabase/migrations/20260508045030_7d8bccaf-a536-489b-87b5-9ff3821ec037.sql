CREATE TABLE IF NOT EXISTS public.mz_01_diagnostico_arquivos_migracao (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '01_diagnostico_arquivos_migracao.csv', linha_csv integer NOT NULL, "arquivo_logico" text, "arquivo_origem" text, "tipo" text, "linhas_lidas" text, "colunas_qtd" text, "colunas" text, "sha256_origem" text, "uso_na_migracao" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_01_batch_idx ON public.mz_01_diagnostico_arquivos_migracao(migration_batch_id);
ALTER TABLE public.mz_01_diagnostico_arquivos_migracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_01_admin" ON public.mz_01_diagnostico_arquivos_migracao FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_02_dim_empresas (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '02_dim_empresas.csv', linha_csv integer NOT NULL, "id_empresa" text, "empresa_codigo" text, "empresa_nome" text, "cnpj" text, "status_cnpj" text, "origem" text, "ativo" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_02_batch_idx ON public.mz_02_dim_empresas(migration_batch_id);
ALTER TABLE public.mz_02_dim_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_02_admin" ON public.mz_02_dim_empresas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_03_dim_plano_contas_atual_enriquecido (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '03_dim_plano_contas_atual_enriquecido.csv', linha_csv integer NOT NULL, "codigo_conta" text, "conta_reduzida" text, "nome_conta" text, "classe_contabil" text, "grupo_contabil" text, "tipo" text, "natureza_devedora_credora" text, "grupo_dre" text, "nivel" text, "codigo_conta_pai" text, "exige_contrato" text, "centro_custo_padrao" text, "entra_fluxo" text, "entra_orcamento" text, "saldo_inicial" text, "dre_codigo" text, "dre_descricao" text, "status_conta" text, "origem_conta" text, "classificacao_gerencial_padrao" text, "direto_indireto_padrao" text, "fixo_variavel_padrao" text, "linha_dre_padrao" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_03_batch_idx ON public.mz_03_dim_plano_contas_atual_enriquecido(migration_batch_id);
ALTER TABLE public.mz_03_dim_plano_contas_atual_enriquecido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_03_admin" ON public.mz_03_dim_plano_contas_atual_enriquecido FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_04_dim_centros_custo_contratos_completo (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '04_dim_centros_custo_contratos_completo.csv', linha_csv integer NOT NULL, "codigo" text, "nome" text, "tipo" text, "dimensao" text, "empresas" text, "qtd_empresas" text, "ativo" text, "status_cadastro" text, "origem" text, "direto_indireto_padrao" text, "tipo_custo_despesa_padrao" text, "contrato_obrigatorio" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_04_batch_idx ON public.mz_04_dim_centros_custo_contratos_completo(migration_batch_id);
ALTER TABLE public.mz_04_dim_centros_custo_contratos_completo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_04_admin" ON public.mz_04_dim_centros_custo_contratos_completo FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_05_dim_eventos_contabeis (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '05_dim_eventos_contabeis.csv', linha_csv integer NOT NULL, "codigo_evento" text, "descricao_evento" text, "conta_debito_conceitual" text, "conta_credito_conceitual" text, "impacta_dre" text, "impacta_caixa" text, "observacao" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_05_batch_idx ON public.mz_05_dim_eventos_contabeis(migration_batch_id);
ALTER TABLE public.mz_05_dim_eventos_contabeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_05_admin" ON public.mz_05_dim_eventos_contabeis FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_06_dim_bancos_contas_financeiras (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '06_dim_bancos_contas_financeiras.csv', linha_csv integer NOT NULL, "id_banco_conta" text, "banco_original" text, "codigo_conta_banco" text, "nome_conta_banco" text, "status_de_para_banco" text, "id_sugestao_conta" text, "ativo" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_06_batch_idx ON public.mz_06_dim_bancos_contas_financeiras(migration_batch_id);
ALTER TABLE public.mz_06_dim_bancos_contas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_06_admin" ON public.mz_06_dim_bancos_contas_financeiras FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_10_stg_base_original_normalizada (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '10_stg_base_original_normalizada.csv', linha_csv integer NOT NULL, "id_base_original" text, "arquivo_origem" text, "linha_origem" text, "tipo_base" text, "uso_migracao" text, "id_origem" text, "data_original" text, "data_normalizada" text, "tipo_movimento" text, "empresa" text, "centro_custo_contrato" text, "banco" text, "historico" text, "classificacao_original" text, "valor_original" text, "valor_normalizado" text, "dados_originais_json" text, "status_tratamento" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_10_batch_idx ON public.mz_10_stg_base_original_normalizada(migration_batch_id);
ALTER TABLE public.mz_10_stg_base_original_normalizada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_10_admin" ON public.mz_10_stg_base_original_normalizada FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_20_stg_mapa_de_para_contabil_financeiro (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '20_stg_mapa_de_para_contabil_financeiro.csv', linha_csv integer NOT NULL, "id_lct" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "data_original" text, "data_caixa" text, "periodo_caixa" text, "tipo_original" text, "classificacao_original" text, "historico_original" text, "categoria_despesa_original" text, "competencia_original" text, "empresa" text, "centro_custo" text, "banco" text, "forma_pagamento" text, "valor" text, "evento_base" text, "evento_caixa" text, "conta_resultado_codigo" text, "conta_resultado_nome" text, "id_sugestao_conta_resultado" text, "conta_banco_codigo" text, "conta_banco_nome" text, "status_banco" text, "classificacao_gerencial" text, "tipo_custo_despesa_aplicado" text, "direto_indireto_aplicado" text, "fixo_variavel_aplicado" text, "criterio_classificacao" text, "grau_confianca" text, "status_validacao_base" text, "pendencia_base" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_20_batch_idx ON public.mz_20_stg_mapa_de_para_contabil_financeiro(migration_batch_id);
ALTER TABLE public.mz_20_stg_mapa_de_para_contabil_financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_20_admin" ON public.mz_20_stg_mapa_de_para_contabil_financeiro FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_21_stg_mapa_de_para_bancos (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '21_stg_mapa_de_para_bancos.csv', linha_csv integer NOT NULL, "banco_original" text, "banco_norm" text, "codigo_conta_banco" text, "nome_conta_banco" text, "status_de_para_banco" text, "id_sugestao_conta" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_21_batch_idx ON public.mz_21_stg_mapa_de_para_bancos(migration_batch_id);
ALTER TABLE public.mz_21_stg_mapa_de_para_bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_21_admin" ON public.mz_21_stg_mapa_de_para_bancos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_22_stg_sugestoes_novas_contas (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '22_stg_sugestoes_novas_contas.csv', linha_csv integer NOT NULL, "id_sugestao_conta" text, "codigo_conta_sugerido" text, "nome_conta_sugerido" text, "codigo_conta_pai_sugerida" text, "classe_contabil" text, "natureza_devedora_credora" text, "tipo_conta" text, "direto_indireto_padrao" text, "fixo_variavel_padrao" text, "impacta_dre" text, "impacta_caixa" text, "justificativa" text, "status_aprovacao" text, "origem_sugestao" text, "qtd_lancamentos_mestre_afetados" text, "valor_lancamentos_mestre_afetados" text, "qtd_linhas_realizado_depara" text, "valor_realizado_depara" text, "qtd_linhas_projetado" text, "valor_projetado" text, "qtd_itens_orcamento" text, "valor_orcamento" text, "exemplos_historico_item" text, "decisao_usuario" text, "observacao_usuario" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_22_batch_idx ON public.mz_22_stg_sugestoes_novas_contas(migration_batch_id);
ALTER TABLE public.mz_22_stg_sugestoes_novas_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_22_admin" ON public.mz_22_stg_sugestoes_novas_contas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_23_stg_pendencias_de_para (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '23_stg_pendencias_de_para.csv', linha_csv integer NOT NULL, "id_lct" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "empresa" text, "centro_custo" text, "banco" text, "classificacao_original" text, "historico" text, "valor" text, "grau_confianca" text, "status_validacao" text, "pendencia" text, "tipo_pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_23_batch_idx ON public.mz_23_stg_pendencias_de_para(migration_batch_id);
ALTER TABLE public.mz_23_stg_pendencias_de_para ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_23_admin" ON public.mz_23_stg_pendencias_de_para FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_24_dim_plano_contas_completo_proposto (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '24_dim_plano_contas_completo_proposto.csv', linha_csv integer NOT NULL, "codigo_conta" text, "conta_reduzida" text, "nome_conta" text, "classe_contabil" text, "grupo_contabil" text, "tipo" text, "natureza_devedora_credora" text, "grupo_dre" text, "nivel" text, "codigo_conta_pai" text, "exige_contrato" text, "centro_custo_padrao" text, "entra_fluxo" text, "entra_orcamento" text, "saldo_inicial" text, "dre_codigo" text, "dre_descricao" text, "status_conta" text, "origem_conta" text, "classificacao_gerencial_padrao" text, "direto_indireto_padrao" text, "fixo_variavel_padrao" text, "linha_dre_padrao" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_24_batch_idx ON public.mz_24_dim_plano_contas_completo_proposto(migration_batch_id);
ALTER TABLE public.mz_24_dim_plano_contas_completo_proposto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_24_admin" ON public.mz_24_dim_plano_contas_completo_proposto FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_25_stg_mapa_de_para_orcamento_contratos (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '25_stg_mapa_de_para_orcamento_contratos.csv', linha_csv integer NOT NULL, "item_orcamento" text, "conta_contabil_codigo" text, "conta_contabil_nome" text, "id_sugestao_conta" text, "evento_sugerido" text, "classificacao_gerencial" text, "impacta_dre" text, "direto_indireto" text, "fixo_variavel" text, "criterio_classificacao" text, "qtd_linhas" text, "valor_total" text, "status_de_para" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_25_batch_idx ON public.mz_25_stg_mapa_de_para_orcamento_contratos(migration_batch_id);
ALTER TABLE public.mz_25_stg_mapa_de_para_orcamento_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_25_admin" ON public.mz_25_stg_mapa_de_para_orcamento_contratos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_26_template_aprovacao_contas (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '26_template_aprovacao_contas.csv', linha_csv integer NOT NULL, "id_sugestao_conta" text, "codigo_conta_sugerido" text, "nome_conta_sugerido" text, "codigo_conta_pai_sugerida" text, "classe_contabil" text, "natureza_devedora_credora" text, "tipo_conta" text, "direto_indireto_padrao" text, "fixo_variavel_padrao" text, "impacta_dre" text, "impacta_caixa" text, "qtd_lancamentos_mestre_afetados" text, "valor_lancamentos_mestre_afetados" text, "qtd_linhas_realizado_depara" text, "valor_realizado_depara" text, "qtd_itens_orcamento" text, "valor_orcamento" text, "justificativa" text, "status_aprovacao" text, "decisao_usuario" text, "codigo_final_aprovado" text, "nome_final_aprovado" text, "observacao_usuario" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_26_batch_idx ON public.mz_26_template_aprovacao_contas(migration_batch_id);
ALTER TABLE public.mz_26_template_aprovacao_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_26_admin" ON public.mz_26_template_aprovacao_contas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_27_reconciliacao_de_para_pacote_do_zero (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '27_reconciliacao_de_para_pacote_do_zero.csv', linha_csv integer NOT NULL, "metric" text, "quantidade" text, "valor" text, "status" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_27_batch_idx ON public.mz_27_reconciliacao_de_para_pacote_do_zero(migration_batch_id);
ALTER TABLE public.mz_27_reconciliacao_de_para_pacote_do_zero ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_27_admin" ON public.mz_27_reconciliacao_de_para_pacote_do_zero FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_29_stg_titulos_migracao (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '29_stg_titulos_migracao.csv', linha_csv integer NOT NULL, "id_titulo" text, "id_lct_origem" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "empresa" text, "cnpj" text, "tipo_titulo" text, "cliente_fornecedor" text, "documento" text, "data_emissao" text, "data_competencia" text, "data_vencimento" text, "data_liquidacao" text, "valor_titulo" text, "valor_liquidado" text, "saldo_titulo" text, "status_titulo" text, "origem_titulo" text, "conta_contrapartida_resultado" text, "conta_cliente_fornecedor" text, "conta_banco_liquidacao" text, "evento_competencia" text, "evento_baixa" text, "centro_custo" text, "contrato" text, "historico" text, "grau_confianca" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_29_batch_idx ON public.mz_29_stg_titulos_migracao(migration_batch_id);
ALTER TABLE public.mz_29_stg_titulos_migracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_29_admin" ON public.mz_29_stg_titulos_migracao FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_30_stg_lancamentos_mestre (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '30_stg_lancamentos_mestre.csv', linha_csv integer NOT NULL, "id_lct_mestre" text, "id_lct" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "id_titulo" text, "tipo_lancamento" text, "origem_lancamento" text, "data_competencia" text, "periodo_competencia" text, "data_caixa" text, "periodo_caixa" text, "data_vencimento" text, "empresa" text, "cnpj" text, "centro_custo" text, "contrato" text, "cliente_fornecedor" text, "banco" text, "forma_pagamento" text, "tipo_movimento" text, "natureza_original" text, "historico" text, "valor" text, "evento" text, "conta_debito_codigo" text, "conta_debito_nome" text, "grupo_debito" text, "conta_credito_codigo" text, "conta_credito_nome" text, "grupo_credito" text, "valor_debito" text, "valor_credito" text, "impacta_caixa" text, "impacta_dre" text, "impacta_balanco" text, "gera_partida" text, "classificacao_gerencial" text, "tipo_custo_despesa" text, "direto_indireto" text, "fixo_variavel" text, "grau_confianca" text, "status_validacao" text, "pendencia" text, "observacao" text, "status_conta_debito" text, "id_sugestao_conta_debito" text, "status_conta_credito" text, "id_sugestao_conta_credito" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_30_batch_idx ON public.mz_30_stg_lancamentos_mestre(migration_batch_id);
ALTER TABLE public.mz_30_stg_lancamentos_mestre ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_30_admin" ON public.mz_30_stg_lancamentos_mestre FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_31_fato_partidas_dobradas (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '31_fato_partidas_dobradas.csv', linha_csv integer NOT NULL, "id_partida" text, "id_lct_mestre" text, "id_lct" text, "id_origem" text, "id_titulo" text, "evento" text, "empresa" text, "data_competencia" text, "periodo_competencia" text, "data_caixa" text, "periodo_caixa" text, "conta_debito_codigo" text, "conta_debito_nome" text, "conta_credito_codigo" text, "conta_credito_nome" text, "valor_debito" text, "valor_credito" text, "centro_custo" text, "contrato" text, "historico" text, "documento_origem" text, "arquivo_origem" text, "linha_origem" text, "impacta_caixa" text, "impacta_dre" text, "impacta_balanco" text, "classificacao_gerencial" text, "tipo_custo_despesa" text, "direto_indireto" text, "fixo_variavel" text, "grau_confianca" text, "status_validacao" text, "status_partida" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_31_batch_idx ON public.mz_31_fato_partidas_dobradas(migration_batch_id);
ALTER TABLE public.mz_31_fato_partidas_dobradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_31_admin" ON public.mz_31_fato_partidas_dobradas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_32_fato_razao_contabil (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '32_fato_razao_contabil.csv', linha_csv integer NOT NULL, "id_razao" text, "id_partida" text, "id_lct_mestre" text, "id_lct" text, "id_origem" text, "id_titulo" text, "empresa" text, "data_lancamento" text, "periodo" text, "codigo_conta" text, "conta_contabil" text, "grupo_contabil" text, "natureza_conta" text, "tipo_lancamento_conta" text, "valor_debito_razao" text, "valor_credito_razao" text, "saldo_movimento" text, "historico" text, "documento_origem" text, "centro_custo" text, "contrato" text, "arquivo_origem" text, "linha_origem" text, "impacta_caixa" text, "impacta_dre" text, "impacta_balanco" text, "status_validacao" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_32_batch_idx ON public.mz_32_fato_razao_contabil(migration_batch_id);
ALTER TABLE public.mz_32_fato_razao_contabil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_32_admin" ON public.mz_32_fato_razao_contabil FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_33_fato_balancete (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '33_fato_balancete.csv', linha_csv integer NOT NULL, "empresa" text, "periodo" text, "codigo_conta" text, "conta_contabil" text, "grupo_contabil" text, "natureza_conta" text, "debitos" text, "creditos" text, "qtd_lancamentos" text, "saldo_inicial" text, "saldo_movimento" text, "saldo_final" text, "status_balancete" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_33_batch_idx ON public.mz_33_fato_balancete(migration_batch_id);
ALTER TABLE public.mz_33_fato_balancete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_33_admin" ON public.mz_33_fato_balancete FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_40_fato_fluxo_caixa_realizado (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '40_fato_fluxo_caixa_realizado.csv', linha_csv integer NOT NULL, "id_fluxo" text, "id_lct" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "fluxo" text, "data_caixa" text, "periodo_caixa" text, "tipo_movimento" text, "classificacao_original" text, "historico" text, "categoria_despesa" text, "competencia_original" text, "empresa" text, "centro_custo" text, "banco" text, "forma_pagamento" text, "valor" text, "valor_entrada" text, "valor_saida" text, "valor_liquido" text, "evento" text, "conta_banco_codigo" text, "conta_banco_nome" text, "conta_resultado_codigo" text, "conta_resultado_nome" text, "impacta_caixa" text, "impacta_dre_base" text, "classificacao_gerencial" text, "tipo_custo_despesa_aplicado" text, "direto_indireto_aplicado" text, "fixo_variavel_aplicado" text, "status_fluxo" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_40_batch_idx ON public.mz_40_fato_fluxo_caixa_realizado(migration_batch_id);
ALTER TABLE public.mz_40_fato_fluxo_caixa_realizado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_40_admin" ON public.mz_40_fato_fluxo_caixa_realizado FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_41_fato_fluxo_caixa_projetado (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '41_fato_fluxo_caixa_projetado.csv', linha_csv integer NOT NULL, "id_projecao" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "data_prevista" text, "periodo_previsto" text, "tipo_movimento" text, "classificacao_original" text, "historico" text, "categoria_despesa" text, "competencia_original" text, "empresa" text, "centro_custo" text, "banco" text, "forma_pagamento" text, "valor_previsto" text, "valor_entrada_previsto" text, "valor_saida_previsto" text, "valor_liquido_previsto" text, "origem_previsao" text, "probabilidade" text, "status_projecao" text, "evento_sugerido" text, "conta_resultado_codigo" text, "conta_resultado_nome" text, "id_sugestao_conta" text, "conta_banco_codigo" text, "conta_banco_nome" text, "classificacao_gerencial" text, "direto_indireto" text, "fixo_variavel" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_41_batch_idx ON public.mz_41_fato_fluxo_caixa_projetado(migration_batch_id);
ALTER TABLE public.mz_41_fato_fluxo_caixa_projetado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_41_admin" ON public.mz_41_fato_fluxo_caixa_projetado FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_50_fato_orcamento_contratos_competencia (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '50_fato_orcamento_contratos_competencia.csv', linha_csv integer NOT NULL, "id_orcamento_item" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "empresa" text, "cliente" text, "contrato" text, "posto" text, "servico" text, "quantidade" text, "sindicato" text, "vigencia_original" text, "vigencia_inicio" text, "status_contrato" text, "orcado_executado_original" text, "tipo_orcamento" text, "fim_contrato_original" text, "fim_contrato" text, "item_orcamento" text, "valor_original" text, "valor_orcado_executado" text, "conta_contabil_codigo" text, "conta_contabil_nome" text, "id_sugestao_conta" text, "evento_sugerido" text, "classificacao_gerencial" text, "impacta_dre" text, "direto_indireto" text, "fixo_variavel" text, "criterio_classificacao" text, "status_orcamento" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_50_batch_idx ON public.mz_50_fato_orcamento_contratos_competencia(migration_batch_id);
ALTER TABLE public.mz_50_fato_orcamento_contratos_competencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_50_admin" ON public.mz_50_fato_orcamento_contratos_competencia FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_60_view_dre_gerencial_competencia (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '60_view_dre_gerencial_competencia.csv', linha_csv integer NOT NULL, "empresa" text, "periodo_competencia" text, "centro_custo" text, "contrato" text, "linha_dre" text, "classificacao_gerencial" text, "tipo_custo_despesa" text, "direto_indireto" text, "fixo_variavel" text, "conta_debito_codigo" text, "conta_debito_nome" text, "conta_credito_codigo" text, "conta_credito_nome" text, "valor_dre" text, "id_lct_mestre" text, "id_lct" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "status_validacao" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_60_batch_idx ON public.mz_60_view_dre_gerencial_competencia(migration_batch_id);
ALTER TABLE public.mz_60_view_dre_gerencial_competencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_60_admin" ON public.mz_60_view_dre_gerencial_competencia FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_61_view_dre_caixa_gerencial (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '61_view_dre_caixa_gerencial.csv', linha_csv integer NOT NULL, "id_fluxo" text, "empresa" text, "periodo_caixa" text, "data_caixa" text, "centro_custo" text, "linha_dre_caixa" text, "classificacao_original" text, "historico" text, "banco" text, "valor_dre_caixa" text, "evento" text, "impacta_dre_base" text, "status_fluxo" text, "pendencia" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_61_batch_idx ON public.mz_61_view_dre_caixa_gerencial(migration_batch_id);
ALTER TABLE public.mz_61_view_dre_caixa_gerencial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_61_admin" ON public.mz_61_view_dre_caixa_gerencial FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_62_view_ativo (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '62_view_ativo.csv', linha_csv integer NOT NULL, "empresa" text, "periodo" text, "codigo_conta" text, "conta_contabil" text, "grupo_contabil" text, "natureza_conta" text, "debitos" text, "creditos" text, "qtd_lancamentos" text, "saldo_inicial" text, "saldo_movimento" text, "saldo_final" text, "status_balancete" text, "grupo_topo" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_62_batch_idx ON public.mz_62_view_ativo(migration_batch_id);
ALTER TABLE public.mz_62_view_ativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_62_admin" ON public.mz_62_view_ativo FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_63_view_passivo (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '63_view_passivo.csv', linha_csv integer NOT NULL, "empresa" text, "periodo" text, "codigo_conta" text, "conta_contabil" text, "grupo_contabil" text, "natureza_conta" text, "debitos" text, "creditos" text, "qtd_lancamentos" text, "saldo_inicial" text, "saldo_movimento" text, "saldo_final" text, "status_balancete" text, "grupo_topo" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_63_batch_idx ON public.mz_63_view_passivo(migration_batch_id);
ALTER TABLE public.mz_63_view_passivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_63_admin" ON public.mz_63_view_passivo FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_64_view_patrimonio_liquido (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '64_view_patrimonio_liquido.csv', linha_csv integer NOT NULL, "empresa" text, "periodo" text, "codigo_conta" text, "conta_contabil" text, "grupo_contabil" text, "natureza_conta" text, "debitos" text, "creditos" text, "qtd_lancamentos" text, "saldo_inicial" text, "saldo_movimento" text, "saldo_final" text, "status_balancete" text, "grupo_topo" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_64_batch_idx ON public.mz_64_view_patrimonio_liquido(migration_batch_id);
ALTER TABLE public.mz_64_view_patrimonio_liquido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_64_admin" ON public.mz_64_view_patrimonio_liquido FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_65_view_contas_resultado (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '65_view_contas_resultado.csv', linha_csv integer NOT NULL, "empresa" text, "periodo" text, "codigo_conta" text, "conta_contabil" text, "grupo_contabil" text, "natureza_conta" text, "debitos" text, "creditos" text, "qtd_lancamentos" text, "saldo_inicial" text, "saldo_movimento" text, "saldo_final" text, "status_balancete" text, "grupo_topo" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_65_batch_idx ON public.mz_65_view_contas_resultado(migration_batch_id);
ALTER TABLE public.mz_65_view_contas_resultado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_65_admin" ON public.mz_65_view_contas_resultado FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_90_stg_pendencias_validacao (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '90_stg_pendencias_validacao.csv', linha_csv integer NOT NULL, "id_lct_mestre" text, "id_lct" text, "id_origem" text, "arquivo_origem" text, "linha_origem" text, "empresa" text, "centro_custo" text, "contrato" text, "banco" text, "natureza_original" text, "historico" text, "valor" text, "evento" text, "conta_debito_codigo" text, "conta_debito_nome" text, "conta_credito_codigo" text, "conta_credito_nome" text, "grau_confianca" text, "status_validacao" text, "tipo_pendencia" text, "pendencia" text, "observacao" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_90_batch_idx ON public.mz_90_stg_pendencias_validacao(migration_batch_id);
ALTER TABLE public.mz_90_stg_pendencias_validacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_90_admin" ON public.mz_90_stg_pendencias_validacao FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_91_stg_logs_processamento (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '91_stg_logs_processamento.csv', linha_csv integer NOT NULL, "etapa" text, "status" text, "detalhe" text, "data_hora_geracao" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_91_batch_idx ON public.mz_91_stg_logs_processamento(migration_batch_id);
ALTER TABLE public.mz_91_stg_logs_processamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_91_admin" ON public.mz_91_stg_logs_processamento FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_92_stg_reconciliacao_migracao (mz_id bigserial PRIMARY KEY, migration_batch_id uuid NOT NULL, arquivo_origem_carga text NOT NULL DEFAULT '92_stg_reconciliacao_migracao.csv', linha_csv integer NOT NULL, "bloco" text, "metrica" text, "quantidade" text, "valor" text, "status" text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mz_92_batch_idx ON public.mz_92_stg_reconciliacao_migracao(migration_batch_id);
ALTER TABLE public.mz_92_stg_reconciliacao_migracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_92_admin" ON public.mz_92_stg_reconciliacao_migracao FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mz_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo text UNIQUE NOT NULL,
  tabela text NOT NULL,
  storage_path text,
  uploaded_at timestamptz,
  uploaded_by uuid,
  linhas_esperadas integer NOT NULL DEFAULT 0,
  linhas_carregadas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDENTE',
  ultimo_erro text,
  migration_batch_id uuid,
  iniciou_em timestamptz,
  finalizou_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mz_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mz_status_admin" ON public.mz_status FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('migracao-zero','migracao-zero', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mz_storage_admin_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='migracao-zero' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "mz_storage_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='migracao-zero' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "mz_storage_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='migracao-zero' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "mz_storage_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='migracao-zero' AND public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.mz_status (arquivo,tabela,linhas_esperadas) VALUES
('01_diagnostico_arquivos_migracao.csv','mz_01_diagnostico_arquivos_migracao',7),
('02_dim_empresas.csv','mz_02_dim_empresas',6),
('03_dim_plano_contas_atual_enriquecido.csv','mz_03_dim_plano_contas_atual_enriquecido',199),
('04_dim_centros_custo_contratos_completo.csv','mz_04_dim_centros_custo_contratos_completo',141),
('05_dim_eventos_contabeis.csv','mz_05_dim_eventos_contabeis',20),
('06_dim_bancos_contas_financeiras.csv','mz_06_dim_bancos_contas_financeiras',42),
('10_stg_base_original_normalizada.csv','mz_10_stg_base_original_normalizada',123689),
('20_stg_mapa_de_para_contabil_financeiro.csv','mz_20_stg_mapa_de_para_contabil_financeiro',58966),
('21_stg_mapa_de_para_bancos.csv','mz_21_stg_mapa_de_para_bancos',42),
('22_stg_sugestoes_novas_contas.csv','mz_22_stg_sugestoes_novas_contas',18),
('23_stg_pendencias_de_para.csv','mz_23_stg_pendencias_de_para',24982),
('24_dim_plano_contas_completo_proposto.csv','mz_24_dim_plano_contas_completo_proposto',217),
('25_stg_mapa_de_para_orcamento_contratos.csv','mz_25_stg_mapa_de_para_orcamento_contratos',117),
('26_template_aprovacao_contas.csv','mz_26_template_aprovacao_contas',18),
('27_reconciliacao_de_para_pacote_do_zero.csv','mz_27_reconciliacao_de_para_pacote_do_zero',7),
('29_stg_titulos_migracao.csv','mz_29_stg_titulos_migracao',48648),
('30_stg_lancamentos_mestre.csv','mz_30_stg_lancamentos_mestre',107614),
('31_fato_partidas_dobradas.csv','mz_31_fato_partidas_dobradas',107605),
('32_fato_razao_contabil.csv','mz_32_fato_razao_contabil',215210),
('33_fato_balancete.csv','mz_33_fato_balancete',4852),
('40_fato_fluxo_caixa_realizado.csv','mz_40_fato_fluxo_caixa_realizado',58966),
('41_fato_fluxo_caixa_projetado.csv','mz_41_fato_fluxo_caixa_projetado',5097),
('50_fato_orcamento_contratos_competencia.csv','mz_50_fato_orcamento_contratos_competencia',47739),
('60_view_dre_gerencial_competencia.csv','mz_60_view_dre_gerencial_competencia',48941),
('61_view_dre_caixa_gerencial.csv','mz_61_view_dre_caixa_gerencial',58966),
('62_view_ativo.csv','mz_62_view_ativo',1023),
('63_view_passivo.csv','mz_63_view_passivo',825),
('64_view_patrimonio_liquido.csv','mz_64_view_patrimonio_liquido',13),
('65_view_contas_resultado.csv','mz_65_view_contas_resultado',2991),
('90_stg_pendencias_validacao.csv','mz_90_stg_pendencias_validacao',73177),
('91_stg_logs_processamento.csv','mz_91_stg_logs_processamento',8),
('92_stg_reconciliacao_migracao.csv','mz_92_stg_reconciliacao_migracao',15)
ON CONFLICT (arquivo) DO UPDATE SET tabela=EXCLUDED.tabela, linhas_esperadas=EXCLUDED.linhas_esperadas;