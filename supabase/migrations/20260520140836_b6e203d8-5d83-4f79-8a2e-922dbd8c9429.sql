CREATE OR REPLACE FUNCTION public.sup_aprov_abrir_instancia(_fluxo_id uuid, _referencia_id uuid, _referencia_codigo text, _valor numeric, _centro_custo_id uuid, _solicitante uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_instancia_id uuid;
  v_alvo public.sup_aprov_alvo;
  v_empresa_id uuid;
  v_tem_orcamento boolean;
  v_gestor_cc uuid;
  v_cc_codigo text;
  v_cc_nome text;
  v_vincula boolean;
BEGIN
  SELECT alvo, empresa_id INTO v_alvo, v_empresa_id
  FROM public.sup_aprov_fluxo WHERE id = _fluxo_id;

  IF v_alvo IS NULL THEN
    RAISE EXCEPTION 'Fluxo % não encontrado', _fluxo_id;
  END IF;

  IF v_alvo = 'requisicao_compra' THEN
    SELECT gestor_user_id, codigo, nome
      INTO v_gestor_cc, v_cc_codigo, v_cc_nome
    FROM public.centros_custo WHERE id = _centro_custo_id;

    IF v_gestor_cc IS NULL THEN
      RAISE EXCEPTION 'Centro de custo % (%) não possui gestor definido. Cadastre o gestor em Administração → Alçadas → Gestores de CC antes de abrir requisições.',
        v_cc_codigo, v_cc_nome
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.sup_aprov_instancia (
    fluxo_id, alvo, referencia_id, referencia_codigo,
    valor, centro_custo_id, status, aberta_em, solicitante_user_id, empresa_id
  ) VALUES (
    _fluxo_id, v_alvo, _referencia_id, _referencia_codigo,
    _valor, _centro_custo_id, 'pendente', now(), _solicitante, v_empresa_id
  ) RETURNING id INTO v_instancia_id;

  IF v_alvo = 'requisicao_compra' THEN
    INSERT INTO public.sup_aprov_etapa (
      fluxo_id, instancia_id, ordem, nome, tipo_parecer, responsavel_user_id,
      valor_min, criticidade, ativo
    ) VALUES (
      _fluxo_id, v_instancia_id, 1, 'Aprovação de retirada', 'bloqueante', v_gestor_cc,
      0, 'normal', true
    );

    v_vincula := public.sup_aprov_vincula_orcamento(v_empresa_id, _centro_custo_id);
    IF v_vincula THEN
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
    END IF;
  ELSE
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
      AND NOT (
        COALESCE(e.regra_auto->>'tipo','') = 'orcamento_cc'
        AND COALESCE((e.regra_auto->>'vincular_orcamento')::boolean,
                     public.sup_aprov_vincula_orcamento(v_empresa_id, _centro_custo_id)) = false
      )
    ORDER BY e.ordem;
  END IF;

  PERFORM public.sup_aprov_avancar(v_instancia_id);
  RETURN v_instancia_id;
END;
$function$;