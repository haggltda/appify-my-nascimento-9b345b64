
-- 1) Vincular etapas dinâmicas a uma instância (nullable = template do fluxo)
ALTER TABLE public.sup_aprov_etapa
  ADD COLUMN IF NOT EXISTS instancia_id uuid REFERENCES public.sup_aprov_instancia(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sup_aprov_etapa_instancia ON public.sup_aprov_etapa(instancia_id);

-- 2) sup_aprov_avancar: considerar etapas globais do fluxo OU específicas da instância
CREATE OR REPLACE FUNCTION public.sup_aprov_avancar(_instancia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inst public.sup_aprov_instancia%ROWTYPE;
  _proxima public.sup_aprov_etapa%ROWTYPE;
BEGIN
  SELECT * INTO _inst FROM public.sup_aprov_instancia WHERE id = _instancia_id FOR UPDATE;
  IF _inst.status <> 'pendente' THEN RETURN; END IF;

  SELECT e.* INTO _proxima FROM public.sup_aprov_etapa e
  WHERE e.fluxo_id = _inst.fluxo_id
    AND e.ativo
    AND e.tipo_parecer = 'bloqueante'
    AND (e.instancia_id IS NULL OR e.instancia_id = _inst.id)
    AND COALESCE(_inst.valor,0) >= COALESCE(e.valor_min,0)
    AND (e.valor_max IS NULL OR COALESCE(_inst.valor,0) <= e.valor_max)
    AND NOT EXISTS (
      SELECT 1 FROM public.sup_aprov_voto v
      WHERE v.instancia_id=_inst.id AND v.etapa_id=e.id
    )
  ORDER BY e.ordem
  LIMIT 1;

  IF _proxima.id IS NULL THEN
    UPDATE public.sup_aprov_instancia
      SET status='aprovado', etapa_atual_id=NULL, fechada_em=now()
      WHERE id=_inst.id;
    RETURN;
  END IF;

  UPDATE public.sup_aprov_instancia SET etapa_atual_id=_proxima.id WHERE id=_inst.id;

  IF _proxima.regra_auto ? 'tipo' AND _proxima.regra_auto->>'tipo' = 'orcamento_cc' THEN
    IF public.sup_aprov_tem_orcamento_cc(_inst.centro_custo_id, _inst.valor) THEN
      INSERT INTO public.sup_aprov_voto(instancia_id, etapa_id, usuario_id, parecer, justificativa)
      VALUES (_inst.id, _proxima.id,
              COALESCE(_inst.solicitante_user_id, _proxima.responsavel_user_id),
              'aprovado', 'Auto-aprovado: orçamento do CC disponível.');
      PERFORM public.sup_aprov_avancar(_inst.id);
    END IF;
  END IF;
END $function$;

-- 3) sup_aprov_abrir_instancia: cria etapas dinâmicas vinculadas à instância + avança
DROP FUNCTION IF EXISTS public.sup_aprov_abrir_instancia(uuid, uuid, text, numeric, uuid, uuid);

CREATE FUNCTION public.sup_aprov_abrir_instancia(
  _fluxo_id uuid,
  _referencia_id uuid,
  _referencia_codigo text,
  _valor numeric,
  _centro_custo_id uuid,
  _solicitante uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Requisição: cria etapas dinâmicas vinculadas à instância
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
  END IF;

  -- Posiciona na primeira etapa pendente (e auto-aprova orçamento_cc se aplicável)
  PERFORM public.sup_aprov_avancar(v_instancia_id);

  RETURN v_instancia_id;
END;
$$;
