
-- 1. Coluna padrão na empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS vincular_orcamento_padrao boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.empresas.vincular_orcamento_padrao IS
'Padrão da empresa: se true, requisições que estouram o orçamento do CC exigem 2ª etapa de aprovação ("Aprovação por ultrapassar orçamento"). CCs e etapas podem sobrescrever.';

-- 2. Override por centro de custo (nullable = herda da empresa)
ALTER TABLE public.centros_custo
  ADD COLUMN IF NOT EXISTS vincular_orcamento boolean NULL;

COMMENT ON COLUMN public.centros_custo.vincular_orcamento IS
'Override por CC. NULL = herda de empresas.vincular_orcamento_padrao. true/false = decisão explícita.';

-- 3. Helper de resolução (Empresa default → CC override → Etapa override)
CREATE OR REPLACE FUNCTION public.sup_aprov_vincula_orcamento(
  _empresa_id uuid,
  _centro_custo_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cc.vincular_orcamento FROM public.centros_custo cc WHERE cc.id = _centro_custo_id),
    (SELECT e.vincular_orcamento_padrao FROM public.empresas e WHERE e.id = _empresa_id),
    true
  );
$$;

COMMENT ON FUNCTION public.sup_aprov_vincula_orcamento(uuid, uuid) IS
'Resolve a flag "vincular orçamento" pela ordem: CC.vincular_orcamento (se NOT NULL) → empresas.vincular_orcamento_padrao → true (fallback seguro).';

-- 4. Atualiza sup_aprov_abrir_instancia para respeitar a flag
CREATE OR REPLACE FUNCTION public.sup_aprov_abrir_instancia(
  _fluxo_id uuid, _referencia_id uuid, _referencia_codigo text,
  _valor numeric, _centro_custo_id uuid, _solicitante uuid
)
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
  v_vincula boolean;
BEGIN
  SELECT alvo, empresa_id INTO v_alvo, v_empresa_id
  FROM public.sup_aprov_fluxo WHERE id = _fluxo_id;

  IF v_alvo IS NULL THEN
    RAISE EXCEPTION 'Fluxo % não encontrado', _fluxo_id;
  END IF;

  INSERT INTO public.sup_aprov_instancia (
    fluxo_id, alvo, referencia_id, referencia_codigo,
    valor, centro_custo_id, status, aberta_em, solicitante_user_id, empresa_id
  ) VALUES (
    _fluxo_id, v_alvo, _referencia_id, _referencia_codigo,
    _valor, _centro_custo_id, 'pendente', now(), _solicitante, v_empresa_id
  ) RETURNING id INTO v_instancia_id;

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

    -- Só cria 2ª etapa "estouro de orçamento" se a flag estiver true (resolvida em 3 níveis)
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
    -- Demais alvos: copia etapas-modelo, respeitando override de etapa
    -- regra_auto->>'vincular_orcamento' = 'false' pula a etapa "estouro" do template
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
