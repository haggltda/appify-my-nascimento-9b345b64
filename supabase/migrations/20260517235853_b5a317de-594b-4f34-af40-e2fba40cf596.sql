
-- B) RPCs consolidadas com validação server-side de permissão
CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario_consolidado(_data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric, saldo_inicial numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'presidencia'::app_role)
    OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin, presidencia ou diretor_adm';
  END IF;

  RETURN QUERY
  WITH emp AS (
    SELECT id, codigo FROM public.empresas WHERE ativa = true
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
        WHEN mv.tipo_movimento ILIKE 'ENTRADA%' THEN 'ENTRADAS'
        WHEN mv.classificacao_gerencial IN ('CUSTO','DESPESA') THEN 'SAIDAS_OP'
        ELSE 'SAIDAS_NAO_OP'
      END AS bloco,
      mv.categoria, mv.dia,
      CASE WHEN mv.tipo_movimento ILIKE 'ENTRADA%' THEN mv.valor ELSE -mv.valor END AS valor_assinado
    FROM mov mv
  ),
  ref_dt AS (
    SELECT MAX(data_referencia) AS dt
    FROM public.saldos_iniciais_caixa
    WHERE empresa_id IN (SELECT id FROM emp)
      AND data_referencia <= _data_ini
  ),
  saldo_base AS (
    SELECT COALESCE(SUM(valor),0) AS v
    FROM public.saldos_iniciais_caixa
    WHERE empresa_id IN (SELECT id FROM emp)
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
END;
$$;

CREATE OR REPLACE FUNCTION public.fluxo_caixa_diario_orcado_consolidado(_data_ini date, _data_fim date)
RETURNS TABLE(bloco text, categoria text, dia date, valor numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'presidencia'::app_role)
    OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin, presidencia ou diretor_adm';
  END IF;

  RETURN QUERY
  WITH emp AS (
    SELECT id, codigo FROM public.empresas WHERE ativa = true
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
        WHEN mv.tipo_movimento ILIKE 'ENTRADA%' OR COALESCE(mv.v_ent,0) > 0 THEN 'ENTRADAS'
        WHEN mv.classificacao_gerencial IN ('CUSTO','DESPESA') THEN 'SAIDAS_OP'
        ELSE 'SAIDAS_NAO_OP'
      END AS bloco,
      mv.categoria, mv.dia,
      CASE
        WHEN mv.tipo_movimento ILIKE 'ENTRADA%' OR COALESCE(mv.v_ent,0) > 0
          THEN COALESCE(mv.v_ent, ABS(mv.valor_liq))
        ELSE -ABS(COALESCE(mv.v_sai, mv.valor_liq))
      END AS valor_assinado
    FROM mov mv
  )
  SELECT c.bloco, c.categoria, c.dia, SUM(c.valor_assinado)::numeric AS valor
  FROM classificado c
  WHERE c.dia BETWEEN _data_ini AND _data_fim
  GROUP BY c.bloco, c.categoria, c.dia;
END;
$$;

-- C) Permissão granular
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo)
SELECT r::app_role, 'financeiro', 'visualizar', 'financeiro.fluxo_caixa_diario.consolidado_empresas'
FROM unnest(ARRAY['admin','presidencia','diretor_adm']) AS r
ON CONFLICT DO NOTHING;
