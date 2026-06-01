BEGIN;

SET LOCAL "request.jwt.claim.role" = 'service_role';

DO $$
DECLARE
  v_user_id              uuid := 'aa140f70-38aa-46ad-bf79-73bb9b854258'::uuid;
  v_empresa_hagg         uuid := '5a61c769-21d8-4e61-b9bb-506b8db0bce8'::uuid;
  v_profile_count        integer;
  v_auth_count           integer;
  v_role_count           integer;
  v_priv_count           integer;
  v_empresa_count        integer;
  v_anomalia_count       integer;
  v_ue_total_pre_count   integer;
  v_ue_outros_pre_count  integer;
  v_updated_count        integer;
  v_ue_upsert_count      integer;
  v_ue_total_post_count  integer;
BEGIN
  SELECT count(*) INTO v_profile_count
  FROM public.profiles
  WHERE id = v_user_id
    AND lower(trim(email)) = lower('contato@cheetahcapital.com.br');
  IF v_profile_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: profile esperado=1, encontrado=%', v_profile_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_auth_count FROM auth.users WHERE id = v_user_id;
  IF v_auth_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: auth.users count=%', v_auth_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_empresa_count
  FROM public.empresas WHERE id = v_empresa_hagg AND ativa = true;
  IF v_empresa_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: HAGG ativa esperado=1, encontrado=%', v_empresa_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_role_count
  FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'comercial'::public.app_role;
  IF v_role_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: role comercial count=%', v_role_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_priv_count
  FROM public.user_roles
  WHERE user_id = v_user_id
    AND role IN (
      'admin'::public.app_role,
      'controladoria'::public.app_role,
      'presidencia'::public.app_role,
      'diretor_adm'::public.app_role,
      'diretor_op'::public.app_role
    );
  IF v_priv_count <> 0 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: role privilegiada inesperada count=%', v_priv_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_ue_total_pre_count
  FROM public.user_empresa WHERE user_id = v_user_id;

  SELECT count(*) INTO v_ue_outros_pre_count
  FROM public.user_empresa
  WHERE user_id = v_user_id AND empresa_id IS DISTINCT FROM v_empresa_hagg;
  IF v_ue_outros_pre_count <> 0 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: usuário já possui vínculo com empresa diferente de HAGG, count=%', v_ue_outros_pre_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_anomalia_count
  FROM public.profiles
  WHERE id = v_user_id
    AND (
      acessa_todas_empresas = true
      OR empresa_atual_id IS DISTINCT FROM v_empresa_hagg
      OR empresa_id IS DISTINCT FROM v_empresa_hagg
      OR v_ue_total_pre_count = 0
    );
  IF v_anomalia_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA_DIVERGENCIA_PRE_FLIGHT: anomalia não mais presente, count=%', v_anomalia_count
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.profiles
     SET acessa_todas_empresas = false,
         empresa_id            = v_empresa_hagg,
         empresa_atual_id      = v_empresa_hagg
   WHERE id = v_user_id
     AND lower(trim(email)) = lower('contato@cheetahcapital.com.br');
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA: esperado atualizar 1 profile, atualizado %', v_updated_count
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.user_empresa (user_id, empresa_id, is_default, created_by)
  VALUES (v_user_id, v_empresa_hagg, true, NULL)
  ON CONFLICT (user_id, empresa_id)
  DO UPDATE SET is_default = EXCLUDED.is_default;
  GET DIAGNOSTICS v_ue_upsert_count = ROW_COUNT;
  IF v_ue_upsert_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA: esperado 1 upsert em user_empresa, obtido %', v_ue_upsert_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_ue_total_post_count
  FROM public.user_empresa WHERE user_id = v_user_id;
  IF v_ue_total_post_count <> 1 THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA: esperado exatamente 1 vínculo em user_empresa após execução, encontrado %', v_ue_total_post_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id
      AND acessa_todas_empresas = false
      AND empresa_id = v_empresa_hagg
      AND empresa_atual_id = v_empresa_hagg
  ) THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA: pós-condição de profile não satisfeita'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresa
    WHERE user_id = v_user_id AND empresa_id = v_empresa_hagg AND is_default = true
  ) THEN
    RAISE EXCEPTION 'FASE_A_ABORTADA: pós-condição de user_empresa não satisfeita'
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

COMMIT;