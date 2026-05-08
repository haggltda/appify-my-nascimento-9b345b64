export const sql = `-- 27 reconciliacao -> stg_reconciliacao_pacotes (14)
DELETE FROM public.stg_reconciliacao_pacotes WHERE pacote='PACOTE_02';
INSERT INTO public.stg_reconciliacao_pacotes (pacote,indicador,quantidade,observacao) VALUES
('PACOTE_02','mapas_financeiros_gerados',358,'Chaves únicas por origem, tipo, classificação e contexto gerencial.'),
('PACOTE_02','linhas_financeiro_realizado_origem',58966,'Leitura completa do CSV financeiro realizado.'),
('PACOTE_02','linhas_fluxo_caixa_projetado_origem',5097,'Leitura completa do CSV de caixa projetado.'),
('PACOTE_02','itens_orcamento_contratos_mapeados',98,'Colunas financeiras do orçamento por contrato.'),
('PACOTE_02','linhas_orcamento_contratos_origem',1272,'Linhas úteis da base de histórico/custos de contratos.'),
('PACOTE_02','contas_sugeridas_aguardando_aprovacao',48,'Não carregar como plano definitivo antes do OK do usuário.'),
('PACOTE_02','pendencias_de_para',295,'Inclui aprovações de contas, validações de classificação e bancos vazios.'),
('PACOTE_02','de_para_financeiro_VALIDADO_AUTO',129,NULL),
('PACOTE_02','de_para_financeiro_GERADO_IA_REVISAR',122,NULL),
('PACOTE_02','de_para_financeiro_AGUARDANDO_APROVACAO_CONTA',106,NULL),
('PACOTE_02','de_para_bancos_VALIDADO_AUTO',69,NULL),
('PACOTE_02','de_para_bancos_AGUARDANDO_APROVACAO_CONTA',7,NULL),
('PACOTE_02','de_para_orcamento_VALIDADO_AUTO',38,NULL),
('PACOTE_02','de_para_orcamento_AGUARDANDO_APROVACAO_CONTA',57,NULL);

-- 90 logs -> stg_logs_processamento (7)
DELETE FROM public.stg_logs_processamento WHERE pacote='PACOTE_02';
INSERT INTO public.stg_logs_processamento (pacote,etapa,status,detalhe) VALUES
('PACOTE_02','leitura_plano_contas','OK','199 contas originais carregadas do Pacote 01/plano_contas.'),
('PACOTE_02','agregacao_financeiro','OK','358 chaves de de-para geradas para financeiro realizado e caixa projetado.'),
('PACOTE_02','de_para_bancos','OK','78 combinações banco/empresa mapeadas.'),
('PACOTE_02','de_para_orcamento','OK','98 itens de orçamento por contrato mapeados.'),
('PACOTE_02','sugestoes_contas','OK','48 contas sugeridas aguardando aprovação.'),
('PACOTE_02','pendencias','OK','295 pendências geradas para aprovação/revisão.'),
('PACOTE_02','governanca','OK','Contas sugeridas não foram marcadas como definitivas; status AGUARDANDO_APROVACAO_USUARIO.');

`;
