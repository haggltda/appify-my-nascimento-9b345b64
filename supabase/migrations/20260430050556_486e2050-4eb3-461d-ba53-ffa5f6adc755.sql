-- Fix materializer: stg_* uses batch_id, not batch_file_id
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

  DELETE FROM public.integration_validation_results
   WHERE batch_id = v_file.batch_id;

  -- Clean previous staging rows for this batch (re-materialize friendly)
  EXECUTE format('DELETE FROM public.%I WHERE batch_id = %L', v_layout.staging_tabela, v_file.batch_id);

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

    -- IMPORTANT: stg_* tables use batch_id (not batch_file_id)
    v_keys := array_append(v_keys, 'batch_id');
    v_vals := array_append(v_vals, quote_literal(v_file.batch_id::text) || '::uuid');
    v_keys := array_append(v_keys, 'empresa_id');
    v_vals := array_append(v_vals, quote_literal(v_empresa::text) || '::uuid');
    v_keys := array_append(v_keys, 'linha_origem');
    v_vals := array_append(v_vals, v_idx::text);
    v_keys := array_append(v_keys, 'raw');
    v_vals := array_append(v_vals, quote_literal(v_payload::text) || '::jsonb');

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

  RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors, 'total_processed', v_idx);
END;
$$;

-- Resolve alias function (admin-only)
CREATE OR REPLACE FUNCTION public.integration_resolve_alias(
  p_tipo text,                -- 'contratos'|'centros_custo'|'empresas'|'bancos'|'formas_pagamento'
  p_alias text,
  p_id_interno uuid,
  p_empresa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_id_col text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CASE p_tipo
    WHEN 'contratos'         THEN v_table := 'integration_alias_contratos';        v_id_col := 'contrato_id';
    WHEN 'centros_custo'     THEN v_table := 'integration_alias_centros_custo';    v_id_col := 'centro_custo_id';
    WHEN 'empresas'          THEN v_table := 'integration_alias_empresas';         v_id_col := 'empresa_destino_id';
    WHEN 'bancos'            THEN v_table := 'integration_alias_bancos';           v_id_col := 'banco_id';
    WHEN 'formas_pagamento'  THEN v_table := 'integration_alias_formas_pagamento'; v_id_col := 'forma_pagamento_id';
    ELSE RAISE EXCEPTION 'tipo de alias inválido: %', p_tipo;
  END CASE;

  EXECUTE format(
    'INSERT INTO public.%I (empresa_id, alias, %I, status, resolvido_em, resolvido_por)
     VALUES (%L, %L, %L, ''resolvido''::integ_alias_status, now(), %L)
     ON CONFLICT (empresa_id, alias) DO UPDATE
       SET %I = EXCLUDED.%I,
           status = ''resolvido''::integ_alias_status,
           resolvido_em = now(),
           resolvido_por = EXCLUDED.resolvido_por',
    v_table, v_id_col,
    p_empresa_id, p_alias, p_id_interno, auth.uid(),
    v_id_col, v_id_col
  );
END;
$$;

-- Promotion function
CREATE OR REPLACE FUNCTION public.integration_promote_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch    record;
  v_layout   record;
  v_empresa  uuid;
  v_promoted int := 0;
  v_skipped  int := 0;
  v_msg      text := '';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_batch FROM public.integration_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote não encontrado'; END IF;
  IF v_batch.status <> 'aprovado' THEN
    RAISE EXCEPTION 'lote precisa estar aprovado (status atual: %)', v_batch.status;
  END IF;

  v_empresa := v_batch.empresa_id;

  -- Discover layout(s) used in this batch via batch_files
  FOR v_layout IN
    SELECT DISTINCT l.codigo, l.staging_tabela, l.destino_tabela
      FROM public.integration_batch_files bf
      JOIN public.integration_layouts l ON l.id = bf.layout_detectado_id
     WHERE bf.batch_id = p_batch_id
       AND bf.layout_detectado_id IS NOT NULL
  LOOP
    IF v_layout.codigo = 'licitacoes_v1' THEN
      INSERT INTO public.licitacao
        (empresa_id, numero, objeto, orgao, modalidade, abertura, observacoes,
         status, batch_id, origem_carga)
      SELECT v_empresa,
             COALESCE(NULLIF(s.edital,''), 'LIC-' || s.linha_origem),
             s.objeto, NULL, s.fase, s.data_sessao,
             trim(both ' ' from concat_ws(' | ', s.cidade, s.uf, s.status_obs, s.empresa_obs)),
             'em_andamento'::licitacao_status, p_batch_id, 'integracao'
        FROM public.stg_licitacoes s
       WHERE s.batch_id = p_batch_id;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('licitacoes_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'contrato_master_v1' THEN
      INSERT INTO public.contrato
        (empresa_id, numero, objeto, vigencia_inicio, faturamento_mensal,
         observacoes, status, batch_id)
      SELECT v_empresa,
             COALESCE(NULLIF(s.numero_edital,''), 'CT-' || s.linha_origem),
             COALESCE(s.contrato_nome, 'Contrato sem nome'),
             COALESCE(s.data_inicio, CURRENT_DATE),
             COALESCE(s.valor_mensal, 0),
             concat_ws(' | ', 'Resp: ' || COALESCE(s.responsavel,''),
                              'Cidade: ' || COALESCE(s.cidade,''),
                              'Func: ' || COALESCE(s.quant_funcionarios::text,'')),
             'ativo'::contrato_status, p_batch_id
        FROM public.stg_contratos_master s
       WHERE s.batch_id = p_batch_id
         AND s.contrato_resolvido_id IS NULL;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('contrato_master_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'fluxo_realizado_v1' THEN
      INSERT INTO public.realizado_lancamentos
        (empresa_id, data_lancamento, valor, descricao, contraparte,
         classificadores, hash_dedup, batch_id, pendente_conta_contabil)
      SELECT v_empresa,
             COALESCE(s.data_lancamento, CURRENT_DATE),
             COALESCE(s.valor, 0),
             COALESCE(s.historico, s.classificacao),
             s.empresa_origem,
             jsonb_build_object(
               'classificacao', s.classificacao,
               'tipo', s.tipo,
               'centro_custo', s.centro_custo_origem,
               'banco', s.banco_origem,
               'forma_pagamento', s.forma_pagamento_origem
             ),
             encode(digest(
               coalesce(s.id_origem,'') || '|' ||
               coalesce(s.data_lancamento::text,'') || '|' ||
               coalesce(s.valor::text,'') || '|' ||
               coalesce(s.historico,''), 'sha256'), 'hex'),
             p_batch_id,
             (s.conta_contabil_resolvida_id IS NULL)
        FROM public.stg_fluxo_caixa_realizado s
       WHERE s.batch_id = p_batch_id
       ON CONFLICT (hash_dedup) DO NOTHING;
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('fluxo_realizado_v1: %s linhas; ', v_promoted);

    ELSE
      v_skipped := v_skipped + 1;
      v_msg := v_msg || format('%s: promoção não implementada; ', v_layout.codigo);
    END IF;
  END LOOP;

  UPDATE public.integration_batches
     SET status = 'carregado'::integ_batch_status,
         observacoes = COALESCE(observacoes,'') || E'\n[CARREGADO] ' || v_msg,
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN jsonb_build_object('layouts_skipped', v_skipped, 'detalhe', v_msg);
END;
$$;

GRANT EXECUTE ON FUNCTION public.integration_resolve_alias(text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.integration_promote_batch(uuid) TO authenticated;