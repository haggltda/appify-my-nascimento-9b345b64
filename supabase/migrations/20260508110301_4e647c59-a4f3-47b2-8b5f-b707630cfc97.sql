-- Bloco 5: Função de promoção mz_32 → lancamento_contabil/lancamento_partida
CREATE OR REPLACE FUNCTION public.mz_32_promover_razao(
  p_batch_id uuid,
  p_sigla text DEFAULT NULL,   -- opcional: promover apenas uma sigla (piloto)
  p_limit_mestres int DEFAULT NULL  -- opcional: limitar nº de id_lct_mestre
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_lct int := 0;
  v_inserted_part int := 0;
  v_skipped_dedup int := 0;
  v_started_at timestamptz := now();
  v_promotion_id uuid := gen_random_uuid();
BEGIN
  -- Permissão
  IF NOT (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'controladoria')) THEN
    RAISE EXCEPTION 'permissao_negada: requer admin ou controladoria';
  END IF;

  -- Tabela temporária com lct_mestres elegíveis (OK + balanceado)
  CREATE TEMP TABLE tmp_mestres_ok ON COMMIT DROP AS
  WITH base AS (
    SELECT
      m.id_lct_mestre,
      m.linha_csv,
      e.id            AS empresa_id,
      UPPER(e.nome_fantasia) AS sigla,
      cc.id           AS conta_contabil_id,
      cct.id          AS centro_custo_id,
      to_date(NULLIF(m.data_lancamento,''),'DD/MM/YYYY')  AS data_lcto,
      to_date(NULLIF(m.periodo,''),'DD/MM/YYYY')           AS competencia,
      COALESCE(NULLIF(m.valor_debito_razao,'')::numeric, 0)  AS vdeb,
      COALESCE(NULLIF(m.valor_credito_razao,'')::numeric, 0) AS vcre,
      m.historico,
      m.documento_origem,
      m.id_lct
    FROM public.mz_32_fato_razao_contabil m
    LEFT JOIN public.empresas e
      ON UPPER(e.nome_fantasia) = UPPER(m.empresa)
    LEFT JOIN public.conta_contabil cc
      ON cc.empresa_id = e.id AND cc.classificacao = m.codigo_conta
    LEFT JOIN public.centros_custo cct
      ON cct.empresa_id = e.id AND cct.codigo = m.centro_custo
    WHERE m.migration_batch_id = p_batch_id
  ),
  agg AS (
    SELECT id_lct_mestre,
           bool_and(empresa_id IS NOT NULL
                    AND conta_contabil_id IS NOT NULL
                    AND data_lcto IS NOT NULL
                    AND (vdeb + vcre) > 0
                   ) AS all_ok,
           ABS(SUM(vdeb) - SUM(vcre)) AS dif,
           MIN(empresa_id) AS empresa_id,
           MIN(sigla)      AS sigla,
           MIN(data_lcto)  AS data_lcto,
           MIN(competencia) AS competencia
    FROM base
    GROUP BY id_lct_mestre
  )
  SELECT id_lct_mestre, empresa_id, sigla, data_lcto, competencia
  FROM agg
  WHERE all_ok = true
    AND dif < 0.01
    AND (p_sigla IS NULL OR sigla = UPPER(p_sigla))
  ORDER BY data_lcto, id_lct_mestre
  LIMIT COALESCE(p_limit_mestres, 2147483647);

  -- Inserir lancamento_contabil (1 por id_lct_mestre)
  WITH ins AS (
    INSERT INTO public.lancamento_contabil
      (empresa_id, numero, data_lancamento, competencia, historico,
       valor_total, origem, origem_tipo, status, hash_dedup, created_by)
    SELECT
      t.empresa_id,
      'MZ32-' || t.id_lct_mestre,
      t.data_lcto,
      t.competencia,
      'Promoção razão MZ32 lct_mestre=' || t.id_lct_mestre,
      (SELECT COALESCE(SUM(NULLIF(b.valor_debito_razao,'')::numeric),0)
         FROM public.mz_32_fato_razao_contabil b
        WHERE b.migration_batch_id = p_batch_id
          AND b.id_lct_mestre = t.id_lct_mestre),
      'mz_32_razao',
      'mz_32_fato_razao_contabil',
      'efetivado'::lanc_status,
      'mz32:' || t.id_lct_mestre,
      auth.uid()
    FROM tmp_mestres_ok t
    ON CONFLICT (hash_dedup) DO NOTHING
    RETURNING id, hash_dedup
  )
  SELECT count(*) INTO v_inserted_lct FROM ins;

  -- Inserir partidas para os lct recém-criados (ou já existentes via hash_dedup)
  WITH src AS (
    SELECT
      lc.id AS lancamento_id,
      cc.id AS conta_contabil_id,
      cct.id AS centro_custo_id,
      m.valor_debito_razao,
      m.valor_credito_razao,
      m.historico,
      m.id_lct_mestre
    FROM public.mz_32_fato_razao_contabil m
    JOIN tmp_mestres_ok t ON t.id_lct_mestre = m.id_lct_mestre
    JOIN public.lancamento_contabil lc
      ON lc.hash_dedup = 'mz32:' || m.id_lct_mestre
    JOIN public.empresas e
      ON UPPER(e.nome_fantasia) = UPPER(m.empresa)
    JOIN public.conta_contabil cc
      ON cc.empresa_id = e.id AND cc.classificacao = m.codigo_conta
    LEFT JOIN public.centros_custo cct
      ON cct.empresa_id = e.id AND cct.codigo = m.centro_custo
    WHERE m.migration_batch_id = p_batch_id
      -- evita duplicar partidas se o lct já tinha sido promovido antes
      AND NOT EXISTS (
        SELECT 1 FROM public.lancamento_partida lp
        WHERE lp.lancamento_id = lc.id
      )
  ),
  ins_part AS (
    INSERT INTO public.lancamento_partida
      (lancamento_id, conta_contabil_id, centro_custo_id, dc, valor, historico)
    SELECT
      s.lancamento_id,
      s.conta_contabil_id,
      s.centro_custo_id,
      CASE WHEN COALESCE(NULLIF(s.valor_debito_razao,'')::numeric,0) > 0
           THEN 'D' ELSE 'C' END::dc_tipo,
      CASE WHEN COALESCE(NULLIF(s.valor_debito_razao,'')::numeric,0) > 0
           THEN NULLIF(s.valor_debito_razao,'')::numeric
           ELSE NULLIF(s.valor_credito_razao,'')::numeric END,
      s.historico
    FROM src s
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_part FROM ins_part;

  RETURN jsonb_build_object(
    'promotion_id', v_promotion_id,
    'batch_id', p_batch_id,
    'sigla_filtro', p_sigla,
    'limit_mestres', p_limit_mestres,
    'inserted_lancamentos', v_inserted_lct,
    'inserted_partidas', v_inserted_part,
    'started_at', v_started_at,
    'finished_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mz_32_promover_razao(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mz_32_promover_razao(uuid, text, int) TO authenticated;