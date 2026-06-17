BEGIN;

DELETE FROM public.aud_plano_contas_origem_diagnostico
 WHERE batch_id = 'p3d-v33-lf-documentada';

WITH
mapa_empresa(codigo, cnpj, nome_empresarial, aliases) AS (
  VALUES
    ('AGPS',  '29.722.947/0001-98', 'AGPS ADMINISTRADORA E PARTICIPACOES LTDA',         ARRAY['AGPS']),
    ('CANAA', '24.354.749/0001-03', 'INSTITUTO DE ENSINO CANAA',                        ARRAY['CANAA','CANAÃ','CANA','ESCOLA CANAA','INSTITUTO DE ENSINO CANAA']),
    ('HAGG',  '03.644.009/0001-23', 'NASCIMENTO SERVICOS DE LIMPEZA LTDA',              ARRAY['HAGG','NASCIMENTO']),
    ('NH',    '18.615.832/0001-88', 'NH PRESTACAO DE SERVICOS LTDA',                    ARRAY['NH']),
    ('SN',    '17.290.783/0001-98', 'SN SERVICOS DE LIMPEZA E ZELADORIA PREDIAL LTDA',  ARRAY['SN']),
    ('LF',    '27.579.296/0001-01', 'LF ZELADORIA LTDA',                                ARRAY['LF','LF ZELADORIA'])
),
emp_norm AS (
  SELECT m.codigo, public._aud_normaliza_texto(a) AS alias_norm
  FROM mapa_empresa m, unnest(m.aliases) a
),
cc AS (
  SELECT c.id AS conta_contabil_id, c.empresa_id AS empresa_id_atual,
         e.codigo AS empresa_codigo_atual, c.classificacao, c.descricao,
         c.tipo::text AS tipo, c.saldo_inicial, c.ativo AS ativo_atual,
         public._aud_normaliza_texto(c.descricao)     AS desc_norm,
         public._aud_normaliza_texto(c.classificacao) AS class_norm
  FROM public.conta_contabil c
  JOIN public.empresas e ON e.id = c.empresa_id
  WHERE public._aud_normaliza_texto(c.tipo::text) = 'ANALITICA' OR c.tipo IS NULL
),
ag_lp  AS (SELECT conta_contabil_id, count(*) n FROM public.lancamento_partida              GROUP BY 1),
ag_ptp AS (SELECT conta_contabil_id, count(*) n FROM public.pre_titulo_pagar                GROUP BY 1),
ag_ptr AS (SELECT conta_contabil_id, count(*) n FROM public.pre_titulo_rateio               GROUP BY 1),
ag_tp  AS (SELECT conta_contabil_id, count(*) n FROM public.titulo_pagar                    GROUP BY 1),
ag_tr  AS (SELECT conta_contabil_id, count(*) n FROM public.titulo_receber                  GROUP BY 1),
ag_ocl AS (SELECT conta_contabil_id, count(*) n FROM public.orcamento_contrato_linha        GROUP BY 1),
ag_cb  AS (SELECT conta_contabil_id, count(*) n FROM public.conta_bancaria                  GROUP BY 1),
ag_cr  AS (SELECT conta_contabil_id, count(*) n FROM public.conciliacao_regra               GROUP BY 1),
ag_al  AS (SELECT conta_contabil_id, count(*) n FROM public.integration_alias_contas_contabeis    GROUP BY 1),
ag_mp  AS (SELECT conta_contabil_id, count(*) n FROM public.integration_map_classificacao_contabil GROUP BY 1),
ag_pf  AS (SELECT conta_contabil_padrao_imposto_id AS conta_contabil_id, count(*) n
           FROM public.parametro_fiscal WHERE conta_contabil_padrao_imposto_id IS NOT NULL GROUP BY 1),
