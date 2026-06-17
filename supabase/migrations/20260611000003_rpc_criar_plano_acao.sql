-- RPC SECURITY DEFINER para criar plano de acao manualmente.
-- Contorna o RLS do INSERT direto (mesmo padrao de plano_acao_seed_inicial).
-- Valida permissao internamente via plano_acao_can_access antes de inserir.

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
  _comentarios               text DEFAULT NULL
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

  INSERT INTO public.plano_acao (
    empresa_id, titulo, problema, acao,
    comite, area, setor,
    prioridade_normalizada, status_normalizado,
    responsavel_profile_id, responsavel_nome_origem, lider_comite_nome_origem,
    data_inicio_planejado, data_fim_planejado,
    comentarios, origem
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
    'manual'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_plano_acao(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_plano_acao(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text, date, date, text
) TO authenticated;
