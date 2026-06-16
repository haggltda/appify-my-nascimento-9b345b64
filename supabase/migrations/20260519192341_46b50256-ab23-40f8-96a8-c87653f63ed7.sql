
CREATE TABLE IF NOT EXISTS public.screen_permission_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  menu_codigo text NOT NULL,
  acao public.app_acao NOT NULL,
  allow boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, menu_codigo, acao)
);
CREATE INDEX IF NOT EXISTS idx_spp_role ON public.screen_permission_profile(role);
CREATE INDEX IF NOT EXISTS idx_spp_menu ON public.screen_permission_profile(menu_codigo);

CREATE TABLE IF NOT EXISTS public.screen_permission_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_codigo text NOT NULL,
  acao public.app_acao NOT NULL,
  allow boolean NOT NULL,
  empresa_id uuid NULL,
  motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_codigo, acao, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_spu_user ON public.screen_permission_user(user_id);
CREATE INDEX IF NOT EXISTS idx_spu_menu ON public.screen_permission_user(menu_codigo);

ALTER TABLE public.screen_permission_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_permission_user ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spp_select ON public.screen_permission_profile;
CREATE POLICY spp_select ON public.screen_permission_profile FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS spp_write ON public.screen_permission_profile;
CREATE POLICY spp_write ON public.screen_permission_profile FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));

DROP POLICY IF EXISTS spu_select ON public.screen_permission_user;
CREATE POLICY spu_select ON public.screen_permission_user FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));
DROP POLICY IF EXISTS spu_write ON public.screen_permission_user;
CREATE POLICY spu_write ON public.screen_permission_user FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));

CREATE OR REPLACE FUNCTION public.has_screen_access(
  _user uuid, _menu text, _acao public.app_acao, _empresa uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_allow boolean;
BEGIN
  IF _user IS NULL THEN RETURN false; END IF;
  IF public.has_role(_user, 'admin') THEN RETURN true; END IF;
  IF _empresa IS NOT NULL THEN
    SELECT allow INTO v_allow FROM public.screen_permission_user
      WHERE user_id=_user AND menu_codigo=_menu AND acao=_acao AND empresa_id=_empresa LIMIT 1;
    IF FOUND THEN RETURN v_allow; END IF;
  END IF;
  SELECT allow INTO v_allow FROM public.screen_permission_user
    WHERE user_id=_user AND menu_codigo=_menu AND acao=_acao AND empresa_id IS NULL LIMIT 1;
  IF FOUND THEN RETURN v_allow; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.screen_permission_profile spp ON spp.role = ur.role
    WHERE ur.user_id=_user AND spp.menu_codigo=_menu AND spp.acao=_acao AND spp.allow=true
  ) THEN RETURN true; END IF;
  RETURN false;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_spp_updated ON public.screen_permission_profile;
CREATE TRIGGER trg_spp_updated BEFORE UPDATE ON public.screen_permission_profile
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_spu_updated ON public.screen_permission_user;
CREATE TRIGGER trg_spu_updated BEFORE UPDATE ON public.screen_permission_user
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.screen_permission_profile (role, menu_codigo, acao, allow)
SELECT r.role, m.codigo, 'visualizar'::public.app_acao, true
  FROM public.app_menu m
 CROSS JOIN (VALUES ('admin'::public.app_role), ('diretor_adm'::public.app_role), ('presidencia'::public.app_role)) AS r(role)
 WHERE m.ativo = true
ON CONFLICT (role, menu_codigo, acao) DO NOTHING;
