CREATE OR REPLACE FUNCTION public.integration_approve_batch(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_pending
    FROM public.integration_validation_results
   WHERE batch_id = p_batch_id
     AND severidade = 'bloqueante'::integ_validation_severity
     AND resolvido = false;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Existem % erros bloqueantes pendentes neste lote.', v_pending;
  END IF;

  UPDATE public.integration_batches
     SET status = 'aprovado'::integ_batch_status,
         aprovado_em = now(),
         aprovado_por = auth.uid(),
         updated_at = now()
   WHERE id = p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.integration_materialize_staging(
  p_batch_file_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file       record;
  v_layout     record;
  v_empresa    uuid;
  v_caller_emp uuid;
  v_is_admin   boolean;
  v_col        record;
  v_alias_map  jsonb := '{}'::jsonb;
  v_required   text[] := '{}';
  v_numeric    text[] := '{}';
  v_known_cols text[] := '{}';
  v_row        jsonb;
  v_idx        int := 0;
  v_inserted   int := 0;
  v_errors     int := 0;
  v_keys       text[];
  v_vals       text[];
  v_sql        text;
  v_missing    text[];
  v_alias      text;
  v_payload    jsonb;
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

  FOR v_col IN
    SELECT nome_destino, nome_origem, aliases, obrigatorio, tipo_dado
      FROM public.integration_layout_columns
     WHERE layout_id = v_layout.id
  LOOP
    v_known_cols := array_append(v_known_cols, v_col.nome_destino);
    v_alias_map := v_alias_map || jsonb_build_object(
      regexp_replace(lower(unaccent_safe(v_col.nome_origem)), '[^a-z0-9]+', '_', 'g'),
      v_col.nome_destino
    );
    IF v_col.aliases IS NOT NULL THEN
      FOREACH v_alias IN ARRAY v_col.aliases LOOP
        v_alias_map := v_alias_map || jsonb_build_object(
          regexp_replace(lower(unaccent_safe(v_alias)), '[^a-z0-9]+', '_', 'g'),
          v_col.nome_destino
        );
      END LOOP;
    END IF;
    v_alias_map := v_alias_map || jsonb_build_object(
      regexp_replace(lower(v_col.nome_destino), '[^a-z0-9]+', '_', 'g'),
      v_col.nome_destino
    );
    IF v_col.obrigatorio THEN v_required := array_append(v_required, v_col.nome_destino); END IF;
    IF v_col.tipo_dado IN ('numero','numeric','decimal') THEN
      v_numeric := array_append(v_numeric, v_col.nome_destino);
    END IF;
  END LOOP;

  -- Clear previous validation results for this file's batch
  DELETE FROM public.integration_validation_results
   WHERE batch_id = v_file.batch_id;

  UPDATE public.integration_batches
     SET status = 'processando'::integ_batch_status, updated_at = now(),
         total_linhas = 0, linhas_validas = 0, linhas_invalidas = 0
   WHERE id = v_file.batch_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    v_payload := '{}'::jsonb;

    DECLARE
      k text; val jsonb; dest text; norm text;
    BEGIN
      FOR k, val IN SELECT * FROM jsonb_each(v_row) LOOP
        norm := regexp_replace(lower(unaccent_safe(k)), '[^a-z0-9]+', '_', 'g');
        dest := v_alias_map->>norm;
        IF dest IS NOT NULL THEN
          v_payload := v_payload || jsonb_build_object(dest, val);
        END IF;
      END LOOP;
    END;

    v_missing := ARRAY(
      SELECT r FROM unnest(v_required) r
       WHERE v_payload->>r IS NULL OR v_payload->>r = ''
    );
    IF array_length(v_missing,1) > 0 THEN
      INSERT INTO public.integration_validation_results
        (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
      SELECT v_file.batch_id, v_empresa, 'OBRIGATORIO', 'bloqueante'::integ_validation_severity,
             v_idx, m, 'Campo obrigatório ausente: ' || m, NULL
        FROM unnest(v_missing) m;
      v_errors := v_errors + array_length(v_missing,1);
      CONTINUE;
    END IF;

    DECLARE n text; bad boolean := false; col text;
    BEGIN
      FOREACH col IN ARRAY v_numeric LOOP
        n := v_payload->>col;
        IF n IS NOT NULL AND n <> '' THEN
          BEGIN
            PERFORM (regexp_replace(replace(n,',','.'), '[^0-9eE+\-.]', '', 'g'))::numeric;
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.integration_validation_results
              (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
            VALUES (v_file.batch_id, v_empresa, 'NUMERICO_INVALIDO',
                    'bloqueante'::integ_validation_severity, v_idx, col,
                    'Valor numérico inválido: ' || n, n);
            v_errors := v_errors + 1;
            bad := true;
          END;
        END IF;
      END LOOP;
      IF bad THEN CONTINUE; END IF;
    END;

    SELECT array_agg(quote_ident(key)),
           array_agg(quote_nullable(value))
      INTO v_keys, v_vals
      FROM (
        SELECT key, value
          FROM jsonb_each_text(v_payload)
         WHERE key = ANY(v_known_cols)
      ) t;

    v_keys := array_append(v_keys, 'batch_file_id');
    v_vals := array_append(v_vals, quote_literal(p_batch_file_id::text) || '::uuid');
    v_keys := array_append(v_keys, 'empresa_id');
    v_vals := array_append(v_vals, quote_literal(v_empresa::text) || '::uuid');
    v_keys := array_append(v_keys, 'linha_origem');
    v_vals := array_append(v_vals, v_idx::text);

    BEGIN
      v_sql := format('INSERT INTO public.%I (%s) VALUES (%s)',
                      v_layout.staging_tabela,
                      array_to_string(v_keys, ','),
                      array_to_string(v_vals, ','));
      EXECUTE v_sql;
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.integration_validation_results
        (batch_id, empresa_id, rule_codigo, severidade, linha_origem, campo, mensagem, valor_recebido)
      VALUES (v_file.batch_id, v_empresa, 'INSERT_FALHOU',
              'bloqueante'::integ_validation_severity, v_idx, NULL,
              'Falha ao inserir em staging: ' || SQLERRM, v_payload::text);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  UPDATE public.integration_batch_files
     SET linhas_inseridas = v_inserted,
         materializado_em = now()
   WHERE id = p_batch_file_id;

  UPDATE public.integration_batches
     SET total_linhas = COALESCE(total_linhas,0) + v_idx,
         linhas_validas = COALESCE(linhas_validas,0) + v_inserted,
         linhas_invalidas = COALESCE(linhas_invalidas,0) + v_errors,
         status = CASE WHEN v_errors > 0
                       THEN 'validado_com_erros'::integ_batch_status
                       ELSE 'validado_ok'::integ_batch_status END,
         updated_at = now()
   WHERE id = v_file.batch_id;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'errors', v_errors,
    'total_processed', v_idx
  );
END;
$$;