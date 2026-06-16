CREATE OR REPLACE FUNCTION public.mz_parse_num(p text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $f$
DECLARE s text := NULLIF(trim(p), '');
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  IF position(',' in s) > 0 THEN
    s := replace(replace(s, '.', ''), ',', '.');
  ELSIF (length(s) - length(replace(s,'.','')))::int >= 2 THEN
    s := replace(s, '.', '');
  END IF;
  RETURN s::numeric;
EXCEPTION WHEN others THEN RETURN NULL;
END;$f$;

CREATE TABLE IF NOT EXISTS public.mz_32_promocao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  resultado jsonb NOT NULL,
  executado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mz_32_promocao_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mz_32_promocao_log_admin ON public.mz_32_promocao_log;
CREATE POLICY mz_32_promocao_log_admin ON public.mz_32_promocao_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));

CREATE OR REPLACE FUNCTION public.mz_32_promover_razao(
  p_batch_id uuid, p_sigla text DEFAULT NULL, p_limit_mestres int DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_inserted_lct int := 0;
  v_inserted_part int := 0;
  v_started_at timestamptz := now();
  v_promotion_id uuid := gen_random_uuid();
  v_uid uuid := NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid;
BEGIN
  IF v_uid IS NOT NULL
     AND NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'controladoria')) THEN
    RAISE EXCEPTION 'permissao_negada: requer admin ou controladoria';
  END IF;

  CREATE TEMP TABLE tmp_mestres_ok ON COMMIT DROP AS
  WITH base AS (
    SELECT m.id_lct_mestre, e.id AS empresa_id, UPPER(e.nome_fantasia) AS sigla,
           cc.id AS conta_contabil_id,
           to_date(NULLIF(m.data_lancamento,''),'DD/MM/YYYY') AS data_lcto,
           to_date(NULLIF(m.periodo,'')||'-01','YYYY-MM-DD') AS competencia,
           COALESCE(public.mz_parse_num(m.valor_debito_razao),0) AS vdeb,
           COALESCE(public.mz_parse_num(m.valor_credito_razao),0) AS vcre
    FROM public.mz_32_fato_razao_contabil m
    LEFT JOIN public.empresas e ON UPPER(e.nome_fantasia)=UPPER(m.empresa)
    LEFT JOIN public.conta_contabil cc ON cc.empresa_id=e.id AND cc.classificacao=m.codigo_conta
    WHERE m.migration_batch_id = p_batch_id
  ),
  agg AS (
    SELECT id_lct_mestre,
           bool_and(empresa_id IS NOT NULL AND conta_contabil_id IS NOT NULL
                    AND data_lcto IS NOT NULL AND (vdeb+vcre)>0) AS all_ok,
           ABS(SUM(vdeb)-SUM(vcre)) AS dif,
           (array_agg(empresa_id))[1] AS empresa_id,
           (array_agg(sigla))[1] AS sigla,
           (array_agg(data_lcto ORDER BY data_lcto NULLS LAST))[1] AS data_lcto,
           (array_agg(competencia ORDER BY competencia NULLS LAST))[1] AS competencia
    FROM base GROUP BY id_lct_mestre
  )
  SELECT id_lct_mestre, empresa_id, sigla, data_lcto, competencia
  FROM agg
  WHERE all_ok AND dif < 0.01
    AND (p_sigla IS NULL OR sigla = UPPER(p_sigla))
    AND NOT EXISTS (SELECT 1 FROM public.lancamento_contabil lc
                    WHERE lc.hash_dedup = 'mz32:'||agg.id_lct_mestre)
  ORDER BY data_lcto, id_lct_mestre
  LIMIT COALESCE(p_limit_mestres, 2147483647);

  WITH ins AS (
    INSERT INTO public.lancamento_contabil
      (empresa_id, numero, data_lancamento, competencia, historico,
       valor_total, origem, origem_tipo, status, hash_dedup, created_by)
    SELECT t.empresa_id, 'MZ32-'||t.id_lct_mestre, t.data_lcto, t.competencia,
           'Promoção razão MZ32 lct_mestre='||t.id_lct_mestre,
           (SELECT COALESCE(SUM(public.mz_parse_num(b.valor_debito_razao)),0)
              FROM public.mz_32_fato_razao_contabil b
             WHERE b.migration_batch_id=p_batch_id AND b.id_lct_mestre=t.id_lct_mestre),
           'mz_32_razao','mz_32_fato_razao_contabil','efetivado'::lanc_status,
           'mz32:'||t.id_lct_mestre, v_uid
    FROM tmp_mestres_ok t
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_lct FROM ins;

  WITH src AS (
    SELECT lc.id AS lancamento_id, cc.id AS conta_contabil_id, cct.id AS centro_custo_id,
           public.mz_parse_num(m.valor_debito_razao)  AS vdeb,
           public.mz_parse_num(m.valor_credito_razao) AS vcre,
           m.historico
    FROM public.mz_32_fato_razao_contabil m
    JOIN tmp_mestres_ok t ON t.id_lct_mestre=m.id_lct_mestre
    JOIN public.lancamento_contabil lc ON lc.hash_dedup='mz32:'||m.id_lct_mestre
    JOIN public.empresas e ON UPPER(e.nome_fantasia)=UPPER(m.empresa)
    JOIN public.conta_contabil cc ON cc.empresa_id=e.id AND cc.classificacao=m.codigo_conta
    LEFT JOIN public.centros_custo cct ON cct.empresa_id=e.id AND cct.codigo=m.centro_custo
    WHERE m.migration_batch_id=p_batch_id
      AND NOT EXISTS (SELECT 1 FROM public.lancamento_partida lp WHERE lp.lancamento_id=lc.id)
  ), ins_part AS (
    INSERT INTO public.lancamento_partida
      (lancamento_id, conta_contabil_id, centro_custo_id, dc, valor, historico)
    SELECT s.lancamento_id, s.conta_contabil_id, s.centro_custo_id,
      CASE WHEN COALESCE(s.vdeb,0)>0 THEN 'D' ELSE 'C' END::partida_dc,
      CASE WHEN COALESCE(s.vdeb,0)>0 THEN s.vdeb ELSE s.vcre END,
      s.historico
    FROM src s
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_part FROM ins_part;

  RETURN jsonb_build_object(
    'promotion_id', v_promotion_id, 'batch_id', p_batch_id,
    'sigla_filtro', p_sigla, 'limit_mestres', p_limit_mestres,
    'inserted_lancamentos', v_inserted_lct,
    'inserted_partidas', v_inserted_part,
    'started_at', v_started_at, 'finished_at', now()
  );
END;$f$;

REVOKE ALL ON FUNCTION public.mz_32_promover_razao(uuid,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mz_32_promover_razao(uuid,text,int) TO authenticated;

INSERT INTO public.mz_32_promocao_log (batch_id, resultado)
SELECT '49b75bd4-4a41-4014-a891-59e4057c159f'::uuid,
       public.mz_32_promover_razao(
         '49b75bd4-4a41-4014-a891-59e4057c159f'::uuid, 'AGPS', 50);