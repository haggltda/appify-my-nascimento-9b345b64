-- =========================================================================
-- PLANO DE AÇÕES: Controle de visibilidade por linha
--
-- 1. Coluna visibilidade em plano_acao (privado|publico|especifico)
-- 2. Tabela plano_acao_visibilidade_usuario (lista de usuários específicos)
-- 3. Coluna pode_ver_todas em plano_acao_usuario_permissao (Helena, Erica)
-- 4. plano_acao_can_access: remove 'criar' dos BASIC_PERMS (exige pode_criar explícito)
-- 5. Nova política pa_select com visibilidade por linha
-- 6. criar_plano_acao: novos parâmetros _visibilidade e _usuarios_visibilidade
-- =========================================================================

-- 1. Coluna visibilidade
ALTER TABLE public.plano_acao
  ADD COLUMN IF NOT EXISTS visibilidade TEXT NOT NULL DEFAULT 'privado'
  CHECK (visibilidade IN ('privado', 'publico', 'especifico'));

-- 2. Tabela plano_acao_visibilidade_usuario
CREATE TABLE IF NOT EXISTS public.plano_acao_visibilidade_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_acao_id uuid NOT NULL REFERENCES public.plano_acao(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plano_acao_id, profile_id)
);

CREATE INDEX IF NOT EXISTS pav_plano_profile_idx
  ON public.plano_acao_visibilidade_usuario(plano_acao_id, profile_id);
CREATE INDEX IF NOT EXISTS pav_profile_empresa_idx
  ON public.plano_acao_visibilidade_usuario(profile_id, empresa_id);

ALTER TABLE public.plano_acao_visibilidade_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pav_select ON public.plano_acao_visibilidade_usuario;
CREATE POLICY pav_select ON public.plano_acao_visibilidade_usuario FOR SELECT TO authenticated
  USING (public.user_pode_atuar_empresa(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pav_insert ON public.plano_acao_visibilidade_usuario;
CREATE POLICY pav_insert ON public.plano_acao_visibilidade_usuario FOR INSERT TO authenticated
  WITH CHECK (
    public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      public.plano_acao_can_access(auth.uid(), empresa_id, 'editar')
      OR EXISTS (
        SELECT 1 FROM public.plano_acao
        WHERE id = plano_acao_id AND criado_por = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS pav_delete ON public.plano_acao_visibilidade_usuario;
CREATE POLICY pav_delete ON public.plano_acao_visibilidade_usuario FOR DELETE TO authenticated
  USING (
    public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      public.plano_acao_can_access(auth.uid(), empresa_id, 'editar')
      OR EXISTS (
        SELECT 1 FROM public.plano_acao
        WHERE id = plano_acao_id AND criado_por = auth.uid()
      )
    )
  );

-- 3. Coluna pode_ver_todas
ALTER TABLE public.plano_acao_usuario_permissao
  ADD COLUMN IF NOT EXISTS pode_ver_todas BOOLEAN NOT NULL DEFAULT false;

-- 4. Atualizar plano_acao_can_access: remove 'criar' dos BASIC_PERMS
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
  -- 'criar' removido: exige pode_criar=true explícito em plano_acao_usuario_permissao
  BASIC_PERMS CONSTANT text[] := ARRAY['visualizar','dashboard','editar','excluir'];
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  -- Bypass admin
  IF public.has_role(p_user_id, 'admin'::app_role) THEN RETURN true; END IF;

  -- Bypass acessa_todas_empresas
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.acessa_todas_empresas = true
  ) THEN RETURN true; END IF;

  -- Permissões básicas via acesso à rota (exceto criar)
  IF p_permission = ANY(BASIC_PERMS) THEN
    IF public.has_screen_access(p_user_id, 'plano_acoes_lista', 'visualizar'::public.app_acao)
       AND public.user_pode_atuar_empresa(p_user_id, p_empresa_id)
    THEN RETURN true; END IF;
  END IF;

  -- Permissões elevadas (criar, importar, aprovar, administrar) e fallback das básicas:
  -- requer entrada explícita em plano_acao_usuario_permissao
  IF NOT public.user_pode_atuar_empresa(p_user_id, p_empresa_id) THEN RETURN false; END IF;

  EXECUTE format(
    'SELECT %I FROM public.plano_acao_usuario_permissao WHERE empresa_id = $1 AND profile_id = $2',
    'pode_' || p_permission
  ) INTO v_flag USING p_empresa_id, p_user_id;

  RETURN COALESCE(v_flag, false);
EXCEPTION WHEN undefined_column THEN RETURN false;
END;
$f$;

-- 5. Nova política pa_select com visibilidade por linha
DROP POLICY IF EXISTS pa_select ON public.plano_acao;
CREATE POLICY pa_select ON public.plano_acao FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      -- Admin global
      public.has_role(auth.uid(), 'admin'::app_role)
      -- acessa_todas_empresas
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND acessa_todas_empresas = true
      )
      -- pode_ver_todas ou pode_administrar (Helena, Erica, administradores do módulo)
      OR EXISTS (
        SELECT 1 FROM public.plano_acao_usuario_permissao
        WHERE profile_id = auth.uid()
          AND empresa_id = plano_acao.empresa_id
          AND (pode_ver_todas = true OR pode_administrar = true)
      )
      -- Criador sempre enxerga a própria ação
      OR criado_por = auth.uid()
      -- Responsável: ação "direcionada a ti"
      OR responsavel_profile_id = auth.uid()
      -- Visibilidade pública
      OR visibilidade = 'publico'
      -- Visibilidade específica: usuário na lista
      OR (
        visibilidade = 'especifico'
        AND EXISTS (
          SELECT 1 FROM public.plano_acao_visibilidade_usuario pav
          WHERE pav.plano_acao_id = plano_acao.id
            AND pav.profile_id = auth.uid()
        )
      )
    )
  );

