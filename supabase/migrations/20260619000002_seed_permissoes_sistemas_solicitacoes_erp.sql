-- Seed das permissões do módulo "Sistemas" (Solicitações ERP) — 100% por
-- usuário, sem regra de role, conforme matriz definida com o gerente.
--
-- Cada bloco resolve o usuário por nome em profiles.display_name e falha
-- (RAISE EXCEPTION) se não achar exatamente 1 resultado — evita conceder
-- permissão de mover card pra pessoa errada por nome ambíguo ou ausente.
-- Se algum bloco falhar, ajuste o filtro ILIKE pro nome exato cadastrado
-- e rode a migration de novo.

DO $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.profiles
   WHERE display_name ILIKE '%Eduardo Jeiel%' AND display_name NOT ILIKE '%teste%';
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 profile para "Eduardo Jeiel", encontrou %.', COALESCE(array_length(v_ids, 1), 0);
  END IF;

  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id) VALUES
    (v_ids[1], 'sistemas_solicitacoes_erp',  'visualizar', true, NULL),
    (v_ids[1], 'sistemas_criar_solicitacao', 'visualizar', true, NULL)
  ON CONFLICT (user_id, menu_codigo, acao, empresa_id) DO UPDATE SET allow = true;
END $$;

DO $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.profiles
   WHERE display_name ILIKE '%Helena%' AND display_name NOT ILIKE '%teste%';
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 profile para "Helena", encontrou %.', COALESCE(array_length(v_ids, 1), 0);
  END IF;

  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id) VALUES
    (v_ids[1], 'sistemas_solicitacoes_erp', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_solicitacoes_aprovado_presidencia', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_validacao_presidencia_teste_setor', 'visualizar', true, NULL)
  ON CONFLICT (user_id, menu_codigo, acao, empresa_id) DO UPDATE SET allow = true;
END $$;

DO $$
DECLARE v_ids uuid[];
BEGIN
  -- Existe "Iury Silva - Testes" (conta de teste, será apagada) além da
  -- conta oficial — exclui qualquer coisa com "teste" pra não pegar a errada.
  SELECT array_agg(id) INTO v_ids FROM public.profiles
   WHERE display_name ILIKE '%Iury de Jesus Silva%'
     AND display_name NOT ILIKE '%teste%';
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 profile para "Iury de Jesus Silva", encontrou %.', COALESCE(array_length(v_ids, 1), 0);
  END IF;

  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id) VALUES
    (v_ids[1], 'sistemas_solicitacoes_erp', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_aprovado_presidencia_projetos', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_projetos_em_andamento', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_em_andamento_validacao_presidencia', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_teste_setor_treinamentos', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_treinamentos_implantacao', 'visualizar', true, NULL)
  ON CONFLICT (user_id, menu_codigo, acao, empresa_id) DO UPDATE SET allow = true;
END $$;

DO $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.profiles
   WHERE display_name ILIKE '%Yuri%' AND display_name NOT ILIKE '%teste%';
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 profile para "Yuri", encontrou %.', COALESCE(array_length(v_ids, 1), 0);
  END IF;

  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id) VALUES
    (v_ids[1], 'sistemas_solicitacoes_erp', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_aprovado_presidencia_projetos', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_teste_setor_treinamentos', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_treinamentos_implantacao', 'visualizar', true, NULL)
  ON CONFLICT (user_id, menu_codigo, acao, empresa_id) DO UPDATE SET allow = true;
END $$;

DO $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.profiles
   WHERE (display_name ILIKE '%Érica%' OR display_name ILIKE '%Erica%') AND display_name NOT ILIKE '%teste%';
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 profile para "Érica", encontrou %.', COALESCE(array_length(v_ids, 1), 0);
  END IF;

  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id) VALUES
    (v_ids[1], 'sistemas_solicitacoes_erp', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_aprovado_presidencia_projetos', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_teste_setor_treinamentos', 'visualizar', true, NULL),
    (v_ids[1], 'sistemas_mover_treinamentos_implantacao', 'visualizar', true, NULL)
  ON CONFLICT (user_id, menu_codigo, acao, empresa_id) DO UPDATE SET allow = true;
END $$;
