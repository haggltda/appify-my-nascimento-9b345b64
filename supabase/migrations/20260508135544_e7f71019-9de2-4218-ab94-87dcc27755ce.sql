
CREATE OR REPLACE FUNCTION public.dre_gerencial_mensal(
  _empresa_id uuid,
  _ano integer,
  _versao_obz uuid DEFAULT NULL
)
RETURNS TABLE(
  dre_linha_id uuid,
  codigo text,
  descricao text,
  natureza text,
  ordem integer,
  mes integer,
  realizado numeric,
  orcado numeric,
  variacao numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH versao AS (
    SELECT id FROM public.obz_versoes
    WHERE empresa_id = _empresa_id
      AND ano = _ano
      AND (
        (_versao_obz IS NOT NULL AND id = _versao_obz)
        OR (_versao_obz IS NULL AND status = 'aprovada')
      )
    ORDER BY revisao DESC, versao DESC, updated_at DESC
    LIMIT 1
  ),
  meses AS (SELECT generate_series(1,12) AS mes),
  linhas AS (
    SELECT id, codigo, descricao, natureza::text AS natureza, ordem
    FROM public.dre_linhas
    WHERE (empresa_id = _empresa_id OR empresa_id IS NULL)
      AND ativo = true
  ),
  realizado_m AS (
    SELECT c.dre_linha_id,
           EXTRACT(MONTH FROM l.data_lancamento)::int AS mes,
           SUM(CASE WHEN p.dc='C' THEN p.valor ELSE -p.valor END) AS valor
    FROM public.lancamento_partida p
    JOIN public.lancamento_contabil l ON l.id = p.lancamento_id
    JOIN public.conta_contabil c ON c.id = p.conta_contabil_id
    WHERE l.empresa_id = _empresa_id
      AND l.status = 'efetivado'
      AND EXTRACT(YEAR FROM l.data_lancamento) = _ano
      AND c.dre_linha_id IS NOT NULL
    GROUP BY c.dre_linha_id, EXTRACT(MONTH FROM l.data_lancamento)
  ),
  orcado_m AS (
    SELECT v.dre_linha_id, per.mes, SUM(v.valor) AS valor
    FROM public.obz_valores v
    JOIN public.obz_periodos per ON per.id = v.periodo_id
    WHERE v.versao_id = (SELECT id FROM versao)
    GROUP BY v.dre_linha_id, per.mes
  )
  SELECT
    l.id,
    l.codigo,
    l.descricao,
    l.natureza,
    l.ordem,
    m.mes,
    COALESCE(r.valor, 0)::numeric AS realizado,
    COALESCE(o.valor, 0)::numeric AS orcado,
    (COALESCE(r.valor, 0) - COALESCE(o.valor, 0))::numeric AS variacao
  FROM linhas l
  CROSS JOIN meses m
  LEFT JOIN realizado_m r ON r.dre_linha_id = l.id AND r.mes = m.mes
  LEFT JOIN orcado_m o ON o.dre_linha_id = l.id AND o.mes = m.mes
  ORDER BY l.ordem, l.codigo, m.mes;
$$;

GRANT EXECUTE ON FUNCTION public.dre_gerencial_mensal(uuid, integer, uuid) TO authenticated;