ag_pcs AS (SELECT conta_contabil_id, count(*) n FROM public.plano_contas_solicitacao        GROUP BY 1),
ag_sfr AS (
  SELECT conta_contabil_resolvida_id AS conta_contabil_id, count(*) n
  FROM public.stg_fluxo_caixa_realizado
  WHERE conta_contabil_resolvida_id IS NOT NULL GROUP BY 1
),
ag_fcr AS (
  SELECT empresa_id, sugestao_conta_contabil_id AS conta_contabil_id, count(*) n
  FROM public.fcr_sugestoes_pendencias
  WHERE sugestao_conta_contabil_id IS NOT NULL
  GROUP BY 1,2
),
ag_sbd AS (
  SELECT cc.empresa_id_atual AS empresa_id, cc.conta_contabil_id, count(*) n
  FROM public.stg_bancos_contas_detectadas s
  JOIN public.empresas e
    ON public._aud_normaliza_texto(e.codigo) = public._aud_normaliza_texto(s.empresa_codigo_detectada)
  JOIN cc
    ON cc.empresa_id_atual = e.id
   AND public._aud_normaliza_texto(cc.classificacao)
     = public._aud_normaliza_texto(s.conta_contabil_sugerida)
  WHERE s.conta_contabil_sugerida IS NOT NULL
    AND s.empresa_codigo_detectada IS NOT NULL
  GROUP BY 1,2
),
ag_smb AS (
  SELECT cc.empresa_id_atual AS empresa_id, cc.conta_contabil_id, count(*) n
  FROM public.stg_mapa_de_para_bancos_pacote02 s
  JOIN public.empresas e
    ON public._aud_normaliza_texto(e.codigo) = public._aud_normaliza_texto(s.empresa_detectada)
  JOIN cc
    ON cc.empresa_id_atual = e.id
   AND public._aud_normaliza_texto(cc.classificacao)
     = public._aud_normaliza_texto(s.conta_contabil_codigo_sugerida)
  WHERE s.conta_contabil_codigo_sugerida IS NOT NULL
    AND s.empresa_detectada IS NOT NULL
  GROUP BY 1,2
),
ag_rep AS (
  SELECT classificacao,
         count(*) AS qtd_empresas_com_mesma_classificacao,
         count(DISTINCT saldo_inicial) AS qtd_saldos_distintos
  FROM cc GROUP BY classificacao
),
tokens_por_conta AS (
  SELECT DISTINCT cc.conta_contabil_id, en.codigo
  FROM cc JOIN emp_norm en
    ON cc.desc_norm ~ ('(^| )' || en.alias_norm || '($| )')
),
inf_token_agg AS (
  SELECT conta_contabil_id,
         array_agg(DISTINCT codigo ORDER BY codigo) AS codigos_tok,
         count(DISTINCT codigo) AS qtd_tokens_distintos,
         (array_agg(DISTINCT codigo))[1] AS unico_codigo
  FROM tokens_por_conta GROUP BY conta_contabil_id
),
inf_banco AS (
  SELECT cb.conta_contabil_id, e.codigo AS emp_codigo,
         max(coalesce(cb.banco_nome, cb.banco_codigo)) AS banco
  FROM public.conta_bancaria cb
  JOIN public.empresas e ON e.id = cb.empresa_id
  WHERE cb.conta_contabil_id IS NOT NULL
  GROUP BY cb.conta_contabil_id, e.codigo
),
base AS (
  SELECT cc.*,
    COALESCE(ag_lp.n,0)  AS qtd_lancamento_partida,
    COALESCE(ag_ptp.n,0) AS qtd_pre_titulo_pagar,
    COALESCE(ag_ptr.n,0) AS qtd_pre_titulo_rateio,
    COALESCE(ag_tp.n,0)  AS qtd_titulo_pagar,
    COALESCE(ag_tr.n,0)  AS qtd_titulo_receber,
    COALESCE(ag_ocl.n,0) AS qtd_orcamento_contrato_linha,
    COALESCE(ag_cb.n,0)  AS qtd_conta_bancaria,
    COALESCE(ag_cr.n,0)  AS qtd_conciliacao_regra,
    COALESCE(ag_al.n,0)  AS qtd_alias_integracao,
    COALESCE(ag_mp.n,0)  AS qtd_integration_map,
    COALESCE(ag_pf.n,0)  AS qtd_parametro_fiscal,
    COALESCE(ag_pcs.n,0) AS qtd_plano_contas_solicitacao,
    COALESCE(ag_sfr.n,0) AS qtd_stg_fluxo_resolvida,
    COALESCE(ag_fcr.n,0) AS qtd_fcr_sugestoes_pendencias,
    COALESCE(ag_sbd.n,0) AS qtd_stg_bancos_detectadas,
    COALESCE(ag_smb.n,0) AS qtd_stg_mapa_para_bancos,
    0                    AS qtd_realizado_lancamentos,
    COALESCE(ag_rep.qtd_empresas_com_mesma_classificacao,1) AS qtd_empresas_com_mesma_classificacao,
    COALESCE(ag_rep.qtd_saldos_distintos,1)                 AS qtd_saldos_distintos,
    it.codigos_tok,
    COALESCE(it.qtd_tokens_distintos,0) AS qtd_tokens_distintos,
    it.unico_codigo,
    ib.emp_codigo AS emp_inferida_banco, ib.banco AS banco_inferido
  FROM cc
  LEFT JOIN ag_lp  USING (conta_contabil_id)
  LEFT JOIN ag_ptp USING (conta_contabil_id)
  LEFT JOIN ag_ptr USING (conta_contabil_id)
  LEFT JOIN ag_tp  USING (conta_contabil_id)
  LEFT JOIN ag_tr  USING (conta_contabil_id)
  LEFT JOIN ag_ocl USING (conta_contabil_id)
  LEFT JOIN ag_cb  USING (conta_contabil_id)
  LEFT JOIN ag_cr  USING (conta_contabil_id)
  LEFT JOIN ag_al  USING (conta_contabil_id)
  LEFT JOIN ag_mp  USING (conta_contabil_id)
  LEFT JOIN ag_pf  USING (conta_contabil_id)
  LEFT JOIN ag_pcs USING (conta_contabil_id)
  LEFT JOIN ag_sfr USING (conta_contabil_id)
  LEFT JOIN ag_fcr ON ag_fcr.empresa_id = cc.empresa_id_atual AND ag_fcr.conta_contabil_id = cc.conta_contabil_id
  LEFT JOIN ag_sbd ON ag_sbd.empresa_id = cc.empresa_id_atual AND ag_sbd.conta_contabil_id = cc.conta_contabil_id
  LEFT JOIN ag_smb ON ag_smb.empresa_id = cc.empresa_id_atual AND ag_smb.conta_contabil_id = cc.conta_contabil_id
  LEFT JOIN ag_rep ON ag_rep.classificacao = cc.classificacao
  LEFT JOIN inf_token_agg it ON it.conta_contabil_id = cc.conta_contabil_id
  LEFT JOIN inf_banco      ib ON ib.conta_contabil_id = cc.conta_contabil_id
),
somas AS (
  SELECT b.*,
    (b.qtd_lancamento_partida + b.qtd_pre_titulo_pagar + b.qtd_pre_titulo_rateio
     + b.qtd_titulo_pagar + b.qtd_titulo_receber + b.qtd_orcamento_contrato_linha
     + b.qtd_conta_bancaria + b.qtd_conciliacao_regra + b.qtd_alias_integracao
     + b.qtd_integration_map + b.qtd_parametro_fiscal + b.qtd_plano_contas_solicitacao
     + b.qtd_stg_fluxo_resolvida) AS qtd_vinculo_real,
    (b.qtd_fcr_sugestoes_pendencias + b.qtd_stg_bancos_detectadas + b.qtd_stg_mapa_para_bancos)
      AS qtd_dependencia_qualitativa,
    COALESCE(b.emp_inferida_banco, CASE WHEN b.qtd_tokens_distintos = 1 THEN b.unico_codigo END)
      AS empresa_inferida,
    COALESCE(
      (b.qtd_empresas_com_mesma_classificacao > 1
       AND b.qtd_saldos_distintos = 1
       AND b.saldo_inicial IS NOT NULL AND b.saldo_inicial <> 0),
      false) AS saldo_replicado_suspeito
  FROM base b
),
classificado AS (
  SELECT s.*,
    CASE
      WHEN s.qtd_tokens_distintos > 1 THEN 'AMBIGUA_MULTIPLOS_TOKENS'
      WHEN s.empresa_inferida IS NOT NULL AND s.empresa_inferida <> s.empresa_codigo_atual AND s.qtd_vinculo_real > 0
        THEN 'REFERENCIADA_EM_EMPRESA_ERRADA'
      WHEN s.empresa_inferida IS NOT NULL AND s.empresa_inferida <> s.empresa_codigo_atual AND s.qtd_vinculo_real = 0
        THEN 'ESPECIFICA_DE_EMPRESA_EM_EMPRESA_ERRADA'
      WHEN s.empresa_inferida IS NOT NULL AND s.empresa_inferida = s.empresa_codigo_atual
        THEN 'ESPECIFICA_DE_EMPRESA'
      WHEN s.saldo_replicado_suspeito THEN 'SALDO_REPLICADO_SUSPEITO'
      ELSE 'ESTRUTURA_CONTABIL_COMPARTILHADA'
    END AS categoria_calc
  FROM somas s
),
acao AS (
  SELECT c.*,
    CASE
      WHEN c.qtd_vinculo_real > 0                                       THEN 'MANTER_POR_VINCULO_HISTORICO'
      WHEN c.categoria_calc = 'AMBIGUA_MULTIPLOS_TOKENS'                THEN 'REVISAR_HUMANO'
      WHEN c.qtd_dependencia_qualitativa > 0                            THEN 'REVISAR_HUMANO'
      WHEN c.categoria_calc = 'ESPECIFICA_DE_EMPRESA_EM_EMPRESA_ERRADA' THEN 'INATIVAR_CONTA_ESPECIFICA_EM_EMPRESA_ERRADA'
      WHEN c.categoria_calc = 'SALDO_REPLICADO_SUSPEITO'                THEN 'ZERAR_SALDO_REPLICADO'
      WHEN c.categoria_calc IN ('ESTRUTURA_CONTABIL_COMPARTILHADA','ESPECIFICA_DE_EMPRESA') THEN 'MANTER_ESTRUTURA'
      ELSE 'REVISAR_HUMANO'
    END AS acao_calc
  FROM classificado c
),
risco AS (
  SELECT a.*,
    CASE
      WHEN a.qtd_lancamento_partida > 0 THEN 'ALTO'
      WHEN (a.qtd_titulo_pagar + a.qtd_titulo_receber + a.qtd_pre_titulo_pagar
          + a.qtd_pre_titulo_rateio + a.qtd_orcamento_contrato_linha + a.qtd_parametro_fiscal) > 0 THEN 'MEDIO'
      WHEN a.qtd_dependencia_qualitativa > 0 THEN 'BAIXO'
      ELSE 'NENHUM'
    END AS risco_dc_calc,
    CASE
      WHEN a.saldo_replicado_suspeito THEN 'ALTO'
      WHEN a.qtd_vinculo_real > 0      THEN 'MEDIO'
      ELSE 'NENHUM'
    END AS risco_rel_calc
  FROM acao a
)
INSERT INTO public.aud_plano_contas_origem_diagnostico (
  batch_id, conta_contabil_id, classificacao, descricao, tipo, saldo_inicial,
  ativo_atual, empresa_id_atual, empresa_codigo_atual,
  empresa_inferida_id, empresa_inferida_codigo, empresa_inferida_cnpj, empresa_inferida_nome,
  categoria, score_confianca, motivo_classificacao, tokens_detectados, aliases_detectados,
  fonte_inferencia, conta_bancaria_especifica, banco_inferido, empresa_banco_inferida,
  qtd_conta_bancaria, estrutura_compartilhada_possivel, conta_titular_especifica,
  saldo_replicado_suspeito, qtd_empresas_com_mesma_classificacao, qtd_saldos_distintos,
  qtd_lancamento_partida, qtd_pre_titulo_pagar, qtd_pre_titulo_rateio,
  qtd_titulo_pagar, qtd_titulo_receber, qtd_orcamento_contrato_linha,
  qtd_conciliacao_regra, qtd_alias_integracao,
  qtd_integration_map, qtd_parametro_fiscal, qtd_plano_contas_solicitacao,
  qtd_realizado_lancamentos, qtd_stg_fluxo_resolvida, qtd_stg_bancos_detectadas,
  qtd_stg_mapa_para_bancos, qtd_fcr_sugestoes_pendencias,
  tem_vinculo_real, risco_debito_credito, risco_relatorio_contabil,
  pode_inativar_futuro, pode_zerar_saldo_futuro, trava_motivo, acao_futura_recomendada
)
SELECT
  'p3d-v33-lf-documentada',
  r.conta_contabil_id, r.classificacao, r.descricao, r.tipo, r.saldo_inicial,
  r.ativo_atual, r.empresa_id_atual, r.empresa_codigo_atual,
  (SELECT id FROM public.empresas e WHERE e.codigo = r.empresa_inferida),
  r.empresa_inferida,
  (SELECT cnpj             FROM mapa_empresa m WHERE m.codigo = r.empresa_inferida),
  (SELECT nome_empresarial FROM mapa_empresa m WHERE m.codigo = r.empresa_inferida),
  r.categoria_calc,
  CASE
    WHEN r.categoria_calc='AMBIGUA_MULTIPLOS_TOKENS' THEN 40
    WHEN r.emp_inferida_banco IS NOT NULL            THEN 95
    WHEN r.qtd_tokens_distintos = 1                  THEN 75
    WHEN r.categoria_calc='SALDO_REPLICADO_SUSPEITO' THEN 70
    ELSE 50
  END,
  r.categoria_calc
    || ' | vinculo_real=' || r.qtd_vinculo_real
    || ' | dep_qualit='   || r.qtd_dependencia_qualitativa
    || ' | fcr=' || r.qtd_fcr_sugestoes_pendencias
    || ' | stg_b=' || r.qtd_stg_bancos_detectadas
    || ' | stg_m=' || r.qtd_stg_mapa_para_bancos
    || CASE WHEN r.qtd_tokens_distintos > 1 THEN ' | tokens=' || array_to_string(r.codigos_tok, ',') ELSE '' END
    || ' | realizado_lancamentos: flag global, NAO atribuido por conta',
  COALESCE(r.codigos_tok, ARRAY[]::text[]),
  COALESCE(r.codigos_tok, ARRAY[]::text[]),
  CASE WHEN r.emp_inferida_banco IS NOT NULL THEN 'CONTA_BANCARIA'
       WHEN r.qtd_tokens_distintos = 1       THEN 'TOKEN_DESCRICAO'
       WHEN r.qtd_tokens_distintos > 1       THEN 'AMBIGUA'
       ELSE 'HEURISTICA' END,
  COALESCE(r.qtd_conta_bancaria > 0, false),
  r.banco_inferido, r.emp_inferida_banco,
  r.qtd_conta_bancaria,
  COALESCE(r.qtd_empresas_com_mesma_classificacao > 1, false),
  COALESCE(r.qtd_tokens_distintos = 1, false),
  COALESCE(r.saldo_replicado_suspeito, false),
  r.qtd_empresas_com_mesma_classificacao, r.qtd_saldos_distintos,
  r.qtd_lancamento_partida, r.qtd_pre_titulo_pagar, r.qtd_pre_titulo_rateio,
  r.qtd_titulo_pagar, r.qtd_titulo_receber, r.qtd_orcamento_contrato_linha,
  r.qtd_conciliacao_regra, r.qtd_alias_integracao,
  r.qtd_integration_map, r.qtd_parametro_fiscal, r.qtd_plano_contas_solicitacao,
  r.qtd_realizado_lancamentos, r.qtd_stg_fluxo_resolvida, r.qtd_stg_bancos_detectadas,
  r.qtd_stg_mapa_para_bancos, r.qtd_fcr_sugestoes_pendencias,
  COALESCE(r.qtd_vinculo_real > 0, false),
  r.risco_dc_calc, r.risco_rel_calc,
  COALESCE(r.acao_calc = 'INATIVAR_CONTA_ESPECIFICA_EM_EMPRESA_ERRADA'
     AND r.qtd_vinculo_real = 0 AND r.qtd_dependencia_qualitativa = 0, false),
  COALESCE(r.acao_calc = 'ZERAR_SALDO_REPLICADO'
     AND r.saldo_replicado_suspeito
     AND r.qtd_vinculo_real = 0 AND r.qtd_dependencia_qualitativa = 0, false),
  CASE
    WHEN r.qtd_vinculo_real > 0                              THEN 'VINCULO_REAL'
    WHEN r.categoria_calc = 'AMBIGUA_MULTIPLOS_TOKENS'       THEN 'AMBIGUIDADE_TOKEN'
    WHEN r.qtd_dependencia_qualitativa > 0                   THEN 'DEPENDENCIA_QUALITATIVA'
    ELSE NULL
  END,
  r.acao_calc
FROM risco r;

DO $$
DECLARE esperado int; inseridas int;
BEGIN
  SELECT count(*) INTO esperado FROM public.conta_contabil
   WHERE public._aud_normaliza_texto(tipo::text)='ANALITICA' OR tipo IS NULL;
  SELECT count(*) INTO inseridas FROM public.aud_plano_contas_origem_diagnostico
   WHERE batch_id='p3d-v33-lf-documentada';
  IF esperado <> inseridas THEN
    RAISE EXCEPTION 'TRAVADO_POR_DIVERGENCIA_CARGA_DIAGNOSTICO: esperado=% inseridas=%', esperado, inseridas;
  END IF;
END $$;

COMMIT;