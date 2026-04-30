CREATE OR REPLACE FUNCTION public.integration_materialize_staging(p_batch_file_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_file       record;
  v_layout     record;
  v_empresa    uuid;
  v_caller_emp uuid;
  v_is_admin   boolean;
  v_alias_map  jsonb := '{}'::jsonb;
  v_known_cols text[] := '{}';
  v_required   text[] := '{}';
  v_numeric    text[] := '{}';
  v_dates      text[] := '{}';
  v_inserted   int := 0;
  v_errors     int := 0;
  v_total      int := 0;
  v_col_list   text;
  v_select_list text;
  v_sql        text;
BEGIN
  SELECT bf.*, b.empresa_id AS batch_empresa
    INTO v_file
    FROM public.integration_batch_files bf
    JOIN public.integration_batches b ON b.id = bf.batch_id
   WHERE bf.id = p_batch_file_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_file não encontrado'; END IF;
  IF v_file.layout_detectado_id IS NULL THEN RAISE EXCEPTION 'arquivo sem layout detectado'; END IF;

  v_empresa := v_file.empresa_id;
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  SELECT empresa_id INTO v_caller_emp FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin AND (v_caller_emp IS NULL OR v_caller_emp <> v_empresa) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_layout FROM public.integration_layouts WHERE id = v_file.layout_detectado_id;

  WITH cols AS (
    SELECT nome_destino, nome_origem, aliases, obrigatorio, tipo_dado
      FROM public.integration_layout_columns
     WHERE layout_id = v_layout.id
  ), all_aliases AS (
    SELECT nome_destino, regexp_replace(lower(unaccent_safe(nome_origem)), '[^a-z0-9]+', '_', 'g') AS norm FROM cols
    UNION
    SELECT nome_destino, regexp_replace(lower(nome_destino), '[^a-z0-9]+', '_', 'g') FROM cols
    UNION
    SELECT c.nome_destino, regexp_replace(lower(unaccent_safe(a)), '[^a-z0-9]+', '_', 'g')
      FROM cols c, LATERAL unnest(coalesce(c.aliases,'{}'::text[])) a
  )
  SELECT coalesce(jsonb_object_agg(norm, nome_destino), '{}'::jsonb)
    INTO v_alias_map FROM all_aliases;

  SELECT array_agg(nome_destino) INTO v_known_cols FROM public.integration_layout_columns WHERE layout_id = v_layout.id;
  SELECT array_agg(nome_destino) INTO v_required FROM public.integration_layout_columns WHERE layout_id = v_layout.id AND obrigatorio = true;
  SELECT array_agg(nome_destino) INTO v_numeric  FROM public.integration_layout_columns WHERE layout_id = v_layout.id AND tipo_dado IN ('numero','numeric','decimal');
  SELECT array_agg(nome_destino) INTO v_dates    FROM public.integration_layout_columns WHERE layout_id = v_layout.id AND tipo_dado = 'data';

  DELETE FROM public.integration_validation_results WHERE batch_id = v_file.batch_id;
  EXECUTE format('DELETE FROM public.%I WHERE batch_id = %L', v_layout.staging_tabela, v_file.batch_id);

  UPDATE public.integration_batches
     SET status = 'processando'::integ_batch_status, updated_at = now(),
         total_linhas = 0, linhas_validas = 0, linhas_invalidas = 0
   WHERE id = v_file.batch_id;

  CREATE TEMP TABLE _stg_rows ON COMMIT DROP AS
  WITH raw AS (
    SELECT row_number() OVER ()::int AS idx, value AS row_json
      FROM jsonb_array_elements(p_rows)
  ), mapped AS (
    SELECT
      r.idx,
      r.row_json,
      coalesce(jsonb_object_agg(
        v_alias_map->>regexp_replace(lower(unaccent_safe(e.key)), '[^a-z0-9]+', '_', 'g'),
        e.value
      ) FILTER (WHERE v_alias_map ? regexp_replace(lower(unaccent_safe(e.key)), '[^a-z0-9]+', '_', 'g')),
      '{}'::jsonb) AS payload
    FROM raw r
    LEFT JOIN LATERAL jsonb_each(r.row_json) e ON true
    GROUP BY r.idx, r.row_json
  )
  SELECT idx, row_json, payload FROM mapped;

  SELECT count(*) INTO v_total FROM _stg_rows;

  -- Normalize date fields (added WHERE to satisfy safeupdate)
  IF v_dates IS NOT NULL AND array_length(v_dates,1) > 0 THEN
    UPDATE _stg_rows s
       SET payload = s.payload || coalesce((
         SELECT jsonb_object_agg(
           dcol,
           to_jsonb(
             CASE WHEN length(m[3])=2 THEN '20'||m[3] ELSE m[3] END
             || '-' || lpad(m[2],2,'0') || '-' || lpad(m[1],2,'0')
           )
         )
         FROM unnest(v_dates) dcol
         CROSS JOIN LATERAL (SELECT regexp_match(s.payload->>dcol, '^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$') AS m) x
         WHERE x.m IS NOT NULL
       ), '{}'::jsonb)
     WHERE s.idx IS NOT NULL;
  END IF;

  INSERT INTO public.integration_validation_results
    (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
  SELECT v_file.batch_id, v_empresa, 'OBRIGATORIO', 'bloqueante'::integ_validation_severity,
         s.idx, r, 'Campo obrigatório ausente: ' || r, NULL
    FROM _stg_rows s, unnest(coalesce(v_required,'{}'::text[])) r
   WHERE coalesce(s.payload->>r, '') = '';

  CREATE TEMP TABLE _bad_rows ON COMMIT DROP AS
  SELECT DISTINCT s.idx
    FROM _stg_rows s, unnest(coalesce(v_required,'{}'::text[])) r
   WHERE coalesce(s.payload->>r,'') = '';

  SELECT string_agg(quote_ident(c), ','), string_agg('(s.payload->>'||quote_literal(c)||')', ',')
    INTO v_col_list, v_select_list
    FROM unnest(coalesce(v_known_cols,'{}'::text[])) c;

  v_sql := format(
    'INSERT INTO public.%I (%s, batch_id, empresa_id, linha_origem, raw)
       SELECT %s, %L::uuid, %L::uuid, s.idx, s.payload
         FROM _stg_rows s
        WHERE s.idx NOT IN (SELECT idx FROM _bad_rows)',
    v_layout.staging_tabela, v_col_list, v_select_list,
    v_file.batch_id::text, v_empresa::text
  );
  EXECUTE v_sql;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT count(*) INTO v_errors FROM _bad_rows;

  WITH all_keys AS (
    SELECT DISTINCT e.key AS k
      FROM _stg_rows s, jsonb_each(s.row_json) e
  )
  INSERT INTO public.integration_validation_results
    (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
  SELECT v_file.batch_id, v_empresa, 'COLUNA_DESCONHECIDA',
         'informativo'::integ_validation_severity, NULL, k,
         'Coluna da planilha não mapeada (ignorada): ' || k, NULL
    FROM all_keys
   WHERE NOT (v_alias_map ? regexp_replace(lower(unaccent_safe(k)), '[^a-z0-9]+', '_', 'g'));

  UPDATE public.integration_batch_files
     SET linhas_inseridas = v_inserted,
         materializado_em = now()
   WHERE id = p_batch_file_id;

  UPDATE public.integration_batches
     SET total_linhas = v_total,
         linhas_validas = v_inserted,
         linhas_invalidas = v_errors,
         status = CASE WHEN v_errors > 0
                       THEN 'validado_com_erros'::integ_batch_status
                       ELSE 'validado_ok'::integ_batch_status END,
         updated_at = now()
   WHERE id = v_file.batch_id;

  RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors, 'total_processed', v_total);
END;
$function$;