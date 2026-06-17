-- Corrige has_screen_access: admin agora também respeita allow=false
-- em screen_permission_user. O bypass incondicional fazia com que
-- usuários admin nunca pudessem ser bloqueados em ações dentro da página
-- (botões, formulários), mesmo com o painel de administração configurado.
-- Alinhado com o fix já feito em list_accessible_menus (20260611000004).

CREATE OR REPLACE FUNCTION public.has_screen_access(
  _user    uuid,
  _menu    text,
  _acao    public.app_acao,
  _empresa uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow boolean;
BEGIN
  IF _user IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Override individual empresa-específico (maior prioridade)
  IF _empresa IS NOT NULL THEN
    SELECT allow INTO v_allow
      FROM public.screen_permission_user
     WHERE user_id    = _user
       AND menu_codigo = _menu
       AND acao        = _acao
       AND empresa_id  = _empresa
     ORDER BY updated_at DESC
     LIMIT 1;
    IF FOUND THEN RETURN v_allow; END IF;
  END IF;

  -- 2. Override individual global (empresa_id IS NULL)
  SELECT allow INTO v_allow
    FROM public.screen_permission_user
   WHERE user_id    = _user
     AND menu_codigo = _menu
     AND acao        = _acao
     AND empresa_id  IS NULL
   ORDER BY updated_at DESC
   LIMIT 1;
  IF FOUND THEN RETURN v_allow; END IF;

  -- 3. Admin bypass — só chega aqui se não há override individual
  IF public.has_role(_user, 'admin') THEN RETURN true; END IF;

  -- 4. Permissão por perfil de role (screen_permission_profile)
  IF EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.screen_permission_profile spp ON spp.role = ur.role
     WHERE ur.user_id      = _user
       AND spp.menu_codigo = _menu
       AND spp.acao        = _acao
       AND spp.allow       = true
  ) THEN
    RETURN true;
  END IF;

  -- 5. Permissão por role_permissions (wildcard ou módulo específico)
  IF EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
     WHERE ur.user_id = _user
       AND rp.acao    = _acao
       AND (rp.menu_codigo = _menu OR rp.menu_codigo IS NULL)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
