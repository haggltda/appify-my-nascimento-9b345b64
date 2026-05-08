CREATE OR REPLACE FUNCTION public.balanco_patrimonial(_empresa_id uuid, _data_corte date)
RETURNS TABLE(grupo text, conta_id uuid, classificacao text, descricao text, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    CASE
      WHEN c.classificacao LIKE '01%' OR left(c.classificacao,1)='1' THEN 'ATIVO'
      WHEN c.classificacao LIKE '02.3%' THEN 'PATRIMONIO'
      WHEN c.classificacao LIKE '02%' OR left(c.classificacao,1)='2' THEN 'PASSIVO'
      WHEN left(c.classificacao,1)='3' THEN 'PATRIMONIO'
      ELSE 'PATRIMONIO'
    END,
    c.id, c.classificacao, c.descricao,
    c.saldo_inicial + COALESCE(SUM(CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END),0) * CASE WHEN c.natureza='C' THEN -1 ELSE 1 END
  FROM public.conta_contabil c
  LEFT JOIN public.lancamento_partida p ON p.conta_contabil_id=c.id
  LEFT JOIN public.lancamento_contabil l ON l.id=p.lancamento_id
   AND l.empresa_id=_empresa_id AND l.status='efetivado'
   AND l.data_lancamento <= _data_corte
  WHERE c.empresa_id=_empresa_id AND c.grupo_dre IN ('balanco','balanco_gerencial') AND c.tipo='analitica'
  GROUP BY c.id, c.classificacao, c.descricao, c.natureza, c.saldo_inicial
  ORDER BY c.classificacao;
$$;