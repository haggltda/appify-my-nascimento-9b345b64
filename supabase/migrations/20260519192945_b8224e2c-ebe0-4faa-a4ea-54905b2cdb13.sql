
CREATE TABLE IF NOT EXISTS public.access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  menu_codigo TEXT,
  rota TEXT,
  acao TEXT NOT NULL DEFAULT 'visualizar',
  empresa_id UUID,
  allowed BOOLEAN NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aal_user_time ON public.access_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_menu ON public.access_audit_log(menu_codigo);
ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aal_self_select ON public.access_audit_log;
CREATE POLICY aal_self_select ON public.access_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS aal_self_insert ON public.access_audit_log;
CREATE POLICY aal_self_insert ON public.access_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.list_accessible_menus(
  _user UUID,
  _acao TEXT DEFAULT 'visualizar',
  _empresa UUID DEFAULT NULL
) RETURNS TABLE(menu_codigo TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH user_roles_ AS (
    SELECT role::text AS role FROM public.user_roles WHERE user_id = _user
  ),
  admin_short AS (
    SELECT codigo AS menu_codigo FROM public.app_menu
    WHERE ativo = true AND EXISTS (SELECT 1 FROM user_roles_ WHERE role = 'admin')
  ),
  prof AS (
    SELECT spp.menu_codigo FROM public.screen_permission_profile spp
    JOIN user_roles_ ur ON ur.role = spp.role::text
    WHERE spp.allow = true AND spp.acao::text = _acao
  ),
  user_allow AS (
    SELECT menu_codigo FROM public.screen_permission_user
    WHERE user_id = _user AND acao::text = _acao AND allow = true
      AND (empresa_id IS NULL OR empresa_id = _empresa)
  ),
  user_deny AS (
    SELECT menu_codigo FROM public.screen_permission_user
    WHERE user_id = _user AND acao::text = _acao AND allow = false
      AND (empresa_id IS NULL OR empresa_id = _empresa)
  ),
  base AS (
    SELECT menu_codigo FROM admin_short
    UNION SELECT menu_codigo FROM prof
    UNION SELECT menu_codigo FROM user_allow
  )
  SELECT DISTINCT b.menu_codigo FROM base b
  WHERE NOT EXISTS (SELECT 1 FROM user_deny d WHERE d.menu_codigo = b.menu_codigo)
    AND EXISTS (SELECT 1 FROM public.app_menu m WHERE m.codigo = b.menu_codigo AND m.ativo = true);
$$;

REVOKE ALL ON FUNCTION public.list_accessible_menus(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accessible_menus(UUID, TEXT, UUID) TO authenticated;

-- Delete duplicates first then update
DELETE FROM public.user_roles ur
WHERE ur.role = 'visitante'
  AND EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = ur.user_id AND ur2.role = 'usuario');

UPDATE public.user_roles SET role = 'usuario' WHERE role = 'visitante';
