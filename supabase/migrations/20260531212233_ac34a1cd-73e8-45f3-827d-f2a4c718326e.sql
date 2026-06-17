
BEGIN;

-- 1) Tabela
CREATE TABLE public.licitacao_importacao_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  arquivo_nome text,
  arquivo_hash text,
  total_linhas integer NOT NULL DEFAULT 0,
  total_inseridas integer NOT NULL DEFAULT 0,
  total_atualizadas integer NOT NULL DEFAULT 0,
  total_erros integer NOT NULL DEFAULT 0,
  total_ignoradas integer NOT NULL DEFAULT 0,
  pendencias_responsavel jsonb NOT NULL DEFAULT '[]'::jsonb,
  erros_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','validado','confirmado','cancelado','erro')),
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lic_imp_lote_empresa_status
  ON public.licitacao_importacao_lote (empresa_id, status, criado_em DESC);

-- 2) Grants
REVOKE ALL ON public.licitacao_importacao_lote FROM PUBLIC;
REVOKE ALL ON public.licitacao_importacao_lote FROM anon;
REVOKE ALL ON public.licitacao_importacao_lote FROM authenticated;
GRANT SELECT ON public.licitacao_importacao_lote TO authenticated;
GRANT ALL    ON public.licitacao_importacao_lote TO service_role;

-- 3) RLS sem FORCE
ALTER TABLE public.licitacao_importacao_lote ENABLE ROW LEVEL SECURITY;
CREATE POLICY lic_imp_lote_select
  ON public.licitacao_importacao_lote
  FOR SELECT TO authenticated
  USING ( public.user_pode_atuar_empresa(auth.uid(), empresa_id) );

-- 4) Trigger updated_at
CREATE TRIGGER tg_lic_imp_lote_updated_at_b
BEFORE UPDATE ON public.licitacao_importacao_lote
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RPC criar_lote
CREATE OR REPLACE FUNCTION public.licitacao_importacao_criar_lote(
  p_empresa uuid, p_arquivo_nome text, p_arquivo_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_lote uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado' USING ERRCODE='42501'; END IF;
  IF NOT public.user_pode_atuar_empresa(v_uid, p_empresa) THEN
    RAISE EXCEPTION 'empresa_fora_de_atuacao' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(v_uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'somente_admin_pode_importar_grade' USING ERRCODE='42501'; END IF;
  INSERT INTO public.licitacao_importacao_lote
    (empresa_id, arquivo_nome, arquivo_hash, criado_por, status)
  VALUES (p_empresa, p_arquivo_nome, p_arquivo_hash, v_uid, 'rascunho')
  RETURNING id INTO v_lote;
  RETURN v_lote;
END $$;

-- 6) RPC anexar_linhas (modo substituicao)
CREATE OR REPLACE FUNCTION public.licitacao_importacao_anexar_linhas(
  p_lote uuid, p_linhas jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN jsonb_build_object(
    'linhas_recebidas', v_idx,
    'linhas_validas',   v_ok,
    'linhas_invalidas', v_err);
END $$;

-- 7) RPC confirmar
CREATE OR REPLACE FUNCTION public.licitacao_importacao_confirmar(p_lote uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN jsonb_build_object(
    'lote', p_lote, 'inseridas', v_ins, 'atualizadas', v_upd,
    'ignoradas', v_ign,
    'pendencias_responsavel', jsonb_array_length(v_pend),
    'erros', jsonb_array_length(v_erros));
END $$;

-- 8) RPC cancelar
CREATE OR REPLACE FUNCTION public.licitacao_importacao_cancelar(p_lote uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_lote public.licitacao_importacao_lote;
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
     SET status='cancelado', finalizado_em=now()
   WHERE id = p_lote;
END $$;

-- 9) Grants das RPCs
REVOKE ALL ON FUNCTION public.licitacao_importacao_criar_lote(uuid,text,text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.licitacao_importacao_anexar_linhas(uuid,jsonb)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.licitacao_importacao_confirmar(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.licitacao_importacao_cancelar(uuid)                FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_criar_lote(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_anexar_linhas(uuid,jsonb)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_confirmar(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.licitacao_importacao_cancelar(uuid)             TO authenticated;

COMMIT;
