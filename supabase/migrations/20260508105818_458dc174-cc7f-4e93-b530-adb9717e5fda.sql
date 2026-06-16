
CREATE OR REPLACE FUNCTION public.mz_32_diagnosticar_razao(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria')) THEN
    RAISE EXCEPTION 'Acesso negado: requer role admin ou controladoria';
  END IF;

  WITH src AS (
    SELECT m.mz_id, m.id_lct_mestre,
      UPPER(TRIM(m.empresa)) AS sigla, e.id AS empresa_id,
      cc.id AS conta_contabil_id, ccu.id AS centro_custo_id,
      to_date(NULLIF(m.data_lancamento,''),'DD/MM/YYYY') AS data_lcto,
      to_date(NULLIF(m.periodo,''),'DD/MM/YYYY') AS competencia,
      COALESCE(NULLIF(REPLACE(REPLACE(m.valor_debito_razao,'.',''),',','.'),'')::numeric,0) AS deb,
      COALESCE(NULLIF(REPLACE(REPLACE(m.valor_credito_razao,'.',''),',','.'),'')::numeric,0) AS cre
    FROM public.mz_32_fato_razao_contabil m
    LEFT JOIN public.empresas e ON UPPER(e.nome_fantasia)=UPPER(TRIM(m.empresa))
    LEFT JOIN public.conta_contabil cc ON cc.empresa_id=e.id AND cc.classificacao=m.codigo_conta
    LEFT JOIN public.centros_custo ccu ON ccu.empresa_id=e.id AND ccu.codigo=m.centro_custo
    WHERE m.migration_batch_id = p_batch_id
  ),
  partida_status AS (
    SELECT *, CASE
      WHEN empresa_id IS NULL THEN 'PENDENTE_EMPRESA'
      WHEN conta_contabil_id IS NULL THEN 'PENDENTE_CONTA'
      WHEN deb=0 AND cre=0 THEN 'INVALIDO_VALOR_ZERO'
      WHEN data_lcto IS NULL THEN 'INVALIDO_DATA'
      ELSE 'OK' END AS s_partida
    FROM src
  ),
  -- Status do lct_mestre = pior status entre suas partidas
  lct_status AS (
    SELECT id_lct_mestre,
      MIN(empresa_id::text) AS empresa_ref,
      CASE
        WHEN bool_or(empresa_id IS NULL) THEN 'PENDENTE_EMPRESA'
        WHEN bool_or(conta_contabil_id IS NULL) THEN 'PENDENTE_CONTA'
        WHEN bool_or(data_lcto IS NULL) THEN 'INVALIDO_DATA'
        WHEN bool_and(deb=0 AND cre=0) THEN 'INVALIDO_VALOR_ZERO'
        WHEN ABS(sum(deb)-sum(cre)) >= 0.01 THEN 'DESBALANCEADO'
        ELSE 'OK'
      END AS s_lct,
      sum(deb) AS deb_lct, sum(cre) AS cre_lct, count(*) AS partidas
    FROM partida_status
    GROUP BY id_lct_mestre
  ),
  por_status_lct AS (
    SELECT s_lct AS status_lct, count(*) AS qt_lcts, sum(partidas) AS qt_partidas,
           round(sum(deb_lct)::numeric,2) AS deb, round(sum(cre_lct)::numeric,2) AS cre
    FROM lct_status GROUP BY s_lct
  ),
  por_empresa AS (
    SELECT COALESCE(sigla,'(vazio)') AS sigla, count(*) AS partidas,
           count(*) FILTER (WHERE s_partida='OK') AS partidas_ok,
           round(sum(deb)::numeric,2) AS deb, round(sum(cre)::numeric,2) AS cre
    FROM partida_status GROUP BY sigla
  )
  SELECT jsonb_build_object(
    'batch_id', p_batch_id,
    'gerado_em', now(),
    'totais_por_status_lct_mestre', (SELECT jsonb_agg(to_jsonb(p)) FROM por_status_lct p),
    'por_empresa_partidas', (SELECT jsonb_agg(to_jsonb(pe)) FROM por_empresa pe)
  ) INTO v_result;

  RETURN v_result;
END; $$;
