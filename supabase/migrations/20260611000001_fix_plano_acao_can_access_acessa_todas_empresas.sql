-- Corrige plano_acao_can_access para:
--
--   1. Manter bypass de admin (has_role 'admin') — inalterado.
--   2. Bypass acessa_todas_empresas=true — mesmo nivel de confianca que admin,
--      setado automaticamente pelo backfill em 20260519210356.
--   3. Permissoes BASICAS (visualizar, dashboard, criar, editar, excluir):
--      qualquer usuario que tenha acesso a rota plano_acoes_lista (via
--      screen_permission_user ou screen_permission_profile/role) e possa
--      atuar na empresa pode executar essas operacoes. Isso permite que
--      qualquer usuario habilitado no painel de administracao crie e edite
--      planos de acao sem precisar de entrada manual em plano_acao_usuario_permissao.
--   4. Permissoes ELEVADAS (importar, aprovar, administrar): continuam
--      exigindo entrada explicita em plano_acao_usuario_permissao (Yuri, Erica, Helena, etc.).
--   5. Para demais casos: troca get_user_empresa por user_pode_atuar_empresa
--      (mais robusto para usuarios multi-empresa).

CREATE OR REPLACE FUNCTION public.plano_acao_can_access(
  p_user_id    uuid,
  p_empresa_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  v_flag boolean;
  -- Permissoes basicas: liberadas para qualquer usuario com acesso a rota
  BASIC_PERMS CONSTANT text[] := ARRAY['visualizar','dashboard','criar','editar','excluir'];
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  -- 1. Bypass admin
  IF public.has_role(p_user_id, 'admin'::app_role) THEN RETURN true; END IF;

  -- 2. Bypass acessa_todas_empresas (nivel de confianca equivalente a admin para
  --    operacoes cross-empresa; backfill em 20260519210356 ja setou esta flag para admins)
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.acessa_todas_empresas = true
  ) THEN RETURN true; END IF;

  -- 3. Permissoes basicas via acesso a rota:
  --    has_screen_access respeita overrides de usuario e fallback de role.
  --    Requer tambem que o usuario possa atuar na empresa da operacao.
  IF p_permission = ANY(BASIC_PERMS) THEN
    IF public.has_screen_access(p_user_id, 'plano_acoes_lista', 'visualizar'::public.app_acao)
       AND public.user_pode_atuar_empresa(p_user_id, p_empresa_id)
    THEN RETURN true; END IF;
  END IF;

  -- 4. Para permissoes elevadas (importar, aprovar, administrar) e fallback das basicas:
  --    verificacao de empresa + permissao granular em plano_acao_usuario_permissao.
  IF NOT public.user_pode_atuar_empresa(p_user_id, p_empresa_id) THEN RETURN false; END IF;

  EXECUTE format(
    'SELECT %I FROM public.plano_acao_usuario_permissao WHERE empresa_id = $1 AND profile_id = $2',
    'pode_' || p_permission
  ) INTO v_flag USING p_empresa_id, p_user_id;

  RETURN COALESCE(v_flag, false);
EXCEPTION WHEN undefined_column THEN RETURN false;
END;
$f$;
