-- =========================================================================
-- FIX: Permissão plano de ação + dropdown de comitês
--
-- Problema A: O fallback de useComitesMap lê plano_acao diretamente, mas a
-- RLS estrita bloqueia registros que o usuário não criou/não é responsável.
-- Resultado: dropdowns de COMITÊ/SETOR ficam vazios (viram campo de texto).
--
-- Problema B: usePlanoAcaoPermissao lê só plano_acao_usuario_permissao.
-- O bypass de admin existe no backend (plano_acao_can_access) mas não no
-- hook frontend. Admins e acessa_todas_empresas = true ficam sem o botão
-- "+Nova" mesmo tendo permissão real.
--
-- Solução:
--   1. minha_permissao_plano_acao(_empresa_id) — SECURITY DEFINER, retorna
--      as flags corretas considerando admin role e acessa_todas_empresas.
--   2. plano_acao_comites_lista(_empresa_id)   — SECURITY DEFINER, retorna
--      comite/area/lider distintos de plano_acao sem passar pela RLS de
--      visibilidade (só os nomes, sem conteúdo sensível).
-- =========================================================================

-- 1. Permissões do usuário atual respeitando admin role
CREATE OR REPLACE FUNCTION public.minha_permissao_plano_acao(_empresa_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_all json := '{"pode_visualizar":true,"pode_dashboard":true,"pode_criar":true,"pode_editar":true,"pode_excluir":true,"pode_importar":true,"pode_aprovar":true,"pode_administrar":true,"pode_ver_todas":true}'::json;
  v_none json := '{"pode_visualizar":false,"pode_dashboard":false,"pode_criar":false,"pode_editar":false,"pode_excluir":false,"pode_importar":false,"pode_aprovar":false,"pode_administrar":false,"pode_ver_todas":false}'::json;
  v_row public.plano_acao_usuario_permissao%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN v_none; END IF;

  -- Bypass: admin global
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN RETURN v_all; END IF;

  -- Bypass: acessa_todas_empresas
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND acessa_todas_empresas = true
  ) THEN RETURN v_all; END IF;

  -- Lê entrada explícita na tabela de permissões
  SELECT * INTO v_row
  FROM public.plano_acao_usuario_permissao
  WHERE empresa_id = _empresa_id AND profile_id = v_uid;

  IF NOT FOUND THEN RETURN v_none; END IF;

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
END;
$$;

REVOKE ALL ON FUNCTION public.minha_permissao_plano_acao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.minha_permissao_plano_acao(uuid) TO authenticated;

-- 2. Lista de comitês/áreas para dropdown (sem restrição de visibilidade)
--    Retorna apenas nomes organizacionais — sem conteúdo sensível dos planos.
CREATE OR REPLACE FUNCTION public.plano_acao_comites_lista(_empresa_id uuid)
RETURNS TABLE(comite text, area text, lider_comite_nome_origem text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    pa.comite,
    pa.area,
    pa.lider_comite_nome_origem
  FROM public.plano_acao pa
  WHERE pa.empresa_id   = _empresa_id
    AND pa.deleted_at   IS NULL
    AND pa.comite       IS NOT NULL
  ORDER BY pa.comite, pa.area;
$$;

REVOKE ALL ON FUNCTION public.plano_acao_comites_lista(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plano_acao_comites_lista(uuid) TO authenticated;
