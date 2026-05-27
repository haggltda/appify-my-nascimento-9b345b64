BEGIN;

SELECT pg_advisory_xact_lock(741260431987654321);

CREATE TABLE IF NOT EXISTS public.permission_migration_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_tag text NOT NULL UNIQUE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  role_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  screen_permission_profile jsonb NOT NULL DEFAULT '[]'::jsonb,
  screen_permission_user jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  perfil_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  app_menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.permission_migration_snapshot TO authenticated;
GRANT ALL ON public.permission_migration_snapshot TO service_role;

ALTER TABLE public.permission_migration_snapshot ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_migration_snapshot' AND policyname='pms_select_admin') THEN
    CREATE POLICY pms_select_admin ON public.permission_migration_snapshot FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

INSERT INTO public.permission_migration_snapshot (
  migration_tag, role_permissions, screen_permission_profile, screen_permission_user, user_roles, perfil_metadata, app_menu, counts
)
SELECT
  '20260601090000_permissions_backend_phase1_core',
  COALESCE((SELECT jsonb_agg(to_jsonb(rp) ORDER BY rp.role::text, rp.modulo, COALESCE(rp.menu_codigo, ''), rp.acao::text) FROM public.role_permissions rp), '[]'::jsonb),
  COALESCE((SELECT jsonb_agg(to_jsonb(spp) ORDER BY spp.role::text, spp.menu_codigo, spp.acao::text) FROM public.screen_permission_profile spp), '[]'::jsonb),
  COALESCE((SELECT jsonb_agg(to_jsonb(spu) ORDER BY spu.user_id::text, spu.menu_codigo, spu.acao::text, COALESCE(spu.empresa_id::text, '')) FROM public.screen_permission_user spu), '[]'::jsonb),
  COALESCE((SELECT jsonb_agg(to_jsonb(ur) ORDER BY ur.user_id::text, ur.role::text) FROM public.user_roles ur), '[]'::jsonb),
  COALESCE((SELECT jsonb_agg(to_jsonb(pm) ORDER BY pm.role::text) FROM public.perfil_metadata pm), '[]'::jsonb),
  COALESCE((SELECT jsonb_agg(to_jsonb(am) ORDER BY am.codigo) FROM public.app_menu am), '[]'::jsonb),
  jsonb_build_object(
    'role_permissions', (SELECT count(*) FROM public.role_permissions),
    'screen_permission_profile', (SELECT count(*) FROM public.screen_permission_profile),
    'screen_permission_user', (SELECT count(*) FROM public.screen_permission_user)
  )
ON CONFLICT (migration_tag) DO NOTHING;

ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS menu_codigo text;
ALTER TABLE public.screen_permission_profile ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.screen_permission_user ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.can_access(
  _user uuid,
  _menu text,
  _acao public.app_acao DEFAULT 'visualizar'::public.app_acao,
  _empresa uuid DEFAULT NULL,
  _modulo text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH menu_info AS (
    SELECT am.codigo AS menu_codigo, mo.codigo AS modulo_codigo
    FROM public.app_menu am
    JOIN public.app_modulo mo ON mo.id = am.modulo_id
    WHERE am.codigo = _menu AND am.ativo = true LIMIT 1
  ),
  effective_context AS (
    SELECT _user AS user_id, _menu AS menu_codigo, _acao AS acao, _empresa AS empresa_id,
           COALESCE((SELECT mi.modulo_codigo FROM menu_info mi), _modulo) AS modulo_codigo
  ),
  admin_access AS (
    SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.role = 'admin'::public.app_role) AS allowed
  ),
  user_override AS (
    SELECT spu.allow FROM public.screen_permission_user spu JOIN effective_context ec ON true
    WHERE spu.user_id = ec.user_id AND spu.menu_codigo = ec.menu_codigo AND spu.acao = ec.acao
      AND (spu.empresa_id IS NULL OR (ec.empresa_id IS NOT NULL AND spu.empresa_id = ec.empresa_id))
    ORDER BY CASE WHEN ec.empresa_id IS NOT NULL AND spu.empresa_id = ec.empresa_id THEN 0 ELSE 1 END, spu.updated_at DESC
    LIMIT 1
  ),
  role_permission_access AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      JOIN effective_context ec ON true
      WHERE ur.user_id = ec.user_id AND rp.acao = ec.acao
        AND (rp.menu_codigo = ec.menu_codigo
             OR (rp.menu_codigo IS NULL AND (rp.modulo = '*' OR (ec.modulo_codigo IS NOT NULL AND rp.modulo = ec.modulo_codigo))))
    ) AS allowed
  ),
  profile_screen_access AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.screen_permission_profile spp ON spp.role = ur.role
      JOIN effective_context ec ON true
      WHERE ur.user_id = ec.user_id AND spp.menu_codigo = ec.menu_codigo AND spp.acao = ec.acao AND spp.allow = true
    ) AS allowed
  )
  SELECT
    CASE
      WHEN _user IS NULL OR _menu IS NULL OR btrim(_menu) = '' THEN false
      WHEN (SELECT allowed FROM admin_access) THEN true
      WHEN EXISTS (SELECT 1 FROM user_override) THEN COALESCE((SELECT allow FROM user_override), false)
      ELSE COALESCE((SELECT allowed FROM role_permission_access), false) OR COALESCE((SELECT allowed FROM profile_screen_access), false)
    END;
$$;

REVOKE ALL ON FUNCTION public.can_access(uuid, text, public.app_acao, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access(uuid, text, public.app_acao, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access(uuid, text, public.app_acao, uuid, text) TO service_role;

DO $$
DECLARE
  v_lost_role_permissions int;
BEGIN
  WITH role_candidates AS (
    SELECT DISTINCT
      ur.user_id,
      COALESCE(rp.menu_codigo, am.codigo) AS menu_codigo,
      rp.acao,
      CASE WHEN rp.modulo = '*' THEN mo.codigo ELSE rp.modulo END AS modulo
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    LEFT JOIN public.app_menu am ON (
      rp.menu_codigo IS NULL AND am.ativo = true
      AND (rp.modulo = '*' OR EXISTS (
        SELECT 1 FROM public.app_modulo mo2 WHERE mo2.id = am.modulo_id AND mo2.codigo = rp.modulo
      ))
    )
    LEFT JOIN public.app_menu am_exact ON am_exact.codigo = rp.menu_codigo
    LEFT JOIN public.app_modulo mo ON mo.id = COALESCE(am.modulo_id, am_exact.modulo_id)
    WHERE COALESCE(rp.menu_codigo, am.codigo) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.screen_permission_user deny
        WHERE deny.user_id = ur.user_id
          AND deny.menu_codigo = COALESCE(rp.menu_codigo, am.codigo)
          AND deny.acao = rp.acao
          AND deny.allow = false
          AND deny.empresa_id IS NULL
      )
  )
  SELECT count(*) INTO v_lost_role_permissions
  FROM role_candidates c
  WHERE public.can_access(c.user_id, c.menu_codigo, c.acao, NULL, c.modulo) IS NOT TRUE;

  IF v_lost_role_permissions > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORTED_ANTI_LOSS_ROLE_PERMISSIONS: % permissões antigas foram perdidas.', v_lost_role_permissions;
  END IF;
END $$;

COMMIT;