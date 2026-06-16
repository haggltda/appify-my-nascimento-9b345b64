-- =================================================================
-- MUDANÇA ESTRUTURAL: acesso a rotas determinado APENAS por
-- screen_permission_user (painel "Acesso por Usuário" em /app/administracao).
--
-- Roles/cargos (operacional, comercial, juridico, etc.) passam a ser
-- puramente descritivos — definem o perfil do usuário, não o que ele vê.
--
-- Admin mantém bypass: vê tudo exceto allow=false explícito.
-- Não-admin: acessa SOMENTE rotas com allow=true explícito salvo no painel.
-- =================================================================

-- ── 1. Remove wildcard visualizar de role_permissions para não-admins ──────────
-- Essas entradas eram o que dava acesso automático a TODAS as rotas para
-- qualquer cargo (operacional vê tudo, comercial vê tudo, etc.).
-- Roles ainda mantêm permissões de AÇÃO (incluir, alterar, excluir, aprovar)
-- para controlar o que o usuário pode fazer DENTRO das telas que ele acessa.

DELETE FROM public.role_permissions
WHERE modulo = '*'
  AND acao   = 'visualizar'
  AND role   != 'admin'::public.app_role;

-- ── 2. Remove visualizar de screen_permission_profile para não-admins ──────────
-- screen_permission_profile pode continuar sendo usada para ações de CRUD.

DELETE FROM public.screen_permission_profile
WHERE acao = 'visualizar'
  AND role != 'admin'::public.app_role;

-- ── 3. list_accessible_menus v3 ───────────────────────────────────────────────
-- Não-admin: acessa SOMENTE menus com allow=true explícito.
-- Removido o fallback de role_based_allow (profile_allow + role_perm_allow).

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
  is_admin AS (
    SELECT EXISTS (
      SELECT 1
        FROM public.user_roles ur
        CROSS JOIN params p
       WHERE ur.user_id = p.user_id
         AND ur.role    = 'admin'::public.app_role
    ) AS yes
  ),
  active_menus AS (
    SELECT am.codigo AS menu_codigo
      FROM public.app_menu   am
      JOIN public.app_modulo mo ON mo.id = am.modulo_id
     WHERE am.ativo = true
  ),
  -- Resolve override mais específico por menu:
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
  ),
  resolved AS (
    -- Admin: todos os menus ativos EXCETO os explicitamente negados (allow=false)
    SELECT am.menu_codigo
      FROM active_menus am
      LEFT JOIN override_resolved o ON o.menu_codigo = am.menu_codigo
     WHERE (SELECT yes FROM is_admin)
       AND NOT (o.allow IS FALSE)

    UNION

    -- Não-admin: SOMENTE menus com allow=true explícito em screen_permission_user.
    -- Cargo/role não concede acesso a rotas — apenas o painel de usuários.
    SELECT am.menu_codigo
      FROM active_menus am
      JOIN override_resolved o ON o.menu_codigo = am.menu_codigo
     WHERE NOT (SELECT yes FROM is_admin)
       AND o.allow IS TRUE
  )
  SELECT DISTINCT menu_codigo FROM resolved;
$$;

REVOKE ALL ON FUNCTION public.list_accessible_menus(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_accessible_menus(uuid, text, uuid)
  TO authenticated, service_role, supabase_read_only_user;
