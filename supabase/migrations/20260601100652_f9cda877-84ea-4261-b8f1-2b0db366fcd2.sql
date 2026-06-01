BEGIN;

DO $$
DECLARE
  v_orfaos_count integer;
  v_deleted_profiles integer;
BEGIN
  CREATE TEMP TABLE _u1_orfaos_profile_contato_cheetah (
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO _u1_orfaos_profile_contato_cheetah (id)
  SELECT p.id
  FROM public.profiles p
  JOIN (
    VALUES
      ('fb37a3c8-ffb3-4bf4-86ef-a71fcc34a3ae'::uuid),
      ('016a5e8d-940e-4dfa-9129-6a8fc38c5884'::uuid),
      ('e2bd5079-b733-46da-85b7-e1cb850ee23e'::uuid),
      ('5d7de038-1edb-41fa-8022-1b5f51225dd5'::uuid)
  ) AS alvo(id) ON alvo.id = p.id
  WHERE lower(trim(p.email)) = lower('contato@cheetahcapital.com.br')
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = p.id
    );

  SELECT count(*)
    INTO v_orfaos_count
  FROM _u1_orfaos_profile_contato_cheetah;

  IF v_orfaos_count <> 4 THEN
    RAISE EXCEPTION
      'U1_ABORTADO: esperado 4 profiles órfãos de contato@cheetahcapital.com.br, encontrado %',
      v_orfaos_count
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.user_roles ur
  USING _u1_orfaos_profile_contato_cheetah o
  WHERE ur.user_id = o.id;

  IF to_regclass('public.user_empresa') IS NOT NULL THEN
    DELETE FROM public.user_empresa ue
    USING _u1_orfaos_profile_contato_cheetah o
    WHERE ue.user_id = o.id;
  END IF;

  IF to_regclass('public.user_permissoes') IS NOT NULL THEN
    DELETE FROM public.user_permissoes up
    USING _u1_orfaos_profile_contato_cheetah o
    WHERE up.user_id = o.id;
  END IF;

  DELETE FROM public.profiles p
  USING _u1_orfaos_profile_contato_cheetah o
  WHERE p.id = o.id;

  GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

  IF v_deleted_profiles <> 4 THEN
    RAISE EXCEPTION
      'U1_ABORTADO: esperado deletar 4 profiles órfãos, deletado %',
      v_deleted_profiles
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

COMMIT;