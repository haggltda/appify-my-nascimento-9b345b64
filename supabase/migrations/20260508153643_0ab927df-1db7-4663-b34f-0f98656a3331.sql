-- Permitir empresa_id NULL = consolidado em fluxo_caixa_diario
CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario(_empresa_id uuid, _data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric, saldo_inicial numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH emp AS (
    SELECT id, codigo FROM public.empresas
    WHERE (_empresa_id IS NULL AND ativa = true) OR (id = _empresa_id)
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
      categoria, dia,
      CASE WHEN tipo_movimento ILIKE 'ENTRADA%' THEN valor ELSE -valor END AS valor_assinado
    FROM mov
  ),
  ref_dt AS (
    SELECT MAX(data_referencia) AS dt
    FROM public.saldos_iniciais_caixa
    WHERE (_empresa_id IS NULL OR empresa_id = _empresa_id)
      AND data_referencia <= _data_ini
  ),
  saldo_base AS (
    SELECT COALESCE(SUM(valor),0) AS v
    FROM public.saldos_iniciais_caixa
    WHERE (_empresa_id IS NULL OR empresa_id = _empresa_id)
      AND data_referencia = (SELECT dt FROM ref_dt)
  ),
  saldo_mov_pre AS (
    SELECT COALESCE(SUM(valor_assinado),0) AS v
    FROM classificado
    WHERE dia >= COALESCE((SELECT dt FROM ref_dt), DATE '1900-01-01')
      AND dia < _data_ini
  )
  SELECT
    c.bloco, c.categoria, c.dia,
    SUM(c.valor_assinado)::numeric AS valor,
    ((SELECT v FROM saldo_base) + (SELECT v FROM saldo_mov_pre))::numeric AS saldo_inicial
  FROM classificado c
  WHERE c.dia BETWEEN _data_ini AND _data_fim
  GROUP BY c.bloco, c.categoria, c.dia;
$function$;

-- Nova RPC: fluxo de caixa diário ORÇADO/PROJETADO (mz_41)
CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario_orcado(_empresa_id uuid, _data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH emp AS (
    SELECT id, codigo FROM public.empresas
    WHERE (_empresa_id IS NULL AND ativa = true) OR (id = _empresa_id)
  ),
  mov AS (
    SELECT
      NULLIF(p.data_prevista,'')::date AS dia,
      COALESCE(NULLIF(p.valor_liquido_previsto,'')::numeric,
               NULLIF(p.valor_entrada_previsto,'')::numeric - NULLIF(p.valor_saida_previsto,'')::numeric,
               NULLIF(p.valor_previsto,'')::numeric, 0) AS valor_liq,
      NULLIF(p.valor_entrada_previsto,'')::numeric AS v_ent,
      NULLIF(p.valor_saida_previsto,'')::numeric AS v_sai,
      p.tipo_movimento,
      p.classificacao_gerencial,
      COALESCE(NULLIF(p.conta_resultado_nome,''), NULLIF(p.categoria_despesa,''), 'Outros') AS categoria
    FROM public.mz_41_fato_fluxo_caixa_projetado p
    JOIN emp ON emp.codigo = p.empresa
    WHERE NULLIF(p.data_prevista,'') IS NOT NULL
  ),
  classificado AS (
    SELECT
      CASE
        WHEN tipo_movimento ILIKE 'ENTRADA%' OR COALESCE(v_ent,0) > 0 THEN 'ENTRADAS'
        WHEN classificacao_gerencial IN ('CUSTO','DESPESA') THEN 'SAIDAS_OP'
        ELSE 'SAIDAS_NAO_OP'
      END AS bloco,
      categoria, dia,
      CASE
        WHEN tipo_movimento ILIKE 'ENTRADA%' OR COALESCE(v_ent,0) > 0
          THEN COALESCE(v_ent, ABS(valor_liq))
        ELSE -ABS(COALESCE(v_sai, valor_liq))
      END AS valor_assinado
    FROM mov
  )
  SELECT c.bloco, c.categoria, c.dia, SUM(c.valor_assinado)::numeric AS valor
  FROM classificado c
  WHERE c.dia BETWEEN _data_ini AND _data_fim
  GROUP BY c.bloco, c.categoria, c.dia;
$function$;