-- Adiciona classificação "Tipo de Ação" (Ação | Tarefa) ao plano_acao.
-- Default 'acao' cobre tanto o backfill de linhas existentes quanto novas
-- linhas criadas sem escolha explícita (seed inicial, importação Excel).

ALTER TABLE public.plano_acao
  ADD COLUMN IF NOT EXISTS tipo_acao text NOT NULL DEFAULT 'acao';

ALTER TABLE public.plano_acao
  DROP CONSTRAINT IF EXISTS plano_acao_tipo_acao_check;
ALTER TABLE public.plano_acao
  ADD CONSTRAINT plano_acao_tipo_acao_check CHECK (tipo_acao IN ('acao', 'tarefa'));

-- criar_plano_acao ganha o parâmetro _tipo_acao (novo, no final, com DEFAULT).
-- Como isso muda a assinatura (18 args em vez de 17), CREATE OR REPLACE criaria
-- um overload novo em vez de substituir — por isso o DROP explícito da versão
-- de 17 args antes de recriar, evitando repetir o overload órfão de 15 args
-- que já existe desde 20260611000003 (nunca removido quando o de 17 args
-- foi criado em 20260617000002).
DROP FUNCTION IF EXISTS public.criar_plano_acao(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text, text, uuid[]
);

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
  _usuarios_visibilidade     uuid[]  DEFAULT NULL,
  _tipo_acao                 text    DEFAULT 'acao'
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

  IF _tipo_acao NOT IN ('acao', 'tarefa') THEN
    _tipo_acao := 'acao';
  END IF;

  INSERT INTO public.plano_acao (
    empresa_id, titulo, problema, acao,
    comite, area, setor,
    prioridade_normalizada, status_normalizado,
    responsavel_profile_id, responsavel_nome_origem, lider_comite_nome_origem,
    data_inicio_planejado, data_fim_planejado,
    comentarios, origem, visibilidade, tipo_acao
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
    _visibilidade,
    _tipo_acao
  ) RETURNING id INTO v_id;

  -- Para visibilidade específica: monta a lista garantindo que o criador
  -- está sempre incluído (sem ele, ele mesmo perderia acesso ao plano).
  IF _visibilidade = 'especifico' THEN
    v_usuarios := COALESCE(_usuarios_visibilidade, ARRAY[]::uuid[]);

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
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text, text, uuid[], text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_plano_acao(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text, text, uuid[], text
) TO authenticated;
