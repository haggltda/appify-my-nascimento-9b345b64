
CREATE OR REPLACE FUNCTION public.dre_gerencial_mensal(
  _empresa_id uuid,
  _ano integer,
  _versao_obz uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  dre_linha_id uuid, codigo text, descricao text, natureza text, ordem integer,
  mes integer, realizado numeric, orcado numeric, variacao numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH emp AS (SELECT id, codigo FROM public.empresas WHERE id = _empresa_id),
versao AS (
  SELECT id FROM public.obz_versoes
  WHERE empresa_id = _empresa_id AND ano = _ano
    AND ((_versao_obz IS NOT NULL AND id = _versao_obz)
         OR (_versao_obz IS NULL AND status = 'aprovada'))
  ORDER BY revisao DESC, versao DESC, updated_at DESC LIMIT 1
),
meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas
  WHERE ativo = true AND codigo LIKE 'L%'
    AND (empresa_id = _empresa_id OR empresa_id IS NULL)
),
partidas AS (
  SELECT
    EXTRACT(MONTH FROM NULLIF(p.data_competencia,'')::date)::int AS mes,
    CASE
      WHEN p.classificacao_gerencial = 'RECEITA'
           AND COALESCE(p.conta_credito_codigo,'') LIKE '03%' THEN 'L01'
      WHEN p.classificacao_gerencial = 'RECEITA'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '03%' THEN 'L02'
      WHEN p.classificacao_gerencial = 'CUSTO'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.1.3.02%' THEN 'L04'
      WHEN p.classificacao_gerencial = 'CUSTO'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.1.3.03%' THEN 'L05'
      WHEN p.classificacao_gerencial = 'DESPESA'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.1.02%' THEN 'L07'
      WHEN p.classificacao_gerencial = 'DESPESA'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.1.03%' THEN 'L08'
      WHEN p.classificacao_gerencial = 'DESPESA'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.2%' THEN 'L09'
      WHEN p.classificacao_gerencial = 'DESPESA'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.3%' THEN 'L10'
      WHEN COALESCE(p.conta_credito_codigo,'') LIKE '04.2.3%'
           OR COALESCE(p.conta_credito_codigo,'') LIKE '04.3%' THEN 'L11'
      WHEN p.classificacao_gerencial = 'DESPESA'
           AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.4%' THEN 'L12'
      ELSE NULL
    END AS linha_codigo,
    CASE
      WHEN p.classificacao_gerencial = 'RECEITA'
           AND COALESCE(p.conta_credito_codigo,'') LIKE '03%'
        THEN COALESCE(NULLIF(p.valor_credito,'')::numeric, 0)
      WHEN COALESCE(p.conta_credito_codigo,'') LIKE '04.2.3%'
        OR COALESCE(p.conta_credito_codigo,'') LIKE '04.3%'
        THEN COALESCE(NULLIF(p.valor_credito,'')::numeric, 0)
      ELSE -COALESCE(NULLIF(p.valor_debito,'')::numeric, 0)
    END AS valor
  FROM public.mz_31_fato_partidas_dobradas p
  JOIN emp e ON e.codigo = p.empresa
  WHERE NULLIF(p.data_competencia,'') IS NOT NULL
    AND EXTRACT(YEAR FROM NULLIF(p.data_competencia,'')::date) = _ano
    AND UPPER(COALESCE(p.impacta_dre,'')) IN ('SIM','S','TRUE','1','T')
),
realizado_base AS (
  SELECT linha_codigo, mes, SUM(valor) AS valor
  FROM partidas WHERE linha_codigo IS NOT NULL
  GROUP BY linha_codigo, mes
),
realizado_calc AS (
  SELECT linha_codigo, mes, valor FROM realizado_base
  UNION ALL
  SELECT 'L03', mes, SUM(valor) FROM realizado_base
   WHERE linha_codigo IN ('L01','L02') GROUP BY mes
  UNION ALL
  SELECT 'L06', mes, SUM(valor) FROM realizado_base
   WHERE linha_codigo IN ('L01','L02','L04','L05') GROUP BY mes
  UNION ALL
  SELECT 'L13', mes, SUM(valor) FROM realizado_base
   WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12') GROUP BY mes
  UNION ALL
  SELECT 'L14', mes, SUM(valor) FROM realizado_base
   WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12') GROUP BY mes
),
realizado_m AS (
  SELECT l.id AS dre_linha_id, rc.mes, SUM(rc.valor) AS valor
  FROM realizado_calc rc JOIN linhas l ON l.codigo = rc.linha_codigo
  GROUP BY l.id, rc.mes
),
orcado_m AS (
  SELECT v.dre_linha_id, per.mes, SUM(v.valor) AS valor
  FROM public.obz_valores v
  JOIN public.obz_periodos per ON per.id = v.periodo_id
  WHERE v.versao_id = (SELECT id FROM versao)
  GROUP BY v.dre_linha_id, per.mes
)
SELECT
  l.id, l.codigo, l.descricao, l.natureza, l.ordem, m.mes,
  COALESCE(r.valor, 0)::numeric AS realizado,
  COALESCE(o.valor, 0)::numeric AS orcado,
  (COALESCE(r.valor, 0) - COALESCE(o.valor, 0))::numeric AS variacao
FROM linhas l
CROSS JOIN meses m
LEFT JOIN realizado_m r ON r.dre_linha_id = l.id AND r.mes = m.mes
LEFT JOIN orcado_m o ON o.dre_linha_id = l.id AND o.mes = m.mes
ORDER BY l.ordem, l.codigo, m.mes;
$function$;
