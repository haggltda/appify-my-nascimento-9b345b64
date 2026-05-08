-- 1) View consolidada: realizado de mz_40 + projetado de mz_41
CREATE OR REPLACE VIEW public.v_fluxo_caixa_consolidado AS
WITH base AS (
  -- Realizado a partir da MZ40
  SELECT
    e.id AS empresa_id,
    NULLIF(m.data_caixa,'')::date AS data_caixa,
    NULLIF(m.valor,'')::numeric AS valor,
    CASE WHEN m.tipo_movimento ILIKE 'ENTRADA%' THEN 'entrada' ELSE 'saida' END AS direcao,
    'realizado'::text AS regime
  FROM public.mz_40_fato_fluxo_caixa_realizado m
  JOIN public.empresas e ON e.codigo = m.empresa
  WHERE COALESCE(m.data_caixa,'') <> ''
    AND COALESCE(m.valor,'0') <> ''

  UNION ALL
  -- Projetado a partir da MZ41
  SELECT
    e.id,
    NULLIF(p.data_prevista,'')::date,
    NULLIF(p.valor_previsto,'')::numeric,
    CASE WHEN p.tipo_movimento ILIKE 'ENTRADA%' THEN 'entrada' ELSE 'saida' END,
    'projetado'
  FROM public.mz_41_fato_fluxo_caixa_projetado p
  JOIN public.empresas e ON e.codigo = p.empresa
  WHERE COALESCE(p.data_prevista,'') <> ''
    AND COALESCE(p.valor_previsto,'0') <> ''
)
SELECT
  empresa_id,
  EXTRACT(year  FROM data_caixa)::int AS ano,
  EXTRACT(month FROM data_caixa)::int AS mes,
  regime,
  SUM(CASE WHEN direcao='entrada' THEN valor ELSE 0 END) AS entradas,
  SUM(CASE WHEN direcao='saida'   THEN valor ELSE 0 END) AS saidas,
  SUM(CASE WHEN direcao='entrada' THEN valor ELSE -valor END) AS saldo
FROM base
WHERE data_caixa IS NOT NULL
GROUP BY empresa_id, EXTRACT(year FROM data_caixa), EXTRACT(month FROM data_caixa), regime;

-- 2) RPC para a tela de Fluxo de Caixa Diário
DROP FUNCTION IF EXISTS public.fluxo_caixa_diario(uuid,date,date);
CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario(
  _empresa_id uuid,
  _data_ini date,
  _data_fim date
) RETURNS TABLE (
  bloco text,
  categoria text,
  dia date,
  valor numeric,
  saldo_inicial numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH emp AS (
    SELECT id, codigo FROM public.empresas WHERE id = _empresa_id
  ),
  mov AS (
    SELECT
      NULLIF(m.data_caixa,'')::date AS dia,
      NULLIF(m.valor,'0')::numeric  AS valor,
      m.tipo_movimento,
      m.classificacao_gerencial,
      COALESCE(NULLIF(m.conta_resultado_nome,''), 'Outros') AS categoria
    FROM public.mz_40_fato_fluxo_caixa_realizado m
    JOIN emp ON emp.codigo = m.empresa
    WHERE NULLIF(m.data_caixa,'') IS NOT NULL
      AND NULLIF(m.valor,'') IS NOT NULL
  ),
  classificado AS (
    SELECT
      CASE
        WHEN tipo_movimento ILIKE 'ENTRADA%' THEN 'ENTRADAS'
        WHEN classificacao_gerencial IN ('CUSTO','DESPESA') THEN 'SAIDAS_OP'
        ELSE 'SAIDAS_NAO_OP'
      END AS bloco,
      categoria,
      dia,
      CASE WHEN tipo_movimento ILIKE 'ENTRADA%' THEN valor ELSE -valor END AS valor_assinado
    FROM mov
  ),
  saldo_ini AS (
    SELECT COALESCE(SUM(valor_assinado),0) AS saldo
    FROM classificado
    WHERE dia < _data_ini
  )
  SELECT
    c.bloco,
    c.categoria,
    c.dia,
    SUM(c.valor_assinado)::numeric AS valor,
    (SELECT saldo FROM saldo_ini) AS saldo_inicial
  FROM classificado c
  WHERE c.dia BETWEEN _data_ini AND _data_fim
  GROUP BY c.bloco, c.categoria, c.dia;
$$;

GRANT EXECUTE ON FUNCTION public.fluxo_caixa_diario(uuid,date,date) TO authenticated;