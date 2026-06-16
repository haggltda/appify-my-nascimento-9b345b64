CREATE OR REPLACE VIEW public.v_fluxo_caixa_consolidado AS
WITH base AS (
  -- Realizado: partidas contábeis efetivadas em contas de Caixa/Bancos
  SELECT
    lc.empresa_id,
    lc.data_lancamento AS data_caixa,
    lp.valor,
    CASE WHEN lp.dc = 'D' THEN 'entrada' ELSE 'saida' END AS direcao,
    'realizado'::text AS regime
  FROM public.lancamento_partida lp
  JOIN public.lancamento_contabil lc ON lc.id = lp.lancamento_id
  JOIN public.conta_contabil cc ON cc.id = lp.conta_contabil_id
  WHERE lc.status = 'efetivado'
    AND cc.classificacao LIKE '01.1.1.0%'

  UNION ALL
  -- Realizado a partir de títulos pagos/recebidos
  SELECT
    tr.empresa_id,
    tr.data_recebimento,
    COALESCE(tr.valor_recebido, tr.valor),
    'entrada',
    'realizado'
  FROM public.titulo_receber tr
  WHERE tr.status = ANY (ARRAY['pago'::titulo_status,'parcial'::titulo_status])
    AND tr.data_recebimento IS NOT NULL

  UNION ALL
  SELECT
    tp.empresa_id,
    tp.data_pagamento,
    COALESCE(tp.valor_pago, tp.valor),
    'saida',
    'realizado'
  FROM public.titulo_pagar tp
  WHERE tp.status = ANY (ARRAY['pago'::titulo_status,'parcial'::titulo_status])
    AND tp.data_pagamento IS NOT NULL

  UNION ALL
  -- Projetado: títulos em aberto
  SELECT
    tr.empresa_id,
    tr.data_vencimento,
    tr.valor - COALESCE(tr.valor_recebido, 0::numeric),
    'entrada',
    'projetado'
  FROM public.titulo_receber tr
  WHERE tr.status = ANY (ARRAY['aberto'::titulo_status,'parcial'::titulo_status,'vencido'::titulo_status])

  UNION ALL
  SELECT
    tp.empresa_id,
    COALESCE(tp.data_agendamento, tp.data_vencimento),
    tp.valor - COALESCE(tp.valor_pago, 0::numeric),
    'saida',
    'projetado'
  FROM public.titulo_pagar tp
  WHERE tp.status = ANY (ARRAY['aberto'::titulo_status,'agendado'::titulo_status,'parcial'::titulo_status,'vencido'::titulo_status])
)
SELECT
  empresa_id,
  EXTRACT(year FROM data_caixa)::integer AS ano,
  EXTRACT(month FROM data_caixa)::integer AS mes,
  regime,
  SUM(CASE WHEN direcao='entrada' THEN valor ELSE 0 END) AS entradas,
  SUM(CASE WHEN direcao='saida'   THEN valor ELSE 0 END) AS saidas,
  SUM(CASE WHEN direcao='entrada' THEN valor ELSE -valor END) AS saldo
FROM base
WHERE data_caixa IS NOT NULL
GROUP BY empresa_id, EXTRACT(year FROM data_caixa), EXTRACT(month FROM data_caixa), regime;