-- =====================================================
-- MIGRATION #5 — VIEWS AUXILIARES
-- =====================================================
-- Importante: views security_invoker = true garantem que
-- as RLS das tabelas base sejam aplicadas ao usuário corrente.

-- =====================================================
-- 1) OBZ MENSAL (orçado consolidado)
-- =====================================================
CREATE OR REPLACE VIEW public.v_obz_mensal
WITH (security_invoker = true) AS
SELECT
  v.empresa_id,
  v.ano,
  v.versao,
  v.revisao,
  v.status            AS versao_status,
  p.mes,
  val.dre_linha_id,
  val.centro_custo_id,
  SUM(val.valor)      AS valor_orcado
FROM public.obz_valores val
JOIN public.obz_periodos p ON p.id = val.periodo_id
JOIN public.obz_versoes  v ON v.id = val.versao_id
GROUP BY v.empresa_id, v.ano, v.versao, v.revisao, v.status,
         p.mes, val.dre_linha_id, val.centro_custo_id;

-- =====================================================
-- 2) REALIZADO MENSAL
-- =====================================================
CREATE OR REPLACE VIEW public.v_realizado_mensal
WITH (security_invoker = true) AS
SELECT
  l.empresa_id,
  EXTRACT(YEAR  FROM l.data_competencia)::int AS ano,
  EXTRACT(MONTH FROM l.data_competencia)::int AS mes,
  l.dre_linha_id,
  l.centro_custo_id,
  SUM(l.valor)        AS valor_realizado,
  COUNT(*)            AS qtd_lancamentos
FROM public.realizado_lancamentos l
GROUP BY l.empresa_id,
         EXTRACT(YEAR  FROM l.data_competencia),
         EXTRACT(MONTH FROM l.data_competencia),
         l.dre_linha_id, l.centro_custo_id;

-- =====================================================
-- 3) DRE COMPARATIVO (orçado x realizado)
-- usa apenas a versão APROVADA por empresa/ano
-- =====================================================
CREATE OR REPLACE VIEW public.v_dre_comparativo
WITH (security_invoker = true) AS
WITH versao_aprovada AS (
  SELECT empresa_id, ano, id, versao, revisao
  FROM public.obz_versoes
  WHERE status = 'aprovada'
),
orcado AS (
  SELECT
    v.empresa_id, v.ano, p.mes,
    val.dre_linha_id, val.centro_custo_id,
    SUM(val.valor) AS valor_orcado
  FROM public.obz_valores val
  JOIN public.obz_periodos p ON p.id = val.periodo_id
  JOIN versao_aprovada v ON v.id = val.versao_id
  GROUP BY v.empresa_id, v.ano, p.mes, val.dre_linha_id, val.centro_custo_id
),
realizado AS (
  SELECT
    empresa_id, ano, mes, dre_linha_id, centro_custo_id, valor_realizado
  FROM public.v_realizado_mensal
)
SELECT
  COALESCE(o.empresa_id, r.empresa_id)           AS empresa_id,
  COALESCE(o.ano,        r.ano)                  AS ano,
  COALESCE(o.mes,        r.mes)                  AS mes,
  COALESCE(o.dre_linha_id, r.dre_linha_id)       AS dre_linha_id,
  COALESCE(o.centro_custo_id, r.centro_custo_id) AS centro_custo_id,
  COALESCE(o.valor_orcado, 0)                    AS valor_orcado,
  COALESCE(r.valor_realizado, 0)                 AS valor_realizado,
  COALESCE(r.valor_realizado, 0) - COALESCE(o.valor_orcado, 0) AS variacao_abs,
  CASE
    WHEN COALESCE(o.valor_orcado, 0) = 0 THEN NULL
    ELSE ROUND(
      ((COALESCE(r.valor_realizado, 0) - o.valor_orcado) / o.valor_orcado) * 100,
      2
    )
  END AS variacao_pct