-- 6. Atualizar criar_plano_acao com novos parâmetros de visibilidade
CREATE OR REPLACE FUNCTION public.criar_plano_acao(
  _empresa_id                uuid,
  _titulo                    text,
  _problema                  text DEFAULT NULL,
  _acao                      text DEFAULT NULL,
  _comite                    text DEFAULT NULL,
  _area                      text DEFAULT NULL,
  _setor                     text DEFAULT NULL,
  _prioridade_normalizada    text DEFAULT 'media',
  _status_normalizado        text DEFAULT 'a_definir',
  _responsavel_profile_id    uuid DEFAULT NULL,
  _responsavel_nome_origem   text DEFAULT NULL,
  _lider_comite_nome_origem  text DEFAULT NULL,
  _data_inicio_planejado     date DEFAULT NULL,
  _data_fim_planejado        date DEFAULT NULL,
  _comentarios               text DEFAULT NULL,
  _visibilidade              text DEFAULT 'privado',
  _usuarios_visibilidade     uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.plano_acao_can_access(auth.uid(), _empresa_id, 'criar') THEN
    RAISE EXCEPTION 'sem_permissao_criar_plano_acao' USING ERRCODE = '42501';
  END IF;

  -- Garante valor válido de visibilidade
  IF _visibilidade NOT IN ('privado', 'publico', 'especifico') THEN
    _visibilidade := 'privado';
  END IF;

  INSERT INTO public.plano_acao (
    empresa_id, titulo, problema, acao,
    comite, area, setor,
    prioridade_normalizada, status_normalizado,
    responsavel_profile_id, responsavel_nome_origem, lider_comite_nome_origem,
    data_inicio_planejado, data_fim_planejado,
    comentarios, origem, visibilidade
  ) VALUES (
    _empresa_id,
    _titulo,
    NULLIF(_problema, ''),
    NULLIF(_acao, ''),
    NULLIF(_comite, ''),
    NULLIF(_area, ''),
    NULLIF(_setor, ''),
    _prioridade_normalizada,
    _status_normalizado,
    _responsavel_profile_id,
    NULLIF(_responsavel_nome_origem, ''),
    NULLIF(_lider_comite_nome_origem, ''),
    _data_inicio_planejado,
    _data_fim_planejado,
    NULLIF(_comentarios, ''),
    'manual',
    _visibilidade
  ) RETURNING id INTO v_id;

  -- Insere usuários específicos quando visibilidade = 'especifico'
  IF _visibilidade = 'especifico' AND _usuarios_visibilidade IS NOT NULL AND array_length(_usuarios_visibilidade, 1) > 0 THEN
    INSERT INTO public.plano_acao_visibilidade_usuario (plano_acao_id, empresa_id, profile_id)
    SELECT v_id, _empresa_id, unnest(_usuarios_visibilidade)
    ON CONFLICT (plano_acao_id, profile_id) DO NOTHING;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_plano_acao(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text, text, uuid[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_plano_acao(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text, text, uuid[]
) TO authenticated;
