
-- 1) Adicionar 'pedido_compra' ao enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'sup_aprov_alvo' AND e.enumlabel = 'pedido_compra'
  ) THEN
    ALTER TYPE public.sup_aprov_alvo ADD VALUE 'pedido_compra';
  END IF;
END$$;

-- 2) Flag por empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS auto_aprovar_orcamento_cc boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.empresas.auto_aprovar_orcamento_cc IS
  'Quando true, a regra orcamento_cc em etapas de Pedido de compra auto-aprova se há saldo no CC dentro da vigência do orçamento.';

-- 3) Recriar função (drop + create para poder renomear parâmetros se necessário)
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
    valor, centro_custo_id, status, aberta_em, solicitante_user_id
  )
  VALUES (
    _fluxo_id, v_alvo, _referencia_id, _referencia_codigo,
    _valor, _centro_custo_id, 'pendente', now(), _solicitante
  )
  RETURNING id INTO v_instancia_id;

  -- Requisição: etapas dinâmicas
  IF v_alvo = 'requisicao_compra' THEN
    SELECT gestor_user_id INTO v_gestor_cc
    FROM public.centros_custo WHERE id = _centro_custo_id;

    INSERT INTO public.sup_aprov_etapa (
      fluxo_id, ordem, nome, tipo_parecer, responsavel_user_id,
      valor_min, criticidade, ativo
    ) VALUES (
      _fluxo_id, 1, 'Aprovação de retirada', 'bloqueante', v_gestor_cc,
      0, 'normal', true
    );

    v_tem_orcamento := public.sup_aprov_tem_orcamento_cc(_centro_custo_id, _valor, NULL);
    IF NOT v_tem_orcamento THEN
      INSERT INTO public.sup_aprov_etapa (
        fluxo_id, ordem, nome, tipo_parecer, responsavel_user_id,
        valor_min, criticidade, ativo
      ) VALUES (
        _fluxo_id, 2, 'Aprovação por ultrapassar orçamento', 'bloqueante', v_gestor_cc,
        0, 'urgente', true
      );
    END IF;
  END IF;

  RETURN v_instancia_id;
END;
$$;
