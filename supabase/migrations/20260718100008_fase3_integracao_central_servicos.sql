-- FASE 3 (lote 6/6 — Integração + Central de Serviços) — remove
-- has_role(admin)/get_user_empresa da RLS e dos corpos de RPC.
--
-- BI e SST não têm nada pendente: o único objeto de BI (vw_bi_resumo_empresa)
-- é uma view security_invoker sem RLS própria, cujas tabelas de origem já
-- foram corrigidas nos lotes 1/2/4; SST/Recrutamento já foram fechados no
-- hotfix 20260717190008 (Fase 0).
--
-- Achados desta varredura (investigação prévia, confirmada por grep table a
-- table antes de escrever):
--   • 21 tabelas de Integração (lotes/arquivos/staging) num único DO-loop em
--     20260430044640, nunca redefinido — has_role(admin) OR empresa_id=
--     get_user_empresa(). Menu: 'integracao' (lotes/arquivos/staging) ou
--     'integracao-aliases' (as 6 tabelas de alias De/Para).
--   • integration_alias_contas_contabeis/integration_alias_dre usavam
--     has_role(admin) OR has_role('controladoria') SEM checar empresa_id
--     (apesar de a coluna existir) — qualquer 'controladoria' de qualquer
--     empresa lia/escrevia alias de qualquer outra. Corrigido junto.
--   • RPC integration_resolve_alias (SECURITY DEFINER, grava via EXECUTE
--     dinâmico — não passa pela RLS da tabela) tinha o mesmo gate
--     has_role(admin) OR has_role('controladoria') sem checar p_empresa_id
--     contra a empresa do chamador — o gap de tenant mais concreto achado
--     nesta lote. Corrigido: agora usa can_access, sem checar empresa (nem
--     precisa — acesso deixou de ser por empresa em qualquer lugar do
--     sistema, é só por perfil).
--   • RPCs integration_materialize_staging/integration_promote_batch/
--     integration_approve_batch/integration_reject_batch tinham has_role
--     (admin) [+ match de empresa em materialize_staging] direto no corpo,
--     não em RLS — substituídas por can_access.
--   • CS_DENUNCIAS/CS_DENUNCIAS_SYNC_LOG/CS_DENUNCIAS_RESPONSAVEIS: só
--     has_role(admin), sem dimensão de empresa (canal único). Trocado por
--     can_access(...,'central_servicos_denuncias',...) — o comentário
--     original já dizia que o controle "deveria" ser pelo painel de acesso,
--     mas a RLS ainda exigia o cargo admin literal, o que travava mesmo se o
--     admin desse o menu a alguém pelo painel. Escrita continua só via
--     service role (sync) — não havia policy de INSERT em CS_DENUNCIAS, não
--     criada agora (mantido como estava).
--   • CS_FORMULARIOS (cs_forms_select), CS_FORM_SETOR_GRUPO
--     (cs_form_setor_write) e CS_FORM_ACESSOS (insert/update/delete): mesmo
--     padrão, trocado por can_access(...,'central_servicos_formularios',...).
--     O resto do módulo Formulários já roda num sistema de capacidades
--     próprio (cs_form_cap), criado desde o início SEM bypass de admin —
--     não mexido.
--
-- Menu 'integracao'/'integracao-aliases' confirmados em app_menu
-- (20260519190953, modulo_codigo='admin'); 'central_servicos_denuncias' e
-- 'central_servicos_formularios' confirmados em 20260709000002/
-- 20260710000004.

-- ── integration_layouts / integration_layout_columns /
--    integration_layout_fingerprints / integration_validation_rules
--    (SELECT USING(true) mantido — catálogo de referência lido por todos;
--    só a escrita, hoje admin-only sem motivo, passa a ser por perfil) ────
DROP POLICY IF EXISTS "layouts_admin" ON public.integration_layouts;
CREATE POLICY layouts_admin ON public.integration_layouts FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "layoutcols_admin" ON public.integration_layout_columns;
CREATE POLICY layoutcols_admin ON public.integration_layout_columns FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "layoutfp_admin" ON public.integration_layout_fingerprints;
CREATE POLICY layoutfp_admin ON public.integration_layout_fingerprints FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "valrules_admin" ON public.integration_validation_rules;
CREATE POLICY valrules_admin ON public.integration_validation_rules FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao));

