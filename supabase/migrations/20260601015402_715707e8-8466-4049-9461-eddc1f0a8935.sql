-- =====================================================================
-- BLOCO 2A.2A BDI M3 — RPCs (REV4)
-- =====================================================================

-- 1) Helper interno
CREATE OR REPLACE FUNCTION public._bdi_assert_responsavel(
  p_licitacao_id uuid,
  p_acao text
)
RETURNS TABLE(empresa_id uuid, responsavel_user_id uuid, status public.licitacao_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_emp uuid;
  v_resp uuid;
  v_st  public.licitacao_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  SELECT l.empresa_id, l.responsavel_user_id, l.status
    INTO v_emp, v_resp, v_st
  FROM public.licitacao l
  WHERE l.id = p_licitacao_id;

  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'LICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_pode_atuar_empresa(v_uid, v_emp) THEN
    RAISE EXCEPTION 'EMPRESA_SEM_ACESSO' USING ERRCODE = '42501';
  END IF;

  IF p_acao = 'visualizar' THEN
    IF NOT public.has_permissao(v_uid, 'licitacoes', 'visualizar', 'composicao') THEN
      RAISE EXCEPTION 'SEM_PERMISSAO_VISUALIZAR' USING ERRCODE = '42501';
    END IF;
  ELSIF p_acao = 'alterar' THEN
    IF NOT public.has_permissao(v_uid, 'licitacoes', 'alterar', 'composicao') THEN
      RAISE EXCEPTION 'SEM_PERMISSAO_ALTERAR' USING ERRCODE = '42501';
    END IF;
    IF v_resp IS NULL OR v_resp <> v_uid THEN
      RAISE EXCEPTION 'NAO_E_RESPONSAVEL_ATUAL' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'ACAO_INVALIDA: %', p_acao USING ERRCODE = '22023';
  END IF;

  empresa_id := v_emp;
  responsavel_user_id := v_resp;
  status := v_st;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public._bdi_assert_responsavel(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._bdi_assert_responsavel(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public._bdi_assert_responsavel(uuid,text) FROM authenticated;

-- 2) bdi_obter_versao
CREATE OR REPLACE FUNCTION public.bdi_obter_versao(p_licitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx record;
  v   public.bdi_versao%ROWTYPE;
BEGIN
  SELECT * INTO ctx FROM public._bdi_assert_responsavel(p_licitacao_id, 'visualizar');

  SELECT * INTO v
  FROM public.bdi_versao
  WHERE licitacao_id = p_licitacao_id
    AND empresa_id   = ctx.empresa_id
    AND status IN ('rascunho'::public.bdi_status,'em_revisao'::public.bdi_status)
  ORDER BY (status = 'rascunho'::public.bdi_status) DESC, created_at DESC
  LIMIT 1;

  IF v.id IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'empresa_id', ctx.empresa_id);
  END IF;

  RETURN jsonb_build_object('exists', true, 'versao', to_jsonb(v));
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_obter_versao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_obter_versao(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_obter_versao(uuid) FROM authenticated;

-- 3) bdi_criar_versao
CREATE OR REPLACE FUNCTION public.bdi_criar_versao(p_licitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx record;
  v_existing public.bdi_versao%ROWTYPE;
  v_new      public.bdi_versao%ROWTYPE;
  v_codigo   text;
BEGIN
  SELECT * INTO ctx FROM public._bdi_assert_responsavel(p_licitacao_id, 'alterar');

  PERFORM pg_advisory_xact_lock(hashtextextended('bdi:lic:'||p_licitacao_id::text, 0));

  SELECT * INTO v_existing
  FROM public.bdi_versao
  WHERE licitacao_id = p_licitacao_id
    AND empresa_id   = ctx.empresa_id
    AND status = 'rascunho'::public.bdi_status
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('created', false, 'versao', to_jsonb(v_existing));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bdi_versao
    WHERE licitacao_id = p_licitacao_id
      AND empresa_id   = ctx.empresa_id
      AND status = 'em_revisao'::public.bdi_status
  ) THEN
    RAISE EXCEPTION 'BDI_EM_REVISAO_BLOQUEIA_NOVA_VERSAO' USING ERRCODE = '55000';
  END IF;

  v_codigo := 'BDI-' || to_char(now(),'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text),1,6);

  INSERT INTO public.bdi_versao (empresa_id, licitacao_id, codigo, status, created_by)
  VALUES (ctx.empresa_id, p_licitacao_id, v_codigo, 'rascunho'::public.bdi_status, auth.uid())
  RETURNING * INTO v_new;

  RETURN jsonb_build_object('created', true, 'versao', to_jsonb(v_new));
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_criar_versao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_criar_versao(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_criar_versao(uuid) FROM authenticated;

-- 4) bdi_atualizar_versao
CREATE OR REPLACE FUNCTION public.bdi_atualizar_versao(
  p_versao_id uuid,
  p_payload   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_lic uuid;
  v_st  public.bdi_status;
  ctx   record;
  j     jsonb := COALESCE(p_payload::jsonb, '{}'::jsonb);
  r     public.bdi_versao%ROWTYPE;
BEGIN
  SELECT empresa_id, licitacao_id, status
    INTO v_emp, v_lic, v_st
  FROM public.bdi_versao WHERE id = p_versao_id;

  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002';
  END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN
    RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000';
  END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN
    RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501';
  END IF;

  UPDATE public.bdi_versao
     SET margem_pct          = COALESCE((j->>'margem_pct')::numeric,          margem_pct),
         tributos_pct        = COALESCE((j->>'tributos_pct')::numeric,        tributos_pct),
         custo_indireto_pct  = COALESCE((j->>'custo_indireto_pct')::numeric,  custo_indireto_pct),
         observacao          = COALESCE(j->>'observacao',                     observacao),
         descricao           = COALESCE(j->>'descricao',                      descricao),
         updated_at          = now()
   WHERE id = p_versao_id
     AND empresa_id = v_emp
     AND status = 'rascunho'::public.bdi_status
  RETURNING * INTO r;

  RETURN jsonb_build_object('ok', true, 'versao', to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_atualizar_versao(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_atualizar_versao(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_atualizar_versao(uuid,text) FROM authenticated;

-- 5) bdi_salvar_posto
CREATE OR REPLACE FUNCTION public.bdi_salvar_posto(
  p_versao_id        uuid,
  p_posto_id         uuid,
  p_cargo            text,
  p_qtd              integer,
  p_local            text,
  p_salario_base     numeric,
  p_va               numeric,
  p_vt               numeric,
  p_uniformes        numeric,
  p_epis             numeric,
  p_insalub_pct      numeric,
  p_pericul_pct      numeric,
  p_ordem            integer,
  p_observacao       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record;
  r public.bdi_posto%ROWTYPE;
BEGIN
  SELECT empresa_id, licitacao_id, status INTO v_emp, v_lic, v_st
  FROM public.bdi_versao WHERE id = p_versao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  IF p_posto_id IS NULL THEN
    INSERT INTO public.bdi_posto(empresa_id, bdi_versao_id, cargo, qtd, local,
      salario_base, va, vt, uniformes, epis, insalubridade_pct, periculosidade_pct, ordem, observacao)
    VALUES (v_emp, p_versao_id, p_cargo, COALESCE(p_qtd,0), p_local,
      COALESCE(p_salario_base,0), COALESCE(p_va,0), COALESCE(p_vt,0),
      COALESCE(p_uniformes,0), COALESCE(p_epis,0),
      COALESCE(p_insalub_pct,0), COALESCE(p_pericul_pct,0),
      COALESCE(p_ordem,0), p_observacao)
    RETURNING * INTO r;
  ELSE
    UPDATE public.bdi_posto SET
      cargo=p_cargo, qtd=COALESCE(p_qtd,qtd), local=p_local,
      salario_base=COALESCE(p_salario_base,salario_base),
      va=COALESCE(p_va,va), vt=COALESCE(p_vt,vt),
      uniformes=COALESCE(p_uniformes,uniformes), epis=COALESCE(p_epis,epis),
      insalubridade_pct=COALESCE(p_insalub_pct,insalubridade_pct),
      periculosidade_pct=COALESCE(p_pericul_pct,periculosidade_pct),
      ordem=COALESCE(p_ordem,ordem), observacao=p_observacao,
      updated_at=now()
    WHERE id=p_posto_id AND bdi_versao_id=p_versao_id AND empresa_id=v_emp
    RETURNING * INTO r;
    IF r.id IS NULL THEN RAISE EXCEPTION 'POSTO_NAO_ENCONTRADO' USING ERRCODE='P0002'; END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'posto', to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_salvar_posto(uuid,uuid,text,integer,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_salvar_posto(uuid,uuid,text,integer,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer,text) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_salvar_posto(uuid,uuid,text,integer,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer,text) FROM authenticated;

-- 6) bdi_excluir_posto
CREATE OR REPLACE FUNCTION public.bdi_excluir_posto(p_posto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record;
BEGIN
  SELECT p.empresa_id, v.licitacao_id, v.status
    INTO v_emp, v_lic, v_st
  FROM public.bdi_posto p
  JOIN public.bdi_versao v ON v.id = p.bdi_versao_id
  WHERE p.id = p_posto_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'POSTO_NAO_ENCONTRADO' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  DELETE FROM public.bdi_posto WHERE id = p_posto_id AND empresa_id = v_emp;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_excluir_posto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_excluir_posto(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_excluir_posto(uuid) FROM authenticated;

-- 7) bdi_salvar_verba
CREATE OR REPLACE FUNCTION public.bdi_salvar_verba(
  p_versao_id uuid, p_verba_id uuid, p_rubrica text,
  p_percentual numeric, p_ordem integer, p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record; r public.bdi_verba_folha%ROWTYPE;
BEGIN
  SELECT empresa_id, licitacao_id, status INTO v_emp, v_lic, v_st
  FROM public.bdi_versao WHERE id = p_versao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  IF p_verba_id IS NULL THEN
    INSERT INTO public.bdi_verba_folha(empresa_id, bdi_versao_id, rubrica, percentual, ordem, observacao)
    VALUES (v_emp, p_versao_id, p_rubrica, COALESCE(p_percentual,0), COALESCE(p_ordem,0), p_observacao)
    RETURNING * INTO r;
  ELSE
    UPDATE public.bdi_verba_folha SET
      rubrica=p_rubrica, percentual=COALESCE(p_percentual,percentual),
      ordem=COALESCE(p_ordem,ordem), observacao=p_observacao, updated_at=now()
    WHERE id=p_verba_id AND bdi_versao_id=p_versao_id AND empresa_id=v_emp
    RETURNING * INTO r;
    IF r.id IS NULL THEN RAISE EXCEPTION 'VERBA_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'verba', to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_salvar_verba(uuid,uuid,text,numeric,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_salvar_verba(uuid,uuid,text,numeric,integer,text) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_salvar_verba(uuid,uuid,text,numeric,integer,text) FROM authenticated;

-- 8) bdi_excluir_verba
CREATE OR REPLACE FUNCTION public.bdi_excluir_verba(p_verba_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record;
BEGIN
  SELECT b.empresa_id, v.licitacao_id, v.status
    INTO v_emp, v_lic, v_st
  FROM public.bdi_verba_folha b
  JOIN public.bdi_versao v ON v.id = b.bdi_versao_id
  WHERE b.id = p_verba_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERBA_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  DELETE FROM public.bdi_verba_folha WHERE id = p_verba_id AND empresa_id = v_emp;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_excluir_verba(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_excluir_verba(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_excluir_verba(uuid) FROM authenticated;

-- 9) bdi_salvar_item
CREATE OR REPLACE FUNCTION public.bdi_salvar_item(
  p_versao_id uuid,
  p_item_id   uuid,
  p_grupo     public.bdi_item_grupo,
  p_campo_key text,
  p_label     text,
  p_tipo      public.bdi_item_tipo,
  p_valor     numeric,
  p_produto_servico_id uuid,
  p_unidade   text,
  p_quantidade numeric,
  p_vunit_est numeric,
  p_ordem     integer,
  p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record; r public.bdi_item%ROWTYPE;
BEGIN
  SELECT empresa_id, licitacao_id, status INTO v_emp, v_lic, v_st
  FROM public.bdi_versao WHERE id = p_versao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  IF p_item_id IS NULL THEN
    INSERT INTO public.bdi_item(empresa_id, bdi_versao_id, grupo, campo_key, label, tipo,
      valor, produto_servico_id, unidade, quantidade, valor_unitario_estimado, ordem, observacao)
    VALUES (v_emp, p_versao_id, p_grupo, p_campo_key, p_label,
      COALESCE(p_tipo, 'moeda'::public.bdi_item_tipo),
      p_valor, p_produto_servico_id, p_unidade,
      p_quantidade, p_vunit_est, COALESCE(p_ordem,0), p_observacao)
    RETURNING * INTO r;
  ELSE
    UPDATE public.bdi_item SET
      grupo=p_grupo, campo_key=p_campo_key, label=p_label,
      tipo=COALESCE(p_tipo,'moeda'::public.bdi_item_tipo),
      valor=p_valor, produto_servico_id=p_produto_servico_id,
      unidade=p_unidade, quantidade=p_quantidade,
      valor_unitario_estimado=p_vunit_est,
      ordem=COALESCE(p_ordem,ordem), observacao=p_observacao, updated_at=now()
    WHERE id=p_item_id AND bdi_versao_id=p_versao_id AND empresa_id=v_emp
    RETURNING * INTO r;
    IF r.id IS NULL THEN RAISE EXCEPTION 'ITEM_NAO_ENCONTRADO' USING ERRCODE='P0002'; END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_salvar_item(uuid,uuid,public.bdi_item_grupo,text,text,public.bdi_item_tipo,numeric,uuid,text,numeric,numeric,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_salvar_item(uuid,uuid,public.bdi_item_grupo,text,text,public.bdi_item_tipo,numeric,uuid,text,numeric,numeric,integer,text) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_salvar_item(uuid,uuid,public.bdi_item_grupo,text,text,public.bdi_item_tipo,numeric,uuid,text,numeric,numeric,integer,text) FROM authenticated;

-- 10) bdi_excluir_item
CREATE OR REPLACE FUNCTION public.bdi_excluir_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record;
BEGIN
  SELECT i.empresa_id, v.licitacao_id, v.status
    INTO v_emp, v_lic, v_st
  FROM public.bdi_item i
  JOIN public.bdi_versao v ON v.id = i.bdi_versao_id
  WHERE i.id = p_item_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'ITEM_NAO_ENCONTRADO' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_EDITAVEL' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  DELETE FROM public.bdi_item WHERE id = p_item_id AND empresa_id = v_emp;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_excluir_item(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_excluir_item(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_excluir_item(uuid) FROM authenticated;

-- 11) bdi_recalcular
CREATE OR REPLACE FUNCTION public.bdi_recalcular(p_versao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp uuid; v_lic uuid; v_status public.bdi_status;
  v_can_edit boolean := false;
  v_postos numeric := 0; v_verbas_pct numeric := 0; v_itens numeric := 0;
  v_totais jsonb;
BEGIN
  SELECT empresa_id, licitacao_id, status INTO v_emp, v_lic, v_status
  FROM public.bdi_versao WHERE id = p_versao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;

  PERFORM public._bdi_assert_responsavel(v_lic, 'visualizar');

  BEGIN
    PERFORM public._bdi_assert_responsavel(v_lic, 'alterar');
    v_can_edit := true;
  EXCEPTION WHEN OTHERS THEN
    v_can_edit := false;
  END;

  SELECT COALESCE(SUM(
    COALESCE(qtd,0) * (
      COALESCE(salario_base,0)
      + COALESCE(va,0)
      + COALESCE(vt,0)
      + COALESCE(uniformes,0)
      + COALESCE(epis,0)
      + COALESCE(salario_base,0) *
        (COALESCE(insalubridade_pct,0) + COALESCE(periculosidade_pct,0)) / 100.0
    )
  ), 0) INTO v_postos
  FROM public.bdi_posto
  WHERE bdi_versao_id = p_versao_id AND empresa_id = v_emp;

  SELECT COALESCE(SUM(COALESCE(percentual,0)),0) INTO v_verbas_pct
  FROM public.bdi_verba_folha
  WHERE bdi_versao_id = p_versao_id AND empresa_id = v_emp;

  SELECT COALESCE(SUM(COALESCE(valor_total_estimado,0)),0) INTO v_itens
  FROM public.bdi_item
  WHERE bdi_versao_id = p_versao_id AND empresa_id = v_emp;

  v_totais := jsonb_build_object(
    'postos_total', v_postos,
    'verbas_folha_pct_total', v_verbas_pct,
    'itens_total', v_itens,
    'calculado_em', now(),
    'engine', 'bdi_recalcular_v1'
  );

  IF v_status = 'rascunho'::public.bdi_status AND v_can_edit THEN
    UPDATE public.bdi_versao
       SET totais_cache = v_totais, updated_at = now()
     WHERE id = p_versao_id AND empresa_id = v_emp;
    RETURN jsonb_build_object('ok', true, 'persisted', true, 'totais', v_totais);
  END IF;

  RETURN jsonb_build_object('ok', true, 'persisted', false, 'totais', v_totais);
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_recalcular(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_recalcular(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_recalcular(uuid) FROM authenticated;

-- 12) bdi_submeter
CREATE OR REPLACE FUNCTION public.bdi_submeter(p_versao_id uuid, p_justificativa text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_st public.bdi_status; ctx record; v_count int;
BEGIN
  SELECT empresa_id, licitacao_id, status INTO v_emp, v_lic, v_st
  FROM public.bdi_versao WHERE id = p_versao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_st <> 'rascunho'::public.bdi_status THEN RAISE EXCEPTION 'VERSAO_NAO_RASCUNHO' USING ERRCODE='55000'; END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  SELECT
    (SELECT COUNT(*) FROM public.bdi_posto       WHERE bdi_versao_id=p_versao_id AND empresa_id=v_emp)
  + (SELECT COUNT(*) FROM public.bdi_verba_folha WHERE bdi_versao_id=p_versao_id AND empresa_id=v_emp)
  + (SELECT COUNT(*) FROM public.bdi_item        WHERE bdi_versao_id=p_versao_id AND empresa_id=v_emp)
  INTO v_count;
  IF v_count = 0 THEN RAISE EXCEPTION 'VERSAO_VAZIA' USING ERRCODE='22023'; END IF;

  PERFORM public.bdi_recalcular(p_versao_id);

  UPDATE public.bdi_versao
     SET status='em_revisao'::public.bdi_status, updated_at=now()
   WHERE id=p_versao_id AND empresa_id=v_emp AND status='rascunho'::public.bdi_status;

  INSERT INTO public.bdi_aprovacao(empresa_id, bdi_versao_id, acao, de_status, para_status, ator_id, justificativa)
  VALUES (v_emp, p_versao_id,
          'submeter'::public.bdi_aprovacao_acao,
          'rascunho'::public.bdi_status,
          'em_revisao'::public.bdi_status,
          auth.uid(), p_justificativa);

  RETURN jsonb_build_object('ok', true, 'status', 'em_revisao');
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_submeter(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_submeter(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_submeter(uuid,text) FROM authenticated;

-- 13) bdi_cancelar
CREATE OR REPLACE FUNCTION public.bdi_cancelar(p_versao_id uuid, p_justificativa text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid; v_lic uuid; v_prev public.bdi_status; ctx record;
BEGIN
  IF p_justificativa IS NULL OR length(btrim(p_justificativa)) = 0 THEN
    RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA' USING ERRCODE='22023';
  END IF;

  SELECT empresa_id, licitacao_id, status INTO v_emp, v_lic, v_prev
  FROM public.bdi_versao WHERE id = p_versao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_prev NOT IN ('rascunho'::public.bdi_status,'em_revisao'::public.bdi_status) THEN
    RAISE EXCEPTION 'STATUS_NAO_CANCELAVEL' USING ERRCODE='55000';
  END IF;

  SELECT * INTO ctx FROM public._bdi_assert_responsavel(v_lic, 'alterar');
  IF ctx.empresa_id <> v_emp THEN RAISE EXCEPTION 'EMPRESA_INCONSISTENTE' USING ERRCODE='42501'; END IF;

  UPDATE public.bdi_versao
     SET status='cancelado'::public.bdi_status, updated_at=now()
   WHERE id=p_versao_id AND empresa_id=v_emp;

  INSERT INTO public.bdi_aprovacao(empresa_id, bdi_versao_id, acao, de_status, para_status, ator_id, justificativa)
  VALUES (v_emp, p_versao_id,
          'cancelar'::public.bdi_aprovacao_acao,
          v_prev, 'cancelado'::public.bdi_status,
          auth.uid(), p_justificativa);

  RETURN jsonb_build_object('ok', true, 'status', 'cancelado');
END;
$$;
REVOKE ALL ON FUNCTION public.bdi_cancelar(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bdi_cancelar(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.bdi_cancelar(uuid,text) FROM authenticated;

-- GRANTs finais (apenas RPCs públicas)
GRANT EXECUTE ON FUNCTION public.bdi_obter_versao(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_criar_versao(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_atualizar_versao(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_salvar_posto(uuid,uuid,text,integer,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_excluir_posto(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_salvar_verba(uuid,uuid,text,numeric,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_excluir_verba(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_salvar_item(uuid,uuid,public.bdi_item_grupo,text,text,public.bdi_item_tipo,numeric,uuid,text,numeric,numeric,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_excluir_item(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_recalcular(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_submeter(uuid,text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.bdi_cancelar(uuid,text)       TO authenticated;