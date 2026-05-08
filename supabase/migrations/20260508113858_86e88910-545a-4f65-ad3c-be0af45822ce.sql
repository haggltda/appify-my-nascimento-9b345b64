-- 1) PROCEDURE com COMMIT interno por chunk (resiliente a timeout HTTP)
CREATE OR REPLACE PROCEDURE public.mz_32_promover_razao_chunk(
  p_batch_id uuid,
  p_sigla text DEFAULT NULL,
  p_chunk_size int DEFAULT 2000
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_res jsonb;
  v_inserted int;
  v_total_lct int := 0;
  v_total_part int := 0;
  v_iter int := 0;
  v_t0 timestamptz;
BEGIN
  LOOP
    v_iter := v_iter + 1;
    v_t0 := clock_timestamp();
    v_res := public.mz_32_promover_razao(p_batch_id, p_sigla, p_chunk_size);
    v_inserted := (v_res->>'inserted_lancamentos')::int;

    INSERT INTO public.mz_32_promocao_log (batch_id, resultado)
    VALUES (p_batch_id,
            v_res || jsonb_build_object(
              'iter', v_iter,
              'duracao_ms', (extract(epoch from clock_timestamp()-v_t0)*1000)::int));

    v_total_lct  := v_total_lct  + v_inserted;
    v_total_part := v_total_part + (v_res->>'inserted_partidas')::int;

    COMMIT;

    RAISE NOTICE 'iter % sigla=% inseridos=%', v_iter, COALESCE(p_sigla,'TODAS'), v_inserted;
    EXIT WHEN v_inserted = 0;
  END LOOP;

  RAISE NOTICE 'TOTAL sigla=% lct=% partidas=% iters=%',
    COALESCE(p_sigla,'TODAS'), v_total_lct, v_total_part, v_iter;
END;$f$;

REVOKE ALL ON PROCEDURE public.mz_32_promover_razao_chunk(uuid,text,int) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE public.mz_32_promover_razao_chunk(uuid,text,int) TO authenticated;

-- 2) VIEW de status (staging vs promovido) — pt-BR friendly
CREATE OR REPLACE VIEW public.vw_mz_32_promocao_status AS
WITH staging AS (
  SELECT UPPER(empresa) AS sigla, count(DISTINCT id_lct_mestre) AS mestres_staging
    FROM public.mz_32_fato_razao_contabil
   WHERE migration_batch_id='49b75bd4-4a41-4014-a891-59e4057c159f'::uuid
   GROUP BY UPPER(empresa)
),
prom AS (
  SELECT UPPER(e.nome_fantasia) AS sigla, count(*) AS mestres_promovidos,
         COALESCE(sum(lc.valor_total),0) AS total_promovido
    FROM public.lancamento_contabil lc
    JOIN public.empresas e ON e.id=lc.empresa_id
   WHERE lc.origem='mz_32_razao'
   GROUP BY UPPER(e.nome_fantasia)
)
SELECT COALESCE(s.sigla, p.sigla) AS sigla,
       COALESCE(s.mestres_staging,0)    AS mestres_staging,
       COALESCE(p.mestres_promovidos,0) AS mestres_promovidos,
       COALESCE(s.mestres_staging,0) - COALESCE(p.mestres_promovidos,0) AS pendentes,
       CASE WHEN COALESCE(s.mestres_staging,0)=0 THEN 0
            ELSE round(100.0*COALESCE(p.mestres_promovidos,0)/s.mestres_staging,2)
       END AS pct_promovido,
       COALESCE(p.total_promovido,0) AS total_promovido_brl
  FROM staging s FULL OUTER JOIN prom p ON p.sigla = s.sigla
 ORDER BY s.mestres_staging DESC NULLS LAST;