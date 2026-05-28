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
  ur AS (
    SELECT ur.role
      FROM public.user_roles ur
      CROSS JOIN params p
     WHERE ur.user_id = p.user_id
  ),
  is_admin AS (
    SELECT EXISTS (
      SELECT 1 FROM ur WHERE role = 'admin'::public.app_role
    ) AS yes
  ),
  active_menus AS (
    SELECT am.codigo AS menu_codigo, mo.codigo AS modulo_codigo
      FROM public.app_menu   am
      JOIN public.app_modulo mo ON mo.id = am.modulo_id
     WHERE am.ativo = true
  ),
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
  profile_allow AS (
    SELECT DISTINCT spp.menu_codigo
      FROM public.screen_permission_profile spp
      JOIN ur ON ur.role = spp.role
      CROSS JOIN params p
     WHERE spp.acao  = p.acao
       AND spp.allow = true
  ),
  role_perm_allow AS (
    SELECT DISTINCT am.menu_codigo
      FROM active_menus am
      CROSS JOIN params p
      JOIN public.role_permissions rp
        ON rp.acao = p.acao
       AND (
             rp.menu_codigo = am.menu_codigo
          OR (rp.menu_codigo IS NULL
              AND (rp.modulo = '*' OR rp.modulo = am.modulo_codigo))
           )
      JOIN ur ON ur.role = rp.role
  ),
  role_based_allow AS (
    SELECT menu_codigo FROM profile_allow
    UNION
    SELECT menu_codigo FROM role_perm_allow
  ),
  resolved AS (
    SELECT am.menu_codigo
      FROM active_menus am
     WHERE (SELECT yes FROM is_admin)

    UNION

    SELECT am.menu_codigo
      FROM active_menus am
      LEFT JOIN override_resolved o ON o.menu_codigo = am.menu_codigo
     WHERE NOT (SELECT yes FROM is_admin)
       AND (
             o.allow IS TRUE
          OR (
               (o.menu_codigo IS NULL OR o.allow IS NULL)
               AND am.menu_codigo IN (SELECT menu_codigo FROM role_based_allow)
             )
           )
  )
  SELECT DISTINCT menu_codigo FROM resolved;
$$;

REVOKE ALL ON FUNCTION public.list_accessible_menus(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_accessible_menus(uuid, text, uuid)
  TO authenticated, service_role;