-- ── 16 tabelas de lote/staging (menu 'integracao') + 6 tabelas de alias
--    De/Para (menu 'integracao-aliases') — mesmo DO-loop de
--    20260430044640, agora via can_access ─────────────────────────────────
DO $outer$
DECLARE
  t text;
  tables text[] := ARRAY[
    'integration_batches','integration_batch_files','integration_parse_runs',
    'integration_validation_results','integration_load_runs','integration_load_run_items',
    'integration_reprocess_requests',
    'stg_licitacoes','stg_fluxo_caixa_realizado','stg_colaboradores_base','stg_colaboradores_ativos',
    'stg_clientes_cnpj','stg_contratos_master','stg_contratos_custos_wide','stg_contratos_custos_long',
    'stg_fluxo_caixa_projetado'
  ];
  alias_tables text[] := ARRAY[
    'integration_alias_contratos','integration_alias_centros_custo',
    'integration_alias_empresas','integration_alias_bancos','integration_alias_formas_pagamento',
    'integration_map_classificacao_contabil'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_access(auth.uid(), ''integracao'', ''visualizar''::app_acao))', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access(auth.uid(), ''integracao'', ''incluir''::app_acao))', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_access(auth.uid(), ''integracao'', ''alterar''::app_acao)) WITH CHECK (public.can_access(auth.uid(), ''integracao'', ''alterar''::app_acao))', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_access(auth.uid(), ''integracao'', ''excluir''::app_acao))', t || '_delete', t);
  END LOOP;

  FOREACH t IN ARRAY alias_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_access(auth.uid(), ''integracao-aliases'', ''visualizar''::app_acao))', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access(auth.uid(), ''integracao-aliases'', ''incluir''::app_acao))', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_access(auth.uid(), ''integracao-aliases'', ''alterar''::app_acao)) WITH CHECK (public.can_access(auth.uid(), ''integracao-aliases'', ''alterar''::app_acao))', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_access(auth.uid(), ''integracao-aliases'', ''excluir''::app_acao))', t || '_delete', t);
  END LOOP;
END $outer$;

-- ── integration_alias_contas_contabeis / integration_alias_dre (achado:
--    não checavam empresa_id nenhuma vez, apesar da coluna existir) ──────
DROP POLICY IF EXISTS "alias_contas_admin_ctrl_select" ON public.integration_alias_contas_contabeis;
CREATE POLICY alias_contas_select ON public.integration_alias_contas_contabeis FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-aliases', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "alias_contas_admin_ctrl_ins" ON public.integration_alias_contas_contabeis;
CREATE POLICY alias_contas_insert ON public.integration_alias_contas_contabeis FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'integracao-aliases', 'incluir'::app_acao));
DROP POLICY IF EXISTS "alias_contas_admin_ctrl_upd" ON public.integration_alias_contas_contabeis;
CREATE POLICY alias_contas_update ON public.integration_alias_contas_contabeis FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-aliases', 'alterar'::app_acao));

DROP POLICY IF EXISTS "alias_dre_admin_ctrl_select" ON public.integration_alias_dre;
CREATE POLICY alias_dre_select ON public.integration_alias_dre FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-aliases', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "alias_dre_admin_ctrl_ins" ON public.integration_alias_dre;
CREATE POLICY alias_dre_insert ON public.integration_alias_dre FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'integracao-aliases', 'incluir'::app_acao));
DROP POLICY IF EXISTS "alias_dre_admin_ctrl_upd" ON public.integration_alias_dre;
CREATE POLICY alias_dre_update ON public.integration_alias_dre FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-aliases', 'alterar'::app_acao));

