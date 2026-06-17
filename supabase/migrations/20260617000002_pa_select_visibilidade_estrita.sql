-- Migration: 20260617000002_pa_select_visibilidade_estrita
-- Objetivo: Visibilidade ABSOLUTAMENTE ESTRITA para plano_acao.
--
-- Regras:
--   visibilidade = 'publico'   → todos com acesso ao módulo na empresa
--   visibilidade = 'privado'   → apenas criador e responsável (+ administradores do módulo)
--   visibilidade = 'especifico'→ SOMENTE as pessoas explicitamente na lista
--                                plano_acao_visibilidade_usuario.
--                                Nenhuma exceção: nem admin, nem pode_ver_todas,
--                                nem pode_administrar, nada.
--
-- O RPC criar_plano_acao (abaixo) garante que o criador é automaticamente
-- inserido na lista quando visibilidade = 'especifico', para que ele não
-- perca acesso ao que criou.
-- =========================================================================

-- 1. Recria pa_select com política estrita
DROP POLICY IF EXISTS pa_select ON public.plano_acao;

CREATE POLICY pa_select ON public.plano_acao
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      -- PÚBLICO: qualquer usuário da empresa com acesso ao módulo
      visibilidade = 'publico'

      -- PRIVADO (ou NULL legado): criador, responsável ou administrador do módulo
      OR (
        (visibilidade = 'privado' OR visibilidade IS NULL)
        AND (
          criado_por = auth.uid()
          OR responsavel_profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.plano_acao_usuario_permissao pap
             WHERE pap.profile_id = auth.uid()
               AND pap.empresa_id = plano_acao.empresa_id
               AND (pap.pode_ver_todas = true OR pap.pode_administrar = true)
          )
        )
      )

      -- ESPECÍFICO: SOMENTE quem está na lista explícita.
      -- Não existe bypass aqui — nem admin, nem role, nem pode_ver_todas.
      OR (
        visibilidade = 'especifico'
        AND EXISTS (
          SELECT 1 FROM public.plano_acao_visibilidade_usuario pav
           WHERE pav.plano_acao_id = plano_acao.id
             AND pav.profile_id    = auth.uid()
        )
      )
    )
  );

-- 2. Atualiza criar_plano_acao: criador é automaticamente adicionado
--    à lista de visibilidade quando visibilidade = 'especifico'.
--    Assim ele nunca perde acesso ao plano que acabou de criar.
CREATE OR REPLACE FUNCTION public.criar_plano_acao(
  _empresa_id                uuid,
  _titulo                    text,
  _problema                  text    DEFAULT NULL,
  _acao                      text    DEFAULT NULL,
  _comite                    text    DEFAULT NULL,
  _area                      text    DEFAULT NULL,
  _setor                     text    DEFAULT NULL,
  _prioridade_normalizada    text    DEFAULT 'media',
  _status_normalizado        text    DEFAULT 'a_definir',
  _responsavel_profile_id    uuid    DEFAULT NULL,
  _responsavel_nome_origem   text    DEFAULT NULL,
  _lider_comite_nome_origem  text    DEFAULT NULL,
  _data_inicio_planejado     date    DEFAULT NULL,
  _data_fim_planejado        date    DEFAULT NULL,
  _comentarios               text    DEFAULT NULL,
  _visibilidade              text    DEFAULT 'privado',
  _usuarios_visibilidade     uuid[]  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_uid      uuid;
  v_usuarios uuid[];
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.plano_acao_can_access(v_uid, _empresa_id, 'criar') THEN
    RAISE EXCEPTION 'sem_permissao_criar_plano_acao' USING ERRCODE = '42501';
  END IF;

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

  -- Para visibilidade específica: monta a lista garantindo que o criador
  -- está sempre incluído (sem ele, ele mesmo perderia acesso ao plano).
  IF _visibilidade = 'especifico' THEN
    v_usuarios := COALESCE(_usuarios_visibilidade, ARRAY[]::uuid[]);

    -- Garante que o criador está na lista
    IF NOT (v_uid = ANY(v_usuarios)) THEN
      v_usuarios := array_append(v_usuarios, v_uid);
    END IF;

    IF array_length(v_usuarios, 1) > 0 THEN
      INSERT INTO public.plano_acao_visibilidade_usuario (plano_acao_id, empresa_id, profile_id)
      SELECT v_id, _empresa_id, unnest(v_usuarios)
      ON CONFLICT (plano_acao_id, profile_id) DO NOTHING;
    END IF;
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
