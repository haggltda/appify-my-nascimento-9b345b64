CREATE OR REPLACE FUNCTION public.can_access(
  _user uuid,
  _menu text,
  _acao app_acao DEFAULT 'visualizar'::app_acao,
  _empresa uuid DEFAULT NULL::uuid,
  _modulo text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH menu_info AS (
    SELECT am.codigo AS menu_codigo, mo.codigo AS modulo_codigo, am.ativo
    FROM public.app_menu am
    JOIN public.app_modulo mo ON mo.id = am.modulo_id
    WHERE am.codigo = _menu
    LIMIT 1
  ),
  menu_gate AS (
    SELECT
      EXISTS (SELECT 1 FROM menu_info) AS menu_exists,
      COALESCE((SELECT ativo FROM menu_info), false) AS menu_ativo
  ),
  effective_context AS (
    SELECT _user AS user_id, _menu AS menu_codigo, _acao AS acao, _empresa AS empresa_id,
           COALESCE((SELECT mi.modulo_codigo FROM menu_info mi), _modulo) AS modulo_codigo
  ),
  admin_access AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user AND ur.role = 'admin'::public.app_role
    ) AS allowed
  ),
  user_override AS (
    SELECT spu.allow
    FROM public.screen_permission_user spu
    JOIN effective_context ec ON true
    WHERE spu.user_id = ec.user_id
      AND spu.menu_codigo = ec.menu_codigo
      AND spu.acao = ec.acao
      AND (spu.empresa_id IS NULL OR (ec.empresa_id IS NOT NULL AND spu.empresa_id = ec.empresa_id))
    ORDER BY CASE WHEN ec.empresa_id IS NOT NULL AND spu.empresa_id = ec.empresa_id THEN 0 ELSE 1 END,
             spu.updated_at DESC
    LIMIT 1
  ),
  role_permission_access AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      JOIN effective_context ec ON true
      WHERE ur.user_id = ec.user_id AND rp.acao = ec.acao
        AND (rp.menu_codigo = ec.menu_codigo
             OR (rp.menu_codigo IS NULL
                 AND (rp.modulo = '*'
                      OR (ec.modulo_codigo IS NOT NULL AND rp.modulo = ec.modulo_codigo))))
    ) AS allowed
  ),
  profile_screen_access AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.screen_permission_profile spp ON spp.role = ur.role
      JOIN effective_context ec ON true
      WHERE ur.user_id = ec.user_id
        AND spp.menu_codigo = ec.menu_codigo
        AND spp.acao = ec.acao
        AND spp.allow = true
    ) AS allowed
  )
  SELECT
    CASE
      WHEN _user IS NULL OR _menu IS NULL OR btrim(_menu) = '' THEN false
      WHEN NOT (SELECT menu_exists FROM menu_gate) THEN false
      WHEN NOT (SELECT menu_ativo  FROM menu_gate) THEN false
      WHEN (SELECT allowed FROM admin_access) THEN true
      WHEN EXISTS (SELECT 1 FROM user_override) THEN COALESCE((SELECT allow FROM user_override), false)
      ELSE COALESCE((SELECT allowed FROM role_permission_access), false)
        OR COALESCE((SELECT allowed FROM profile_screen_access), false)
    END;
$function$;

ALTER VIEW public.v_estoque_consolidado     SET (security_invoker = true);
ALTER VIEW public.v_fluxo_caixa_consolidado SET (security_invoker = true);
ALTER VIEW public.vw_conciliacao_eventos    SET (security_invoker = true);
ALTER VIEW public.vw_mz_32_promocao_status  SET (security_invoker = true);