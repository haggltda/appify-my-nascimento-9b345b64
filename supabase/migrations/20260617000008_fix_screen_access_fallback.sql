-- =========================================================================
-- FIX: screen_access como fallback para permissões de plano de ação
--
-- Problema: usuários com acesso ao módulo via administracao?tab=modulos
-- (screen_permission_user) não conseguiam criar planos de ação porque:
--   a) plano_acao_can_access exigia entrada explícita em
--      plano_acao_usuario_permissao para 'criar' (sem fallback de tela)
--   b) minha_permissao_plano_acao idem: retornava NONE quando sem entrada
--
-- Solução:
--   Quando não há entrada em plano_acao_usuario_permissao para o usuário,
--   o acesso à tela (screen_permission_user) é suficiente para conceder
--   TODAS as permissões do módulo — inclusive criar.
--
--   Se existe entrada explícita (mesmo com alguma flag = false), ela é
--   respeitada integralmente — o admin pode restringir individualmente.
-- =========================================================================

-- 1. Atualiza plano_acao_can_access: adiciona fallback por screen_access
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
  v_flag  boolean;
  BASIC_PERMS CONSTANT text[] := ARRAY['visualizar','dashboard','editar','excluir'];
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  -- Bypass admin global
  IF public.has_role(p_user_id, 'admin'::public.app_role) THEN RETURN true; END IF;

  -- Bypass acessa_todas_empresas
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.acessa_todas_empresas = true
  ) THEN RETURN true; END IF;

  -- Permissões básicas via screen access (sempre incluídas quando há acesso à tela)
  IF p_permission = ANY(BASIC_PERMS) THEN
    IF public.has_screen_access(p_user_id, 'plano_acoes_lista', 'visualizar'::public.app_acao)
       AND public.user_pode_atuar_empresa(p_user_id, p_empresa_id)
    THEN RETURN true; END IF;
  END IF;

  IF NOT public.user_pode_atuar_empresa(p_user_id, p_empresa_id) THEN RETURN false; END IF;

  -- Verifica entrada explícita em plano_acao_usuario_permissao
  EXECUTE format(
    'SELECT %I FROM public.plano_acao_usuario_permissao WHERE empresa_id = $1 AND profile_id = $2',
    'pode_' || p_permission
  ) INTO v_flag USING p_empresa_id, p_user_id;

  -- Se existe entrada explícita (true ou false), respeitá-la
  IF v_flag IS NOT NULL THEN RETURN v_flag; END IF;

  -- Sem entrada explícita: fallback por acesso à tela do módulo
  -- (acesso concedido via administracao?tab=modulos = acesso completo ao módulo)
  IF public.has_screen_access(p_user_id, 'plano_acoes_lista', 'visualizar'::public.app_acao)
  THEN RETURN true; END IF;

  RETURN false;
EXCEPTION WHEN undefined_column THEN RETURN false;
END;
$f$;

-- 2. Atualiza minha_permissao_plano_acao: mesmo fallback no hook frontend
CREATE OR REPLACE FUNCTION public.minha_permissao_plano_acao(_empresa_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_all  json := '{"pode_visualizar":true,"pode_dashboard":true,"pode_criar":true,"pode_editar":true,"pode_excluir":true,"pode_importar":true,"pode_aprovar":true,"pode_administrar":true,"pode_ver_todas":true}'::json;
  v_none json := '{"pode_visualizar":false,"pode_dashboard":false,"pode_criar":false,"pode_editar":false,"pode_excluir":false,"pode_importar":false,"pode_aprovar":false,"pode_administrar":false,"pode_ver_todas":false}'::json;
  v_row  public.plano_acao_usuario_permissao%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN v_none; END IF;

  -- Bypass: admin global
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN RETURN v_all; END IF;

  -- Bypass: acessa_todas_empresas
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND acessa_todas_empresas = true
  ) THEN RETURN v_all; END IF;

  -- Entrada explícita em plano_acao_usuario_permissao (controle fino)
  SELECT * INTO v_row
  FROM public.plano_acao_usuario_permissao
  WHERE empresa_id = _empresa_id AND profile_id = v_uid;

  IF FOUND THEN
    RETURN json_build_object(
      'pode_visualizar',  COALESCE(v_row.pode_visualizar,  false),
      'pode_dashboard',   COALESCE(v_row.pode_dashboard,   false),
      'pode_criar',       COALESCE(v_row.pode_criar,       false),
      'pode_editar',      COALESCE(v_row.pode_editar,      false),
      'pode_excluir',     COALESCE(v_row.pode_excluir,     false),
      'pode_importar',    COALESCE(v_row.pode_importar,    false),
      'pode_aprovar',     COALESCE(v_row.pode_aprovar,     false),
      'pode_administrar', COALESCE(v_row.pode_administrar, false),
      'pode_ver_todas',   COALESCE(v_row.pode_ver_todas,   false)
    );
  END IF;

  -- Sem entrada explícita: fallback por acesso à tela
  -- (acesso via administracao?tab=modulos = acesso completo ao módulo)
  IF public.has_screen_access(v_uid, 'plano_acoes_lista', 'visualizar'::public.app_acao)
     AND public.user_pode_atuar_empresa(v_uid, _empresa_id)
  THEN RETURN v_all; END IF;

  RETURN v_none;
END;
$$;
