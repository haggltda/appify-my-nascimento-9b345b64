
-- =====================================================
-- Onda A1 — Razão Detalhado: RPCs unificadas + saldo anterior
-- =====================================================

DROP FUNCTION IF EXISTS public.razao_unificado_listar(
  uuid, date, date, uuid, text, text, text, uuid, uuid, text, text, integer, integer, text, text
);
DROP FUNCTION IF EXISTS public.razao_unificado_listar(
  uuid, date, date, uuid, text, text, text, uuid, uuid, text, text, integer, integer
);
DROP FUNCTION IF EXISTS public.razao_saldo_anterior(
  uuid, date, uuid, text, text, text, uuid, uuid, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.razao_unificado_listar(
  _empresa_id            uuid,
  _data_ini              date,
  _data_fim              date,
  _conta_id              uuid    DEFAULT NULL,
  _classificacao_prefix  text    DEFAULT NULL,
  _natureza              text    DEFAULT NULL,
  _grupo_dre             text    DEFAULT NULL,
  _cc_id                 uuid    DEFAULT NULL,
  _contrato_id           uuid    DEFAULT NULL,
  _origem                text    DEFAULT NULL,
  _busca                 text    DEFAULT NULL,
  _classif_de            text    DEFAULT NULL,
  _classif_ate           text    DEFAULT NULL,
  _limit                 integer DEFAULT 50,
  _offset                integer DEFAULT 0
)
RETURNS TABLE(
  total_count      bigint,
  origem           text,
  data_lcto        date,
  lcto_numero      text,
  conta_classif    text,
  conta_desc       text,
  conta_natureza   text,
  conta_grupo      text,
  cc_codigo        text,
  cc_nome          text,
  contrato_num     text,
  historico        text,
  documento        text,
  debito           numeric,
  credito          numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc_codigo text;
  v_contrato_num text;
BEGIN
  -- pré-resolve códigos textuais para casar com mz_31 (que armazena texto)
  IF _cc_id IS NOT NULL THEN
    SELECT codigo INTO v_cc_codigo FROM centros_custo WHERE id = _cc_id;
  END IF;
  IF _contrato_id IS NOT NULL THEN
    SELECT numero INTO v_contrato_num FROM contrato WHERE id = _contrato_id;
  END IF;

  RETURN QUERY
  WITH oficial AS (
    SELECT
      'app'::text                                AS origem,
      lc.data_lancamento                         AS data_lcto,
      lc.numero                                  AS lcto_numero,
      cc.classificacao                           AS conta_classif,
      cc.descricao                               AS conta_desc,
      cc.natureza::text                          AS conta_natureza,
      cc.grupo_dre::text                         AS conta_grupo,
      ccu.codigo                                 AS cc_codigo,
      ccu.nome                                   AS cc_nome,
      ct.numero                                  AS contrato_num,
      COALESCE(lp.historico, lc.historico)       AS historico,
      lc.numero                                  AS documento,
      CASE WHEN lp.dc = 'D' THEN lp.valor ELSE 0 END AS debito,
      CASE WHEN lp.dc = 'C' THEN lp.valor ELSE 0 END AS credito
    FROM lancamento_partida lp
    JOIN lancamento_contabil lc ON lc.id = lp.lancamento_id
    JOIN conta_contabil cc      ON cc.id = lp.conta_contabil_id
    LEFT JOIN centros_custo ccu ON ccu.id = lp.centro_custo_id
    LEFT JOIN contrato ct       ON ct.centro_custo_id = lp.centro_custo_id
    WHERE lc.empresa_id = _empresa_id
      AND lc.data_lancamento BETWEEN _data_ini AND _data_fim
      AND (_conta_id IS NULL OR cc.id = _conta_id)
      AND (_classificacao_prefix IS NULL OR cc.classificacao LIKE _classificacao_prefix || '%')
      AND (_classif_de IS NULL  OR cc.classificacao >= _classif_de)
      AND (_classif_ate IS NULL OR cc.classificacao <= _classif_ate)
      AND (_natureza IS NULL OR cc.natureza::text = _natureza)
      AND (_grupo_dre IS NULL OR cc.grupo_dre::text = _grupo_dre)
      AND (_cc_id IS NULL OR lp.centro_custo_id = _cc_id)
      AND (_contrato_id IS NULL OR ct.id = _contrato_id)
      AND (_origem IS NULL OR _origem = 'app')
      AND (_busca IS NULL OR
            lp.historico ILIKE '%'||_busca||'%' OR
            lc.historico ILIKE '%'||_busca||'%' OR
            lc.numero    ILIKE '%'||_busca||'%' OR
            cc.descricao ILIKE '%'||_busca||'%')
  ),
  mz_base AS (
    SELECT
      NULLIF(m.data_competencia, '')::date AS data_lcto,
      m.id_lct                              AS lcto_numero,
      m.conta_debito_codigo                 AS cd_cod,
      m.conta_credito_codigo                AS cc_cod,
      NULLIF(replace(m.valor_debito, ',', '.'), '')::numeric  AS v_deb,
      NULLIF(replace(m.valor_credito, ',', '.'), '')::numeric AS v_cre,
      m.centro_custo                        AS cc_codigo,
      m.contrato                            AS contrato_num,
      m.historico                           AS historico,
      m.documento_origem                    AS documento
    FROM mz_31_fato_partidas_dobradas m
    WHERE NULLIF(m.data_competencia,'') IS NOT NULL
      AND NULLIF(m.data_competencia,'')::date BETWEEN _data_ini AND _data_fim
      AND (v_cc_codigo IS NULL OR m.centro_custo = v_cc_codigo)
      AND (v_contrato_num IS NULL OR m.contrato = v_contrato_num)
      AND (_origem IS NULL OR _origem = 'mz_carga')
  ),
  mz_d AS (
    SELECT
      'mz_carga'::text                            AS origem,
      b.data_lcto, b.lcto_numero,
      cc.classificacao                            AS conta_classif,
      cc.descricao                                AS conta_desc,
      cc.natureza::text                           AS conta_natureza,
      cc.grupo_dre::text                          AS conta_grupo,
      ccu.codigo                                  AS cc_codigo,
      ccu.nome                                    AS cc_nome,
      b.contrato_num,
      b.historico, b.documento,
      COALESCE(b.v_deb, 0) AS debito,
      0::numeric           AS credito
    FROM mz_base b
    JOIN conta_contabil cc ON cc.classificacao = b.cd_cod AND cc.empresa_id = _empresa_id
    LEFT JOIN centros_custo ccu ON ccu.codigo = b.cc_codigo AND ccu.empresa_id = _empresa_id
    WHERE b.v_deb IS NOT NULL AND b.v_deb > 0
  ),
  mz_c AS (
    SELECT
      'mz_carga'::text                            AS origem,
      b.data_lcto, b.lcto_numero,
      cc.classificacao                            AS conta_classif,
      cc.descricao                                AS conta_desc,
      cc.natureza::text                           AS conta_natureza,
      cc.grupo_dre::text                          AS conta_grupo,
      ccu.codigo                                  AS cc_codigo,
      ccu.nome                                    AS cc_nome,
      b.contrato_num,
      b.historico, b.documento,
      0::numeric           AS debito,
      COALESCE(b.v_cre, 0) AS credito
    FROM mz_base b
    JOIN conta_contabil cc ON cc.classificacao = b.cc_cod AND cc.empresa_id = _empresa_id
    LEFT JOIN centros_custo ccu ON ccu.codigo = b.cc_codigo AND ccu.empresa_id = _empresa_id
    WHERE b.v_cre IS NOT NULL AND b.v_cre > 0
  ),
  mz_filtrado AS (
    SELECT * FROM mz_d
    UNION ALL
    SELECT * FROM mz_c
  ),
  todos AS (
    SELECT * FROM oficial
    UNION ALL
    SELECT
      m.origem, m.data_lcto, m.lcto_numero,
      m.conta_classif, m.conta_desc, m.conta_natureza, m.conta_grupo,
      m.cc_codigo, m.cc_nome, m.contrato_num, m.historico, m.documento,
      m.debito, m.credito
    FROM mz_filtrado m
    WHERE (_conta_id IS NULL OR EXISTS (
              SELECT 1 FROM conta_contabil x
              WHERE x.id = _conta_id AND x.classificacao = m.conta_classif AND x.empresa_id = _empresa_id))
      AND (_classificacao_prefix IS NULL OR m.conta_classif LIKE _classificacao_prefix || '%')
      AND (_classif_de IS NULL OR m.conta_classif >= _classif_de)
      AND (_classif_ate IS NULL OR m.conta_classif <= _classif_ate)
      AND (_natureza IS NULL OR m.conta_natureza = _natureza)
      AND (_grupo_dre IS NULL OR m.conta_grupo = _grupo_dre)
      AND (_busca IS NULL OR
            m.historico ILIKE '%'||_busca||'%' OR
            COALESCE(m.documento,'') ILIKE '%'||_busca||'%' OR
            COALESCE(m.lcto_numero,'') ILIKE '%'||_busca||'%' OR
            COALESCE(m.conta_desc,'') ILIKE '%'||_busca||'%')
  )
  SELECT
    COUNT(*) OVER ()                AS total_count,
    t.origem, t.data_lcto, t.lcto_numero,
    t.conta_classif, t.conta_desc, t.conta_natureza, t.conta_grupo,
    t.cc_codigo, t.cc_nome, t.contrato_num, t.historico, t.documento,
    t.debito, t.credito
  FROM todos t
  ORDER BY t.data_lcto, t.lcto_numero, t.conta_classif
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

-- ----------- Saldo anterior (mesmos filtros, datas < _data_ini) -----------
CREATE OR REPLACE FUNCTION public.razao_saldo_anterior(
  _empresa_id            uuid,
  _data_ini              date,
  _conta_id              uuid    DEFAULT NULL,
  _classificacao_prefix  text    DEFAULT NULL,
  _natureza              text    DEFAULT NULL,
  _grupo_dre             text    DEFAULT NULL,
  _cc_id                 uuid    DEFAULT NULL,
  _contrato_id           uuid    DEFAULT NULL,
  _origem                text    DEFAULT NULL,
  _classif_de            text    DEFAULT NULL,
  _classif_ate           text    DEFAULT NULL
)
RETURNS TABLE(total_debito numeric, total_credito numeric, saldo numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc_codigo text;
  v_contrato_num text;
  v_d numeric := 0;
  v_c numeric := 0;
BEGIN
  IF _cc_id IS NOT NULL THEN
    SELECT codigo INTO v_cc_codigo FROM centros_custo WHERE id = _cc_id;
  END IF;
  IF _contrato_id IS NOT NULL THEN
    SELECT numero INTO v_contrato_num FROM contrato WHERE id = _contrato_id;
  END IF;

  -- oficial
  SELECT COALESCE(SUM(CASE WHEN lp.dc='D' THEN lp.valor ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN lp.dc='C' THEN lp.valor ELSE 0 END),0)
    INTO v_d, v_c
  FROM lancamento_partida lp
  JOIN lancamento_contabil lc ON lc.id = lp.lancamento_id
  JOIN conta_contabil cc      ON cc.id = lp.conta_contabil_id
  LEFT JOIN contrato ct       ON ct.centro_custo_id = lp.centro_custo_id
  WHERE lc.empresa_id = _empresa_id
    AND lc.data_lancamento < _data_ini
    AND (_conta_id IS NULL OR cc.id = _conta_id)
    AND (_classificacao_prefix IS NULL OR cc.classificacao LIKE _classificacao_prefix || '%')
    AND (_classif_de IS NULL  OR cc.classificacao >= _classif_de)
    AND (_classif_ate IS NULL OR cc.classificacao <= _classif_ate)
    AND (_natureza IS NULL OR cc.natureza::text = _natureza)
    AND (_grupo_dre IS NULL OR cc.grupo_dre::text = _grupo_dre)
    AND (_cc_id IS NULL OR lp.centro_custo_id = _cc_id)
    AND (_contrato_id IS NULL OR ct.id = _contrato_id)
    AND (_origem IS NULL OR _origem = 'app');

  -- mz_carga (somar débitos e créditos antes da data)
  IF _origem IS NULL OR _origem = 'mz_carga' THEN
    WITH mz_base AS (
      SELECT
        NULLIF(m.data_competencia,'')::date AS data_lcto,
        m.conta_debito_codigo  AS cd_cod,
        m.conta_credito_codigo AS cc_cod,
        NULLIF(replace(m.valor_debito,',','.'),'')::numeric  AS v_deb,
        NULLIF(replace(m.valor_credito,',','.'),'')::numeric AS v_cre,
        m.centro_custo AS cc_codigo,
        m.contrato     AS contrato_num
      FROM mz_31_fato_partidas_dobradas m
      WHERE NULLIF(m.data_competencia,'') IS NOT NULL
        AND NULLIF(m.data_competencia,'')::date < _data_ini
        AND (v_cc_codigo IS NULL OR m.centro_custo = v_cc_codigo)
        AND (v_contrato_num IS NULL OR m.contrato = v_contrato_num)
    )
    SELECT v_d + COALESCE(SUM(b.v_deb),0), v_c + COALESCE(SUM(b.v_cre),0)
      INTO v_d, v_c
    FROM mz_base b
    JOIN conta_contabil cc ON cc.empresa_id = _empresa_id
      AND (cc.classificacao = b.cd_cod OR cc.classificacao = b.cc_cod)
    WHERE (_conta_id IS NULL OR cc.id = _conta_id)
      AND (_classificacao_prefix IS NULL OR cc.classificacao LIKE _classificacao_prefix || '%')
      AND (_classif_de IS NULL OR cc.classificacao >= _classif_de)
      AND (_classif_ate IS NULL OR cc.classificacao <= _classif_ate)
      AND (_natureza IS NULL OR cc.natureza::text = _natureza)
      AND (_grupo_dre IS NULL OR cc.grupo_dre::text = _grupo_dre);
  END IF;

  RETURN QUERY SELECT v_d, v_c, (v_d - v_c);
END;
$$;

GRANT EXECUTE ON FUNCTION public.razao_unificado_listar(
  uuid,date,date,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,integer
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.razao_saldo_anterior(
  uuid,date,uuid,text,text,text,uuid,uuid,text,text,text
) TO anon, authenticated;