-- ── RPC integration_resolve_alias (gap de tenant mais concreto: p_empresa_id
--    nunca era conferido contra a empresa do chamador) ────────────────────
CREATE OR REPLACE FUNCTION public.integration_resolve_alias(p_tipo text, p_alias text, p_id_interno text, p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table   text;
  v_id_col  text;
  v_is_uuid boolean := true;
  v_value   text;
BEGIN
  IF NOT public.can_access(auth.uid(), 'integracao-aliases', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CASE p_tipo
    WHEN 'contratos'         THEN v_table := 'integration_alias_contratos';        v_id_col := 'contrato_id';
    WHEN 'centros_custo'     THEN v_table := 'integration_alias_centros_custo';    v_id_col := 'centro_custo_id';
    WHEN 'empresas'          THEN v_table := 'integration_alias_empresas';         v_id_col := 'empresa_destino_id';
    WHEN 'bancos'            THEN v_table := 'integration_alias_bancos';           v_id_col := 'banco_id';
    WHEN 'formas_pagamento'  THEN v_table := 'integration_alias_formas_pagamento'; v_id_col := 'forma_pagamento'; v_is_uuid := false;
    WHEN 'contas_contabeis'  THEN v_table := 'integration_alias_contas_contabeis'; v_id_col := 'conta_contabil_id';
    WHEN 'dre'               THEN v_table := 'integration_alias_dre';              v_id_col := 'dre_linha_id';
    ELSE RAISE EXCEPTION 'tipo de alias inválido: %', p_tipo;
  END CASE;

  IF v_is_uuid THEN
    v_value := quote_literal(p_id_interno) || '::uuid';
  ELSE
    v_value := quote_literal(p_id_interno);
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (empresa_id, alias, %I, status, resolvido_em, resolvido_por)
     VALUES (%L, %L, %s, ''resolvido''::integ_alias_status, now(), %L)
     ON CONFLICT (empresa_id, alias) DO UPDATE
       SET %I = EXCLUDED.%I,
           status = ''resolvido''::integ_alias_status,
           resolvido_em = now(),
           resolvido_por = EXCLUDED.resolvido_por',
    v_table, v_id_col,
    p_empresa_id, p_alias, v_value, auth.uid(),
    v_id_col, v_id_col
  );
END;
$function$;

-- ── RPC integration_reject_batch ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.integration_reject_batch(p_batch_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.integration_batches
     SET status = 'rejeitado'::integ_batch_status,
         observacoes = COALESCE(observacoes,'') || E'\n[REJEITADO] ' || COALESCE(p_motivo,''),
         updated_at = now()
   WHERE id = p_batch_id;
END;
$$;

-- ── RPC integration_approve_batch ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.integration_approve_batch(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
BEGIN
  IF NOT public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao) THEN
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

-- ── RPC integration_materialize_staging ──────────────────────────────────
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
  c            text;
  expr         text;
BEGIN
  SELECT bf.*, b.empresa_id AS batch_empresa
    INTO v_file
    FROM public.integration_batch_files bf
    JOIN public.integration_batches b ON b.id = bf.batch_id
   WHERE bf.id = p_batch_file_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch_file não encontrado'; END IF;
  IF v_file.layout_detectado_id IS NULL THEN RAISE EXCEPTION 'arquivo sem layout detectado'; END IF;

  v_empresa := v_file.empresa_id;
  IF NOT public.can_access(auth.uid(), 'integracao', 'incluir'::app_acao) THEN
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

  -- Build per-column SELECT expressions with proper casts
  v_col_list := '';
  v_select_list := '';
  FOREACH c IN ARRAY coalesce(v_known_cols, '{}'::text[]) LOOP
    IF c = ANY(coalesce(v_numeric, '{}'::text[])) THEN
      expr := format(
        'NULLIF(regexp_replace(replace(replace(coalesce(s.payload->>%L,''''), ''.'', ''''), '','', ''.''), ''[^0-9.\-]'', '''', ''g''), '''')::numeric',
        c
      );
    ELSIF c = ANY(coalesce(v_dates, '{}'::text[])) THEN
      expr := format(
        '(CASE WHEN coalesce(s.payload->>%L,'''') ~ ''^\d{4}-\d{2}-\d{2}'' THEN (s.payload->>%L)::date ELSE NULL END)',
        c, c
      );
    ELSE
      expr := format('NULLIF(s.payload->>%L, '''')', c);
    END IF;
    IF v_col_list <> '' THEN
      v_col_list := v_col_list || ',';
      v_select_list := v_select_list || ',';
    END IF;
    v_col_list := v_col_list || quote_ident(c);
    v_select_list := v_select_list || expr;
  END LOOP;

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

-- ── RPC integration_promote_batch ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.integration_promote_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batch    record;
  v_layout   record;
  v_empresa  uuid;
  v_promoted int := 0;
  v_skipped  int := 0;
  v_msg      text := '';
BEGIN
  IF NOT public.can_access(auth.uid(), 'integracao', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_batch FROM public.integration_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote não encontrado'; END IF;
  IF v_batch.status <> 'aprovado' THEN
    RAISE EXCEPTION 'lote precisa estar aprovado (status atual: %)', v_batch.status;
  END IF;

  v_empresa := v_batch.empresa_id;

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

    ELSIF v_layout.codigo = 'colaborador_full_v1' THEN
      WITH src AS (
        SELECT
          v_empresa AS empresa_id,
          NULLIF(regexp_replace(coalesce(s.cpf,''), '[^0-9]', '', 'g'), '') AS cpf_norm,
          NULLIF(trim(s.nome), '') AS nome,
          s.linha_origem,
          NULLIF(trim(s.matricula), '') AS matricula,
          NULLIF(trim(s.cargo), '') AS cargo,
          s.salario_base,
          s.data_admissao, s.data_demissao, s.data_nascimento,
          NULLIF(trim(s.genero),'') AS genero,
          NULLIF(trim(s.email),'') AS email,
          NULLIF(trim(s.telefone),'') AS telefone,
          NULLIF(trim(s.rg),'') AS rg,
          NULLIF(trim(s.pis_pasep),'') AS pis_pasep,
          NULLIF(trim(s.departamento),'') AS departamento,
          NULLIF(trim(s.jornada),'') AS jornada,
          NULLIF(trim(s.cbo),'') AS cbo,
          NULLIF(trim(s.tipo_contrato),'') AS tipo_contrato,
          NULLIF(trim(s.gestor_direto),'') AS gestor_direto,
          NULLIF(trim(s.endereco_cep),'') AS endereco_cep,
          NULLIF(trim(s.endereco_rua),'') AS endereco_rua,
          NULLIF(trim(s.endereco_numero),'') AS endereco_numero,
          NULLIF(trim(s.endereco_bairro),'') AS endereco_bairro,
          NULLIF(trim(s.endereco_cidade),'') AS endereco_cidade,
          NULLIF(trim(s.endereco_uf),'') AS endereco_uf,
          NULLIF(trim(s.observacoes),'') AS observacoes,
          NULLIF(trim(s.filial), '') AS filial,
          NULLIF(trim(s.situacao), '') AS situacao
        FROM public.stg_colaboradores_base s
        WHERE s.batch_id = p_batch_id
          AND coalesce(s.valido, true) = true
      ), src_clean AS (
        SELECT * FROM src
         WHERE cpf_norm IS NOT NULL AND nome IS NOT NULL
      ), src_dedup AS (
        SELECT DISTINCT ON (empresa_id, cpf_norm) *
          FROM src_clean
         ORDER BY empresa_id, cpf_norm, linha_origem
      )
      INSERT INTO public.colaborador
        (empresa_id, cpf, nome, matricula, cargo, salario_base,
         data_admissao, data_demissao, data_nascimento, genero,
         email, telefone, rg, pis_pasep, departamento, jornada,
         cbo, tipo_contrato, gestor_direto,
         endereco_cep, endereco_rua, endereco_numero,
         endereco_bairro, endereco_cidade, endereco_uf,
         status, observacoes, batch_id)
      SELECT
        d.empresa_id, d.cpf_norm, d.nome, d.matricula, d.cargo,
        COALESCE(d.salario_base, 0),
        COALESCE(d.data_admissao, CURRENT_DATE),
        d.data_demissao, d.data_nascimento, d.genero,
        d.email, d.telefone, d.rg, d.pis_pasep, d.departamento, d.jornada,
        d.cbo, d.tipo_contrato, d.gestor_direto,
        d.endereco_cep, d.endereco_rua, d.endereco_numero,
        d.endereco_bairro, d.endereco_cidade, d.endereco_uf,
        CASE
          WHEN lower(coalesce(d.situacao,'')) LIKE '%demit%' THEN 'demitido'::colab_status
          WHEN lower(coalesce(d.situacao,'')) LIKE '%afast%' THEN 'afastado'::colab_status
          WHEN lower(coalesce(d.situacao,'')) LIKE '%feria%' THEN 'ferias'::colab_status
          WHEN d.data_demissao IS NOT NULL THEN 'demitido'::colab_status
          ELSE 'ativo'::colab_status
        END,
        NULLIF(concat_ws(' | ',
          NULLIF('Filial: ' || coalesce(d.filial,''), 'Filial: '),
          NULLIF('Situação: ' || coalesce(d.situacao,''), 'Situação: '),
          d.observacoes
        ), ''),
        p_batch_id
      FROM src_dedup d
      ON CONFLICT (empresa_id, cpf) DO UPDATE SET
        nome           = EXCLUDED.nome,
        matricula      = COALESCE(EXCLUDED.matricula, public.colaborador.matricula),
        cargo          = COALESCE(EXCLUDED.cargo, public.colaborador.cargo),
        salario_base   = CASE WHEN EXCLUDED.salario_base > 0 THEN EXCLUDED.salario_base ELSE public.colaborador.salario_base END,
        data_admissao  = COALESCE(EXCLUDED.data_admissao, public.colaborador.data_admissao),
        data_demissao  = COALESCE(EXCLUDED.data_demissao, public.colaborador.data_demissao),
        data_nascimento= COALESCE(EXCLUDED.data_nascimento, public.colaborador.data_nascimento),
        genero         = COALESCE(EXCLUDED.genero, public.colaborador.genero),
        email          = COALESCE(EXCLUDED.email, public.colaborador.email),
        telefone       = COALESCE(EXCLUDED.telefone, public.colaborador.telefone),
        rg             = COALESCE(EXCLUDED.rg, public.colaborador.rg),
        pis_pasep      = COALESCE(EXCLUDED.pis_pasep, public.colaborador.pis_pasep),
        departamento   = COALESCE(EXCLUDED.departamento, public.colaborador.departamento),
        jornada        = COALESCE(EXCLUDED.jornada, public.colaborador.jornada),
        cbo            = COALESCE(EXCLUDED.cbo, public.colaborador.cbo),
        tipo_contrato  = COALESCE(EXCLUDED.tipo_contrato, public.colaborador.tipo_contrato),
        gestor_direto  = COALESCE(EXCLUDED.gestor_direto, public.colaborador.gestor_direto),
        endereco_cep   = COALESCE(EXCLUDED.endereco_cep, public.colaborador.endereco_cep),
        endereco_rua   = COALESCE(EXCLUDED.endereco_rua, public.colaborador.endereco_rua),
        endereco_numero= COALESCE(EXCLUDED.endereco_numero, public.colaborador.endereco_numero),
        endereco_bairro= COALESCE(EXCLUDED.endereco_bairro, public.colaborador.endereco_bairro),
        endereco_cidade= COALESCE(EXCLUDED.endereco_cidade, public.colaborador.endereco_cidade),
        endereco_uf    = COALESCE(EXCLUDED.endereco_uf, public.colaborador.endereco_uf),
        status         = EXCLUDED.status,
        observacoes    = COALESCE(EXCLUDED.observacoes, public.colaborador.observacoes),
        batch_id       = EXCLUDED.batch_id,
        updated_at     = now();
      GET DIAGNOSTICS v_promoted = ROW_COUNT;
      v_msg := v_msg || format('colaborador_full_v1: %s linhas; ', v_promoted);

    ELSIF v_layout.codigo = 'colaborador_ativo_v1' THEN
      v_skipped := v_skipped + 1;
      v_msg := v_msg || 'colaborador_ativo_v1: requer resolução de contrato/posto (não promovido automaticamente); ';

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
$function$;

-- ── CS_DENUNCIAS / CS_DENUNCIAS_SYNC_LOG / CS_DENUNCIAS_RESPONSAVEIS ─────
DROP POLICY IF EXISTS cs_denuncias_select_admin ON public."CS_DENUNCIAS";
CREATE POLICY cs_denuncias_select_admin ON public."CS_DENUNCIAS"
  FOR SELECT TO authenticated USING (public.can_access(auth.uid(), 'central_servicos_denuncias', 'visualizar'::app_acao));

DROP POLICY IF EXISTS cs_denuncias_update_admin ON public."CS_DENUNCIAS";
CREATE POLICY cs_denuncias_update_admin ON public."CS_DENUNCIAS"
  FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'central_servicos_denuncias', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'central_servicos_denuncias', 'alterar'::app_acao));

DROP POLICY IF EXISTS cs_denuncias_sync_log_select_admin ON public."CS_DENUNCIAS_SYNC_LOG";
CREATE POLICY cs_denuncias_sync_log_select_admin ON public."CS_DENUNCIAS_SYNC_LOG"
  FOR SELECT TO authenticated USING (public.can_access(auth.uid(), 'central_servicos_denuncias', 'visualizar'::app_acao));

DROP POLICY IF EXISTS cs_denuncias_resp_select_admin ON public."CS_DENUNCIAS_RESPONSAVEIS";
CREATE POLICY cs_denuncias_resp_select_admin ON public."CS_DENUNCIAS_RESPONSAVEIS"
  FOR SELECT TO authenticated USING (public.can_access(auth.uid(), 'central_servicos_denuncias', 'visualizar'::app_acao));

DROP POLICY IF EXISTS cs_denuncias_resp_insert_admin ON public."CS_DENUNCIAS_RESPONSAVEIS";
CREATE POLICY cs_denuncias_resp_insert_admin ON public."CS_DENUNCIAS_RESPONSAVEIS"
  FOR INSERT TO authenticated WITH CHECK (public.can_access(auth.uid(), 'central_servicos_denuncias', 'incluir'::app_acao));

DROP POLICY IF EXISTS cs_denuncias_resp_delete_admin ON public."CS_DENUNCIAS_RESPONSAVEIS";
CREATE POLICY cs_denuncias_resp_delete_admin ON public."CS_DENUNCIAS_RESPONSAVEIS"
  FOR DELETE TO authenticated USING (public.can_access(auth.uid(), 'central_servicos_denuncias', 'excluir'::app_acao));

-- ── CS_FORMULARIOS (só a linha has_role(admin) dentro do OR) ─────────────
DROP POLICY IF EXISTS cs_forms_select ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_select ON public."CS_FORMULARIOS"
  FOR SELECT TO authenticated USING (
    status = 'publicado'
    OR public.can_access(auth.uid(), 'central_servicos_formularios', 'visualizar'::app_acao)
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a WHERE a.user_id = auth.uid()));

