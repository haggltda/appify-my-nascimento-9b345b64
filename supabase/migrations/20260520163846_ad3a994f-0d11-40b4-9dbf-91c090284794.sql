
-- ========================================
-- Item 7: Permissões especiais (alterar empresa de CC)
-- ========================================
CREATE TABLE IF NOT EXISTS public.permissoes_especiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permissao text NOT NULL,
  concedido_por uuid,
  concedido_em timestamptz NOT NULL DEFAULT now(),
  motivo text,
  UNIQUE (user_id, permissao)
);

ALTER TABLE public.permissoes_especiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins ver permissoes especiais"
  ON public.permissoes_especiais FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins gerenciar permissoes especiais"
  ON public.permissoes_especiais FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tem_permissao_especial(_user_id uuid, _permissao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permissoes_especiais
    WHERE user_id = _user_id AND permissao = _permissao
  );
$$;

-- Atualiza admin_alterar_empresa_cc para exigir a permissão especial
CREATE OR REPLACE FUNCTION public.admin_alterar_empresa_cc(
  _cc_id uuid,
  _nova_empresa_id uuid,
  _motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cenario text;
  v_empresa_atual uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a empresa de um CC.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.tem_permissao_especial(auth.uid(), 'alterar_empresa_cc') THEN
    RAISE EXCEPTION 'Você não possui a permissão especial "alterar_empresa_cc". Solicite a um administrador em Administração → Alçadas → Saúde.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF coalesce(length(trim(_motivo)),0) < 5 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres).' USING ERRCODE = 'check_violation';
  END IF;

  SELECT empresa_id INTO v_empresa_atual FROM public.centros_custo WHERE id = _cc_id;
  IF v_empresa_atual IS NULL THEN
    RAISE EXCEPTION 'CC não encontrado.';
  END IF;
  IF v_empresa_atual = _nova_empresa_id THEN
    RAISE EXCEPTION 'A nova empresa deve ser diferente da atual.';
  END IF;

  v_cenario := public.pode_alterar_empresa_cc(_cc_id);
  IF v_cenario = 'bloqueado' THEN
    RAISE EXCEPTION 'Troca bloqueada: existem movimentos vinculados a este CC.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.motivo_troca_empresa_cc', _motivo, true);

  UPDATE public.centros_custo
    SET empresa_id = _nova_empresa_id
    WHERE id = _cc_id;

  RETURN jsonb_build_object('ok', true, 'cenario', v_cenario);
END;
$$;

-- ========================================
-- Item 2: Notificação no sininho quando uma etapa pendente é atribuída
-- ========================================
CREATE OR REPLACE FUNCTION public.sup_aprov_avancar(_instancia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inst public.sup_aprov_instancia%ROWTYPE;
  _proxima public.sup_aprov_etapa%ROWTYPE;
  _alvo_label text;
  _resp_user uuid;
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
      RETURN;
    END IF;
  END IF;

  -- Notificação no sininho para o responsável efetivo (delegação considerada)
  _resp_user := public.sup_aprov_responsavel_efetivo(_proxima.id);
  IF _resp_user IS NOT NULL THEN
    _alvo_label := CASE _inst.alvo::text
      WHEN 'requisicao_compra' THEN 'Requisição de compra'
      WHEN 'pedido_compra' THEN 'Pedido de compra'
      WHEN 'licitacao_etapa' THEN 'Licitação'
      WHEN 'programacao_pagamento' THEN 'Programação de pagamento'
      ELSE _inst.alvo::text END;

    INSERT INTO public.notificacoes (user_id, empresa_id, titulo, mensagem, tipo, link)
    VALUES (
      _resp_user,
      _inst.empresa_id,
      'Aprovação pendente: ' || _alvo_label,
      coalesce(_inst.referencia_codigo, _proxima.nome) || ' aguarda sua decisão.',
      'sup_aprov_pendente',
      '/app/aprovacoes'
    );
  END IF;
END $function$;
