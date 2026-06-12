-- Versão final de list_accessible_menus: sem bypass de role/cargo.
-- Todos os usuários (incluindo admin) acessam SOMENTE menus com
-- allow=true explícito em screen_permission_user.
-- Cargo/role é puramente descritivo — não concede acesso a rotas.
--
-- Atenção: esta migration NÃO usa REVOKE/GRANT externo nem DO blocks
-- que poderiam falhar e reverter a alteração da função.

CREATE OR REPLACE FUNCTION public.list_accessible_menus(
  _user    uuid,
  _acao    text    DEFAULT 'visualizar',
  _empresa uuid    DEFAULT NULL
)
RETURNS TABLE(menu_codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  -- Garante que só o próprio usuário ou um admin consulta
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
  active_menus AS (
    SELECT am.codigo AS menu_codigo
      FROM public.app_menu   am
      JOIN public.app_modulo mo ON mo.id = am.modulo_id
     WHERE am.ativo = true
  ),
  -- Override mais específico por menu (empresa > global, mais recente vence)
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
  -- Role/cargo não interfere — nem admin, nem operacional, nem nenhum outro.
  SELECT DISTINCT am.menu_codigo
    FROM active_menus am
    JOIN override_resolved o ON o.menu_codigo = am.menu_codigo
   WHERE o.allow IS TRUE;
$$;
