
-- Helper: devolve o fluxo ativo padrão da empresa para um alvo
CREATE OR REPLACE FUNCTION public.sup_aprov_fluxo_padrao(_empresa_id uuid, _alvo public.sup_aprov_alvo)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.sup_aprov_fluxo
   WHERE empresa_id = _empresa_id AND alvo = _alvo AND ativo = true
   ORDER BY created_at ASC NULLS LAST, id ASC
   LIMIT 1
$$;

-- Estende abrir_instancia: para alvos não-requisição, copia etapas template do fluxo
CREATE OR REPLACE FUNCTION public.sup_aprov_abrir_instancia(
  _fluxo_id uuid, _referencia_id uuid, _referencia_codigo text,
  _valor numeric, _centro_custo_id uuid, _solicitante uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_instancia_id uuid;
  v_alvo public.sup_aprov_alvo;
  v_empresa_id uuid;
  v_tem_orcamento boolean;
  v_gestor_cc uuid;
BEGIN
  SELECT alvo, empresa_id INTO v_alvo, v_empresa_id
  FROM public.sup_aprov_fluxo
  WHERE id = _fluxo_id;

  IF v_alvo IS NULL THEN
    RAISE EXCEPTION 'Fluxo % não encontrado', _fluxo_id;
  END IF;

  INSERT INTO public.sup_aprov_instancia (
    fluxo_id, alvo, referencia_id, referencia_codigo,
    valor, centro_custo_id, status, aberta_em, solicitante_user_id, empresa_id
  )
  VALUES (
    _fluxo_id, v_alvo, _referencia_id, _referencia_codigo,
    _valor, _centro_custo_id, 'pendente', now(), _solicitante, v_empresa_id
  )
  RETURNING id INTO v_instancia_id;

  IF v_alvo = 'requisicao_compra' THEN
    SELECT gestor_user_id INTO v_gestor_cc
    FROM public.centros_custo WHERE id = _centro_custo_id;

    INSERT INTO public.sup_aprov_etapa (
      fluxo_id, instancia_id, ordem, nome, tipo_parecer, responsavel_user_id,
      valor_min, criticidade, ativo
    ) VALUES (
      _fluxo_id, v_instancia_id, 1, 'Aprovação de retirada', 'bloqueante', v_gestor_cc,
      0, 'normal', true
    );

    v_tem_orcamento := public.sup_aprov_tem_orcamento_cc(_centro_custo_id, _valor, NULL);
    IF NOT v_tem_orcamento THEN
      INSERT INTO public.sup_aprov_etapa (
        fluxo_id, instancia_id, ordem, nome, tipo_parecer, responsavel_user_id,
        valor_min, criticidade, ativo
      ) VALUES (
        _fluxo_id, v_instancia_id, 2, 'Aprovação por ultrapassar orçamento', 'bloqueante', v_gestor_cc,
        0, 'urgente', true
      );
    END IF;
  ELSE
    -- Para os demais alvos, copia etapas template do fluxo (instancia_id IS NULL),
    -- aplicando faixa de valor quando definida.
    INSERT INTO public.sup_aprov_etapa (
      fluxo_id, instancia_id, ordem, nome, tipo_parecer, responsavel_user_id,
      delegado_para_user_id, delegado_ate,
      valor_min, valor_max, criticidade, prazo_horas, regra_auto, ativo
    )
    SELECT
      e.fluxo_id, v_instancia_id, e.ordem, e.nome, e.tipo_parecer, e.responsavel_user_id,
      e.delegado_para_user_id, e.delegado_ate,
      e.valor_min, e.valor_max, e.criticidade, e.prazo_horas, e.regra_auto, e.ativo
    FROM public.sup_aprov_etapa e
    WHERE e.fluxo_id = _fluxo_id
      AND e.instancia_id IS NULL
      AND e.ativo = true
      AND (e.valor_min IS NULL OR _valor IS NULL OR _valor >= e.valor_min)
      AND (e.valor_max IS NULL OR _valor IS NULL OR _valor <= e.valor_max)
    ORDER BY e.ordem;
  END IF;

  PERFORM public.sup_aprov_avancar(v_instancia_id);
  RETURN v_instancia_id;
END;
$$;