-- ── CS_FORM_SETOR_GRUPO (write era admin-only puro) ──────────────────────
DROP POLICY IF EXISTS cs_form_setor_write ON public."CS_FORM_SETOR_GRUPO";
CREATE POLICY cs_form_setor_write ON public."CS_FORM_SETOR_GRUPO"
  FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao));

-- ── CS_FORM_ACESSOS (papel<>'dashboard' exigia has_role(admin); papel=
--    'dashboard' continua sendo o próprio dono, não mexido) ───────────────
DROP POLICY IF EXISTS cs_form_acessos_insert ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_insert ON public."CS_FORM_ACESSOS"
  FOR INSERT TO authenticated WITH CHECK (
    (papel = 'dashboard' AND user_id = auth.uid())
    OR (papel <> 'dashboard' AND public.can_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao)));

DROP POLICY IF EXISTS cs_form_acessos_update ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_update ON public."CS_FORM_ACESSOS"
  FOR UPDATE TO authenticated
  USING ((papel = 'dashboard' AND user_id = auth.uid())
         OR (papel <> 'dashboard' AND public.can_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao)))
  WITH CHECK ((papel = 'dashboard' AND user_id = auth.uid())
         OR (papel <> 'dashboard' AND public.can_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao)));

DROP POLICY IF EXISTS cs_form_acessos_delete ON public."CS_FORM_ACESSOS";
CREATE POLICY cs_form_acessos_delete ON public."CS_FORM_ACESSOS"
  FOR DELETE TO authenticated USING (
    (papel = 'dashboard' AND user_id = auth.uid())
    OR (papel <> 'dashboard' AND public.can_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao)));

NOTIFY pgrst, 'reload schema';
