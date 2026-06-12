-- =================================================================
-- Role/cargo deixa de conceder qualquer bypass de rotas.
-- list_accessible_menus passa a tratar TODOS os usuários igual:
-- acesso somente via allow=true explícito em screen_permission_user.
--
-- ANTES de remover o bypass, concede allow=true para Eduardo em
-- todos os menus ativos, para não perder acesso.
-- =================================================================

-- ── 1. Garante acesso explícito de Eduardo a todos os menus ativos ─────────────
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'eduardojeielmonteiro1802@gmail.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: eduardojeielmonteiro1802@gmail.com';
  END IF;

  -- Limpa overrides de visualizar global para evitar duplicatas
  DELETE FROM public.screen_permission_user
   WHERE user_id    = v_user_id
     AND acao       = 'visualizar'
     AND empresa_id IS NULL;

  -- allow=true para todos os menus ativos
  INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id)
  SELECT v_user_id, am.codigo, 'visualizar'::public.app_acao, true, null
    FROM public.app_menu am
   WHERE am.ativo = true;

  RAISE NOTICE 'Acesso explícito concedido a % menus para Eduardo.',
    (SELECT count(*) FROM public.app_menu WHERE ativo = true);
END;
$$;

-- ── 2. list_accessible_menus v4 ───────────────────────────────────────────────
-- Sem bypass de admin. Sem fallback de role/perfil.
-- Acesso = somente allow=true explícito em screen_permission_user.
-- Role/cargo é puramente descritivo — não concede nenhum acesso a rota.

CREATE OR REPLACE FUNCTION public.list_accessible_menus(
  _user    uuid,
  _acao    text DEFAULT 'visualizar',
  _empresa uuid DEFAULT NULL
)
RETURNS TABLE(menu_codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  params AS (
    -- Permite que admin consulte acesso de outro usuário (painel de administração)
    SELECT
      _user                  AS user_id,
      _acao::public.app_acao AS acao,
      _empresa               AS empresa_id
    WHERE _user = auth.uid()
       OR EXISTS (
            SELECT 1
              FROM public.user_roles
             WHERE user_id = auth.uid()
               AND role    = 'admin'::public.app_role
          )
  ),
  active_menus AS (
    SELECT am.codigo AS menu_codigo
      FROM public.app_menu   am
      JOIN public.app_modulo mo ON mo.id = am.modulo_id
     WHERE am.ativo = true
  ),
  -- Override mais específico por menu:
  -- empresa-específico (prioridade 0) > global/null (prioridade 1) > mais recente
  override_resolved AS (
    SELECT DISTINCT ON (spu.menu_codigo)
           spu.menu_codigo,
           spu.allow
      FROM public.screen_permission_user spu
      CROSS JOIN params p
     WHERE spu.user_id = p.user_id
       AND spu.acao    = p.acao
       AND (
             spu.empresa_id IS NULL
          OR (p.empresa_id IS NOT NULL AND spu.empresa_id = p.empresa_id)
           )
     ORDER BY spu.menu_codigo,
              CASE
                WHEN p.empresa_id IS NOT NULL AND spu.empresa_id = p.empresa_id
                THEN 0 ELSE 1
              END,
              spu.updated_at DESC
  )
  -- Todos os usuários: acesso somente via allow=true explícito.
  -- Cargo/role não interfere em nada.
  SELECT DISTINCT am.menu_codigo
    FROM active_menus am
    JOIN override_resolved o ON o.menu_codigo = am.menu_codigo
   WHERE o.allow IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.list_accessible_menus(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_accessible_menus(uuid, text, uuid)
  TO authenticated, service_role, supabase_read_only_user;
