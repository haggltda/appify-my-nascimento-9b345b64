-- Quando um item de pauta em condução "gera ação", a ação agora vira um
-- registro de verdade no módulo Plano de Ações (não fica só numa tabela
-- própria da agenda). O bloqueio de sempre é a permissão pode_criar de
-- plano_acao_can_access, que a maioria de quem lidera reunião não tem —
-- em vez de tocar no sistema de permissões (que está sendo desenvolvido
-- em paralelo por outro agente), esta RPC libera especificamente para
-- quem tem interação com a reunião de origem (mesmo critério de
-- tem_interacao_reuniao: criador, organizador, responsável pela ata ou
-- convidado).
--
-- reuniao_decisao_acao continua existindo como espelho local — pauta_id
-- + tipo/status continuam sendo consultados pelo painel de condução e
-- pelo Painel Gerencial sem mudança nas queries; só ganha plano_acao_id
-- apontando pro registro real quando tipo = 'acao'.
--
-- _area é o campo rotulado "Setor" na tela de condução (mesma confusão de
-- nomes do módulo Plano de Ações de verdade: a coluna plano_acao.area é
-- que aparece como "Setor" no formulário — plano_acao.setor é só um campo
-- legado de importação CSV, nunca preenchido pelo formulário manual).

ALTER TABLE public.reuniao_decisao_acao
  ADD COLUMN IF NOT EXISTS plano_acao_id uuid REFERENCES public.plano_acao(id);

-- Assinatura mudou (14 → 16 args) — precisa do DROP explícito, CREATE OR
-- REPLACE não deixa mudar a lista de parâmetros.
DROP FUNCTION IF EXISTS public.criar_acao_reuniao_plano_acao(
  uuid, uuid, text, text, text, text, text, text, text, date, date, uuid, uuid, text, text
);

CREATE OR REPLACE FUNCTION public.criar_acao_reuniao_plano_acao(
  _reuniao_id                uuid,
  _pauta_id                  uuid,
  _titulo                    text,
  _problema                  text    DEFAULT NULL,
  _acao                      text    DEFAULT NULL,
  _comite                    text    DEFAULT NULL,
  _area                      text    DEFAULT NULL,
  _prioridade_normalizada    text    DEFAULT 'media',
  _status_normalizado        text    DEFAULT 'a_definir',
  _data_inicio_planejado     date    DEFAULT NULL,
  _data_fim_planejado        date    DEFAULT NULL,
  _responsavel_profile_id    uuid    DEFAULT NULL,
  _lider_comite_profile_id   uuid    DEFAULT NULL,
  _visibilidade              text    DEFAULT 'privado',
  _comentarios                text   DEFAULT NULL,
  _tipo_acao                 text    DEFAULT 'acao'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              uuid;
  v_empresa_id        uuid;
  v_plano_acao_id     uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.tem_interacao_reuniao(_reuniao_id) THEN
    RAISE EXCEPTION 'sem_interacao_reuniao' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.reuniao_pauta p
    WHERE p.id = _pauta_id AND p.reuniao_id = _reuniao_id
  ) THEN
    RAISE EXCEPTION 'pauta_nao_pertence_a_reuniao' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(empresa_atual_id, empresa_id) INTO v_empresa_id
  FROM public.profiles WHERE id = v_uid;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_resolvida' USING ERRCODE = '22023';
  END IF;

  IF _visibilidade NOT IN ('privado', 'publico', 'especifico') THEN
    _visibilidade := 'privado';
  END IF;

  IF _tipo_acao NOT IN ('acao', 'tarefa') THEN
    _tipo_acao := 'acao';
  END IF;

  INSERT INTO public.plano_acao (
    empresa_id, titulo, problema, acao,
    comite, area,
    prioridade_normalizada, status_normalizado,
    responsavel_profile_id,
    lider_comite_profile_id,
    data_inicio_planejado, data_fim_planejado,
    comentarios, origem, metadata_origem, visibilidade, tipo_acao
  ) VALUES (
    v_empresa_id,
    _titulo,
    NULLIF(_problema, ''),
    NULLIF(_acao, ''),
    NULLIF(_comite, ''),
    NULLIF(_area, ''),
    _prioridade_normalizada,
    _status_normalizado,
    _responsavel_profile_id,
    _lider_comite_profile_id,
    _data_inicio_planejado,
    _data_fim_planejado,
    NULLIF(_comentarios, ''),
    'reuniao',
    jsonb_build_object('reuniao_id', _reuniao_id, 'pauta_id', _pauta_id),
    _visibilidade,
    _tipo_acao
  ) RETURNING id INTO v_plano_acao_id;

  INSERT INTO public.reuniao_decisao_acao (
    pauta_id, tipo, texto, responsavel_user_id, prazo, prioridade, status, setor_impactado, plano_acao_id
  ) VALUES (
    _pauta_id,
    'acao',
    _titulo,
    _responsavel_profile_id,
    _data_fim_planejado,
    CASE WHEN _prioridade_normalizada IN ('alta', 'media', 'baixa') THEN _prioridade_normalizada
         WHEN _prioridade_normalizada = 'emergencial' THEN 'alta'
         ELSE 'media' END,
    CASE WHEN _status_normalizado = 'em_andamento' THEN 'em_andamento'
         WHEN _status_normalizado IN ('concluida_pendente_evidencia', 'concluida_validada', 'cancelada') THEN 'concluida'
         ELSE 'pendente' END,
    NULLIF(_area, ''),
    v_plano_acao_id
  );

  RETURN v_plano_acao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_acao_reuniao_plano_acao(
  uuid, uuid, text, text, text, text, text, text, text, date, date, uuid, uuid, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_acao_reuniao_plano_acao(
  uuid, uuid, text, text, text, text, text, text, text, date, date, uuid, uuid, text, text, text
) TO authenticated;
