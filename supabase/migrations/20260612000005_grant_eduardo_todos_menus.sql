-- Garante que Eduardo (admin) tenha allow=true para todos os menus ativos,
-- evitando lockout após a remoção do bypass de admin na RPC.
-- Este DO block usa EXCEPTION para não falhar a migration se o usuário
-- não for encontrado ou se já existirem registros.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'eduardojeielmonteiro1802@gmail.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário eduardojeielmonteiro1802@gmail.com não encontrado — pulando grant.';
    RETURN;
  END IF;

  -- Remove overrides de visualizar global para recomeçar limpo
  DELETE FROM public.screen_permission_user
   WHERE user_id    = v_user_id
     AND acao       = 'visualizar'
     AND empresa_id IS NULL;

  -- allow=true para todos os menus ativos
  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id)
  SELECT v_user_id, am.codigo, 'visualizar'::public.app_acao, true, null
    FROM public.app_menu am
   WHERE am.ativo = true;

  RAISE NOTICE 'Acesso concedido a % menus para Eduardo.',
    (SELECT count(*) FROM public.app_menu WHERE ativo = true);

EXCEPTION WHEN others THEN
  RAISE NOTICE 'Erro ao conceder acesso para Eduardo: % — continuando.', SQLERRM;
END;
$$;
