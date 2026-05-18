
-- Promover 857 linhas do batch 11a48411 (fcr_raw_excel) para a tabela fato
INSERT INTO public.mz_40_fato_fluxo_caixa_realizado (
  migration_batch_id, arquivo_origem_carga, linha_csv,
  id_origem, arquivo_origem, linha_origem,
  fluxo, data_caixa, periodo_caixa,
  tipo_movimento, classificacao_original, historico,
  empresa, banco, valor,
  valor_entrada, valor_saida, valor_liquido,
  impacta_caixa, status_fluxo
)
SELECT
  r.batch_id,
  r.arquivo_origem,
  r.linha_origem::int,
  r.id_origem_texto,
  r.arquivo_origem,
  r.linha_origem::text,
  'realizado',
  r.data_caixa_derivada::text,
  to_char(r.data_caixa_derivada, 'YYYY-MM'),
  r.raw_json->>'tipo_movimento_normalizado',
  r.classificacao_excel_original,
  r.historico_original,
  r.empresa_id_origem_celula,
  r.banco_origem_texto,
  r.valor_numerico::text,
  CASE WHEN r.raw_json->>'tipo_movimento_normalizado'='entrada' THEN r.valor_numerico::text END,
  CASE WHEN r.raw_json->>'tipo_movimento_normalizado'='saida'   THEN r.valor_numerico::text END,
  r.valor_assinado_caixa::text,
  'sim',
  'carregado'
FROM public.fcr_raw_excel r
WHERE r.batch_id = '11a48411-2bd8-4548-bf59-7a20d2cec4ee'
  AND NOT EXISTS (
    SELECT 1 FROM public.mz_40_fato_fluxo_caixa_realizado f
    WHERE f.migration_batch_id = r.batch_id
      AND f.linha_csv = r.linha_origem::int
  );

-- Marcar batch como promovido
UPDATE public.fcr_batch
SET status = 'promovido',
    aprovado_em = now(),
    totais_promovidos = jsonb_build_object(
      'linhas', (SELECT count(*) FROM public.mz_40_fato_fluxo_caixa_realizado WHERE migration_batch_id='11a48411-2bd8-4548-bf59-7a20d2cec4ee'),
      'valor_total', (SELECT sum(valor_numerico) FROM public.fcr_raw_excel WHERE batch_id='11a48411-2bd8-4548-bf59-7a20d2cec4ee')
    ),
    ultimo_erro = NULL,
    updated_at = now()
WHERE id = '11a48411-2bd8-4548-bf59-7a20d2cec4ee';
