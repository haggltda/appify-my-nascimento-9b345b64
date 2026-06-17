BEGIN;

DO $$
DECLARE
  v_pre_count     integer;
  v_deleted_count integer;
BEGIN
  SELECT count(*)
    INTO v_pre_count
    FROM public.role_permissions
   WHERE modulo = '*'
     AND menu_codigo IS NULL
     AND acao = 'visualizar'::public.app_acao
     AND role IN (
       'comercial'::public.app_role,
       'operacional'::public.app_role,
       'juridico'::public.app_role,
       'sst'::public.app_role,
       'usuario'::public.app_role,
       'visitante'::public.app_role
     );

  IF v_pre_count <> 6 THEN
    RAISE EXCEPTION
      'BLOCO_1_ABORTADO: esperado 6 wildcards visualizar nos perfis operacionais, encontrado %',
      v_pre_count
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.role_permissions
   WHERE modulo = '*'
     AND menu_codigo IS NULL
     AND acao = 'visualizar'::public.app_acao
     AND role IN (
       'comercial'::public.app_role,
       'operacional'::public.app_role,
       'juridico'::public.app_role,
       'sst'::public.app_role,
       'usuario'::public.app_role,
       'visitante'::public.app_role
     );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> 6 THEN
    RAISE EXCEPTION
      'BLOCO_1_ABORTADO: esperado deletar 6 wildcards, deletado %',
      v_deleted_count
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

COMMIT;