-- Remove o override allow=false de /app/administracao para o usuário Eduardo Jeiel.
-- O bloqueio foi criado durante testes do novo sistema de permissões.
-- Sem registro explícito, o role admin recupera o acesso automaticamente.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'eduardojeielmonteiro1802@gmail.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário não encontrado: eduardojeielmonteiro1802@gmail.com';
    RETURN;
  END IF;

  DELETE FROM public.screen_permission_user
   WHERE user_id    = v_user_id
     AND menu_codigo = 'administracao'
     AND acao        = 'visualizar';

  RAISE NOTICE 'Bloqueio removido — acesso a /app/administracao restaurado para %', v_user_id;
END;
$$;