FROM orcado o
FULL OUTER JOIN realizado r
  ON  o.empresa_id      = r.empresa_id
  AND o.ano             = r.ano
  AND o.mes             = r.mes
  AND o.dre_linha_id    = r.dre_linha_id
  AND o.centro_custo_id IS NOT DISTINCT FROM r.centro_custo_id;

-- =====================================================
-- 4) FLUXO DE CAIXA MENSAL (simplificado, baseado no realizado)
-- entradas = receitas; saídas = custos+despesas+tributos+financeiro
-- =====================================================
CREATE OR REPLACE VIEW public.v_fluxo_caixa_mensal
WITH (security_invoker = true) AS
SELECT
  l.empresa_id,
  EXTRACT(YEAR  FROM l.data_lancamento)::int AS ano,
  EXTRACT(MONTH FROM l.data_lancamento)::int AS mes,
  SUM(CASE WHEN d.natureza = 'receita'                                THEN l.valor ELSE 0 END) AS entradas,
  SUM(CASE WHEN d.natureza IN ('custo','despesa','tributo','financeiro','deducao') THEN l.valor ELSE 0 END) AS saidas,
  SUM(CASE WHEN d.natureza = 'receita'                                THEN l.valor
           WHEN d.natureza IN ('custo','despesa','tributo','financeiro','deducao') THEN -l.valor
           ELSE 0 END) AS saldo
FROM public.realizado_lancamentos l
LEFT JOIN public.dre_linhas d ON d.id = l.dre_linha_id
GROUP BY l.empresa_id,
         EXTRACT(YEAR  FROM l.data_lancamento),
         EXTRACT(MONTH FROM l.data_lancamento);

-- =====================================================
-- 5) IA CONTEXTO EMPRESA (resumo para prompt da IA)
-- =====================================================
CREATE OR REPLACE VIEW public.v_ia_contexto_empresa
WITH (security_invoker = true) AS
WITH ano_corr AS (
  SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS ano
),
ytd AS (
  SELECT
    c.empresa_id, c.ano,
    SUM(c.valor_orcado)     AS orcado_ytd,
    SUM(c.valor_realizado)  AS realizado_ytd,
    SUM(c.variacao_abs)     AS variacao_abs_ytd
  FROM public.v_dre_comparativo c, ano_corr a
  WHERE c.ano = a.ano
    AND c.mes <= EXTRACT(MONTH FROM CURRENT_DATE)::int
  GROUP BY c.empresa_id, c.ano
),
fluxo_ytd AS (
  SELECT
    f.empresa_id, f.ano,
    SUM(f.entradas) AS entradas_ytd,
    SUM(f.saidas)   AS saidas_ytd,
    SUM(f.saldo)    AS saldo_ytd
  FROM public.v_fluxo_caixa_mensal f, ano_corr a
  WHERE f.ano = a.ano
    AND f.mes <= EXTRACT(MONTH FROM CURRENT_DATE)::int
  GROUP BY f.empresa_id, f.ano
)
SELECT
  e.id            AS empresa_id,
  e.codigo,
  e.razao_social,
  COALESCE(y.ano, (SELECT ano FROM ano_corr))      AS ano_referencia,
  COALESCE(y.orcado_ytd, 0)                        AS orcado_ytd,
  COALESCE(y.realizado_ytd, 0)                     AS realizado_ytd,
  COALESCE(y.variacao_abs_ytd, 0)                  AS variacao_abs_ytd,
  COALESCE(f.entradas_ytd, 0)                      AS entradas_ytd,
  COALESCE(f.saidas_ytd, 0)                        AS saidas_ytd,
  COALESCE(f.saldo_ytd, 0)                         AS saldo_ytd
FROM public.empresas e
LEFT JOIN ytd       y ON y.empresa_id = e.id
LEFT JOIN fluxo_ytd f ON f.empresa_id = e.id
WHERE e.ativa = true;