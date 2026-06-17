CREATE UNIQUE INDEX IF NOT EXISTS idx_spu_unique_user_menu_acao_empresa_nulls_not_distinct
  ON public.screen_permission_user (user_id, menu_codigo, acao, empresa_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_spu_can_access_lookup
  ON public.screen_permission_user (user_id, menu_codigo, acao, empresa_id)
  INCLUDE (allow, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_spp_can_access_allow
  ON public.screen_permission_profile (role, menu_codigo, acao) WHERE allow = true;

CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup_menu
  ON public.role_permissions (role, menu_codigo, acao) INCLUDE (modulo) WHERE menu_codigo IS NOT NULL;