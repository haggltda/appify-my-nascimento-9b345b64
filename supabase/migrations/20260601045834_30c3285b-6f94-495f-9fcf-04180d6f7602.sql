-- =====================================================================
-- BLOCO_2A_FIX3_CORRIGIR_FK_STG_BATCH_ID_SQL_FINAL_OPCAO_2
-- =====================================================================

-- 1) licitacao_importacao_criar_lote
CREATE OR REPLACE FUNCTION public.licitacao_importacao_criar_lote(
  p_empresa uuid,
  p_arquivo_nome text,
  p_arquivo_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_lote   uuid := gen_random_uuid();
  v_codigo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_pode_atuar_empresa(v_uid, p_empresa) THEN
    RAISE EXCEPTION 'empresa_fora_de_atuacao' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'somente_admin_pode_importar_grade' USING ERRCODE = '42501';
  END IF;

  v_codigo := 'LIC-GRADE-'
           || to_char(now() AT TIME ZONE 'utc', 'YYYYMMDD-HH24MISS')
           || '-' || left(replace(v_lote::text, '-', ''), 8);

  INSERT INTO public.integration_batches (
    id, empresa_id, codigo, descricao, status,
    enviado_por, total_linhas, linhas_validas, linhas_invalidas,
    observacoes, metadata, created_at, updated_at
  ) VALUES (
    v_lote,
    p_empresa,
    v_codigo,
    COALESCE(NULLIF(p_arquivo_nome, ''), 'Importação Grade 2026'),
    'rascunho'::public.integ_batch_status,
    v_uid, 0, 0, 0,
    'Espelho técnico para stg_licitacoes.batch_id (fluxo licitacao_importacao_lote).',
    jsonb_build_object(
      'origem', 'licitacao_importacao_lote',
      'arquivo_nome', p_arquivo_nome,
      'arquivo_hash', p_arquivo_hash,
      'fluxo', 'grade_2026'
    ),
    now(), now()
  );

  INSERT INTO public.licitacao_importacao_lote (
    id, empresa_id, arquivo_nome, arquivo_hash,
    criado_por, status, criado_em, updated_at
  ) VALUES (
    v_lote, p_empresa, p_arquivo_nome, p_arquivo_hash,
    v_uid, 'rascunho', now(), now()
  );

  RETURN v_lote;
END
$function$;

-- 2) licitacao_importacao_anexar_linhas
CREATE OR REPLACE FUNCTION public.licitacao_importacao_anexar_linhas(
  p_lote uuid,
  p_linhas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote public.licitacao_importacao_lote;
  v_row jsonb; v_idx int := 0; v_ok int := 0; v_err int := 0;
  v_msg text; v_abertura date; v_valor numeric;
  v_numero text; v_orgao text; v_objeto text; v_status_txt text;
  v_erros jsonb := '[]'::jsonb;
  v_valid_status text[] := ARRAY['rascunho','oportunidade','em_andamento','vencida','perdida','cancelada'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_lote FROM public.licitacao_importacao_lote
   WHERE id = p_lote FOR UPDATE;
  IF v_lote.id IS NULL THEN RAISE EXCEPTION 'lote_inexistente'; END IF;
  IF NOT public.user_pode_atuar_empresa(v_uid, v_lote.empresa_id) THEN
    RAISE EXCEPTION 'empresa_fora_de_atuacao' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(v_uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'somente_admin' USING ERRCODE='42501'; END IF;
  IF v_lote.status <> 'rascunho' THEN
    RAISE EXCEPTION 'lote_nao_esta_em_rascunho' USING DETAIL = v_lote.status; END IF;
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'p_linhas_deve_ser_array'; END IF;

  DELETE FROM public.stg_licitacoes WHERE batch_id = p_lote;
  UPDATE public.licitacao_importacao_lote
     SET total_linhas = 0, total_erros = 0,
         erros_json = '[]'::jsonb, status = 'rascunho'
   WHERE id = p_lote;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    v_idx := v_idx + 1;
    v_msg := NULL; v_abertura := NULL; v_valor := NULL;
    v_numero := NULLIF(v_row->>'numero','');
    v_orgao  := NULLIF(v_row->>'orgao','');
    v_objeto := NULLIF(v_row->>'objeto','');
    v_status_txt := NULLIF(v_row->>'status','');

    IF v_numero IS NULL OR v_orgao IS NULL OR v_objeto IS NULL
       OR COALESCE(v_row->>'abertura','') = '' THEN
      v_msg := 'campos_obrigatorios_ausentes';
    END IF;
    IF v_msg IS NULL THEN
      BEGIN v_abertura := (v_row->>'abertura')::date;
      EXCEPTION WHEN others THEN v_msg := 'data_invalida'; END;
    END IF;
    IF v_msg IS NULL AND COALESCE(v_row->>'valor_estimado','') <> '' THEN
      BEGIN v_valor := (v_row->>'valor_estimado')::numeric;
      EXCEPTION WHEN others THEN v_msg := 'valor_estimado_invalido'; END;
    END IF;
    IF v_msg IS NULL AND v_status_txt IS NOT NULL
       AND NOT (v_status_txt = ANY(v_valid_status)) THEN
      v_msg := 'status_invalido';
    END IF;
    IF v_msg IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.stg_licitacoes s
         WHERE s.batch_id = p_lote AND s.valido = true
           AND s.empresa_id = v_lote.empresa_id
           AND (s.raw->>'orgao')  = v_orgao
           AND (s.raw->>'numero') = v_numero
           AND NULLIF(s.raw->>'abertura','')::date = v_abertura
      ) THEN v_msg := 'duplicada_no_lote'; END IF;
    END IF;

    INSERT INTO public.stg_licitacoes
      (batch_id, empresa_id, linha_origem, objeto, raw, valido, erro_msg,
       data_sessao, status_obs, local_prestacao)
    VALUES
      (p_lote, v_lote.empresa_id, v_idx, v_objeto, v_row,
       (v_msg IS NULL), v_msg, v_abertura, v_status_txt,
       v_row->>'local_prestacao');

    IF v_msg IS NULL THEN v_ok := v_ok + 1;
    ELSE v_err := v_err + 1;
         v_erros := v_erros || jsonb_build_object('linha', v_idx, 'erro', v_msg);
    END IF;
  END LOOP;

  UPDATE public.licitacao_importacao_lote
     SET total_linhas = v_idx, total_erros = v_err, erros_json = v_erros,
         status = CASE WHEN v_idx > 0 AND v_err = 0 THEN 'validado' ELSE 'rascunho' END
   WHERE id = p_lote;

  UPDATE public.integration_batches
     SET total_linhas     = v_idx,
         linhas_validas   = v_ok,
         linhas_invalidas = v_err,
         status = CASE
           WHEN v_idx = 0 THEN 'rascunho'::public.integ_batch_status
           WHEN v_err = 0 THEN 'validado_ok'::public.integ_batch_status
           ELSE 'validado_com_erros'::public.integ_batch_status
         END,
         updated_at = now()
   WHERE id = p_lote;

  RETURN jsonb_build_object(
    'linhas_recebidas', v_idx,
    'linhas_validas',   v_ok,
    'linhas_invalidas', v_err);
END
$function$;

-- 3) licitacao_importacao_confirmar
CREATE OR REPLACE FUNCTION public.licitacao_importacao_confirmar(p_lote uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote public.licitacao_importacao_lote;
  v_stg RECORD; v_existing public.licitacao;
  v_ins int := 0; v_upd int := 0; v_ign int := 0;
  v_pend jsonb := '[]'::jsonb; v_erros jsonb := '[]'::jsonb;
  v_resp_texto text; v_payload jsonb;
  v_status_eff public.licitacao_status;
  v_abertura date; v_valor numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_lote FROM public.licitacao_importacao_lote
   WHERE id = p_lote FOR UPDATE;
  IF v_lote.id IS NULL THEN RAISE EXCEPTION 'lote_inexistente'; END IF;
  IF NOT public.user_pode_atuar_empresa(v_uid, v_lote.empresa_id) THEN
    RAISE EXCEPTION 'empresa_fora_de_atuacao' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(v_uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'somente_admin' USING ERRCODE='42501'; END IF;
  IF v_lote.status NOT IN ('rascunho','validado') THEN
    RAISE EXCEPTION 'lote_nao_confirmavel' USING DETAIL = v_lote.status; END IF;
  IF EXISTS (SELECT 1 FROM public.stg_licitacoes
              WHERE batch_id = p_lote AND valido = false) THEN
    RAISE EXCEPTION 'lote_possui_linhas_invalidas'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stg_licitacoes
                  WHERE batch_id = p_lote AND valido = true) THEN
    RAISE EXCEPTION 'lote_sem_linhas_validas'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('lic_imp_confirm:' || v_lote.empresa_id::text, 0));

  FOR v_stg IN
    SELECT * FROM public.stg_licitacoes
     WHERE batch_id = p_lote AND valido = true
     ORDER BY linha_origem
  LOOP
    v_payload  := v_stg.raw;
    v_abertura := (v_payload->>'abertura')::date;
    v_valor    := NULLIF(v_payload->>'valor_estimado','')::numeric;
    v_status_eff := COALESCE(NULLIF(v_payload->>'status',''),'rascunho')::public.licitacao_status;

    SELECT * INTO v_existing FROM public.licitacao
     WHERE empresa_id = v_lote.empresa_id
       AND orgao  = v_payload->>'orgao'
       AND numero = v_payload->>'numero'
       AND abertura = v_abertura
     FOR UPDATE;

    v_resp_texto := NULL;
    IF COALESCE(v_payload->>'observacoes','') ~* 'Resp:[[:space:]]*[^|;]+' THEN
      v_resp_texto := btrim(regexp_replace(
        v_payload->>'observacoes',
        '.*Resp:[[:space:]]*([^|;]+).*',
        '\1',
        'i'));
    END IF;
    IF v_resp_texto IS NOT NULL
       AND (v_existing.id IS NULL OR v_existing.responsavel_user_id IS NULL) THEN
      v_pend := v_pend || jsonb_build_object(
        'linha', v_stg.linha_origem,
        'orgao', v_payload->>'orgao',
        'numero', v_payload->>'numero',
        'responsavel_texto', v_resp_texto);
    END IF;

    IF v_existing.id IS NULL THEN
      INSERT INTO public.licitacao
        (empresa_id, numero, objeto, orgao, modalidade,
         valor_estimado, status, abertura, observacoes,
         local_prestacao, origem_carga, batch_id)
      VALUES
        (v_lote.empresa_id,
         v_payload->>'numero',
         v_payload->>'objeto',
         v_payload->>'orgao',
         NULLIF(v_payload->>'modalidade',''),
         COALESCE(v_valor, 0),
         v_status_eff,
         v_abertura,
         NULLIF(v_payload->>'observacoes',''),
         NULLIF(v_payload->>'local_prestacao',''),
         'grade_import_' || p_lote::text,
         p_lote);
      v_ins := v_ins + 1;
    ELSE
      IF v_existing.status IN ('vencida','cancelada')
         AND v_status_eff <> v_existing.status THEN
        v_erros := v_erros || jsonb_build_object(
          'linha', v_stg.linha_origem, 'motivo','status_protegido',
          'status_atual', v_existing.status,
          'status_recebido', v_status_eff);
        v_ign := v_ign + 1;
        CONTINUE;
      END IF;
      UPDATE public.licitacao
         SET objeto          = COALESCE(NULLIF(v_payload->>'objeto',''), objeto),
             modalidade      = COALESCE(NULLIF(v_payload->>'modalidade',''), modalidade),
             valor_estimado  = COALESCE(v_valor, valor_estimado),
             status          = v_status_eff,
             observacoes     = COALESCE(NULLIF(v_payload->>'observacoes',''), observacoes),
             local_prestacao = COALESCE(NULLIF(v_payload->>'local_prestacao',''), local_prestacao),
             origem_carga    = 'grade_import_' || p_lote::text,
             batch_id        = p_lote,
             updated_at      = now()
       WHERE id = v_existing.id;
      v_upd := v_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.licitacao_importacao_lote
     SET total_inseridas = v_ins, total_atualizadas = v_upd, total_ignoradas = v_ign,
         erros_json = erros_json || v_erros,
         pendencias_responsavel = v_pend,
         status = 'confirmado', finalizado_em = now()
   WHERE id = p_lote;

  UPDATE public.integration_batches
     SET status = 'carregado'::public.integ_batch_status,
         updated_at = now()
   WHERE id = p_lote;

  RETURN jsonb_build_object(
    'lote', p_lote, 'inseridas', v_ins, 'atualizadas', v_upd,
    'ignoradas', v_ign,
    'pendencias_responsavel', jsonb_array_length(v_pend),
    'erros', jsonb_array_length(v_erros));
END
$function$;

-- 4) licitacao_importacao_cancelar
CREATE OR REPLACE FUNCTION public.licitacao_importacao_cancelar(p_lote uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote public.licitacao_importacao_lote;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_lote FROM public.licitacao_importacao_lote
   WHERE id = p_lote FOR UPDATE;
  IF v_lote.id IS NULL THEN RAISE EXCEPTION 'lote_inexistente'; END IF;
  IF NOT public.user_pode_atuar_empresa(v_uid, v_lote.empresa_id) THEN
    RAISE EXCEPTION 'empresa_fora_de_atuacao' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(v_uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'somente_admin' USING ERRCODE='42501'; END IF;
  IF v_lote.status NOT IN ('rascunho','validado') THEN
    RAISE EXCEPTION 'lote_nao_cancelavel_neste_status' USING DETAIL = v_lote.status; END IF;

  UPDATE public.licitacao_importacao_lote
     SET status = 'cancelado', finalizado_em = now()
   WHERE id = p_lote;

  UPDATE public.integration_batches
     SET status = 'arquivado'::public.integ_batch_status,
         updated_at = now()
   WHERE id = p_lote;
END
$function$;

-- 5) Hardening de EXECUTE
REVOKE ALL ON FUNCTION public.licitacao_importacao_criar_lote(uuid, text, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.licitacao_importacao_anexar_linhas(uuid, jsonb)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.licitacao_importacao_confirmar(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.licitacao_importacao_cancelar(uuid)                  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.licitacao_importacao_criar_lote(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_anexar_linhas(uuid, jsonb)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_confirmar(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_cancelar(uuid)               TO authenticated;