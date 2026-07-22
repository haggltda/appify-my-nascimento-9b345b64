-- FASE 3 (lote 7c — Fiscal) — nota_fiscal_item e nfse ficaram de fora do
-- lote 3 (mesmo arquivo de origem das outras tabelas Fiscal já corrigidas,
-- 20260430021948, só essas duas e as RPCs abaixo foram esquecidas). Menu
-- 'fiscal-principal', mesmo das demais tabelas do módulo.

-- ── nota_fiscal_item ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "nfi_select" ON public.nota_fiscal_item;
CREATE POLICY nfi_select ON public.nota_fiscal_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "nfi_manage" ON public.nota_fiscal_item;
CREATE POLICY nfi_manage ON public.nota_fiscal_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

-- ── nfse ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS nf_select ON public.nfse;
CREATE POLICY nf_select ON public.nfse FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS nf_modify ON public.nfse;
CREATE POLICY nf_modify ON public.nfse FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

-- ── RPC nota_fiscal_emitir ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nota_fiscal_emitir(
  _empresa_id uuid, _tipo nfsai_tipo, _origem nfsai_origem,
  _tomador_nome text, _tomador_documento text,
  _valor_servicos numeric DEFAULT 0, _valor_produtos numeric DEFAULT 0,
  _discriminacao text DEFAULT NULL, _titulo_receber_id uuid DEFAULT NULL,
  _contrato_id uuid DEFAULT NULL, _codigo_servico text DEFAULT NULL,
  _tomador_email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg RECORD; v_nf_id uuid; v_numero integer; v_serie text;
  v_base numeric; v_iss numeric; v_pis numeric; v_cofins numeric;
BEGIN
  IF NOT public.can_access(auth.uid(), 'fiscal-principal', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_cfg FROM empresa_fiscal_config WHERE empresa_id = _empresa_id;
  IF v_cfg IS NULL THEN
    INSERT INTO empresa_fiscal_config (empresa_id) VALUES (_empresa_id) RETURNING * INTO v_cfg;
  END IF;
  IF _tipo = 'nfse' THEN
    v_numero := v_cfg.nfse_proximo_numero; v_serie := v_cfg.nfse_serie;
    UPDATE empresa_fiscal_config SET nfse_proximo_numero = nfse_proximo_numero + 1 WHERE empresa_id = _empresa_id;
  ELSE
    v_numero := v_cfg.nfe_proximo_numero; v_serie := v_cfg.nfe_serie;
    UPDATE empresa_fiscal_config SET nfe_proximo_numero = nfe_proximo_numero + 1 WHERE empresa_id = _empresa_id;
  END IF;
  v_base := COALESCE(_valor_servicos,0) + COALESCE(_valor_produtos,0);
  v_iss := ROUND(COALESCE(_valor_servicos,0) * v_cfg.aliq_iss / 100.0, 2);
  v_pis := ROUND(v_base * v_cfg.aliq_pis / 100.0, 2);
  v_cofins := ROUND(v_base * v_cfg.aliq_cofins / 100.0, 2);
  INSERT INTO nota_fiscal (empresa_id, tipo, origem, numero, serie, status, ambiente,
    tomador_nome, tomador_documento, tomador_email, titulo_receber_id, contrato_id,
    valor_servicos, valor_produtos, base_calculo, valor_iss, valor_pis, valor_cofins,
    valor_total, valor_liquido, codigo_servico, discriminacao, emitida_por
  ) VALUES (_empresa_id, _tipo, _origem, v_numero, v_serie, 'rascunho', v_cfg.ambiente,
    _tomador_nome, _tomador_documento, _tomador_email, _titulo_receber_id, _contrato_id,
    _valor_servicos, _valor_produtos, v_base, v_iss, v_pis, v_cofins,
    v_base - v_iss, v_base - v_iss, _codigo_servico, _discriminacao, auth.uid()
  ) RETURNING id INTO v_nf_id;
  RETURN v_nf_id;
END $$;

-- ── RPC nota_fiscal_autorizar ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nota_fiscal_autorizar(_nf_id uuid, _protocolo text DEFAULT NULL, _link_pdf text DEFAULT NULL, _link_xml text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nf RECORD;
BEGIN
  SELECT * INTO v_nf FROM nota_fiscal WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF NOT public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_nf.status NOT IN ('rascunho','emitida') THEN
    RAISE EXCEPTION 'NF % não pode ser autorizada (status: %)', v_nf.numero, v_nf.status;
  END IF;
  UPDATE nota_fiscal SET status='autorizada', data_emissao = COALESCE(data_emissao, now()),
    protocolo = COALESCE(_protocolo, protocolo),
    link_pdf = COALESCE(_link_pdf, link_pdf),
    link_xml = COALESCE(_link_xml, link_xml)
  WHERE id = _nf_id;
  INSERT INTO nota_fiscal_evento (nota_fiscal_id, tipo, status_anterior, status_novo, payload, user_id)
  VALUES (_nf_id, 'autorizacao', v_nf.status, 'autorizada', jsonb_build_object('protocolo', _protocolo), auth.uid());
END $$;

-- ── RPC nota_fiscal_cancelar ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nota_fiscal_cancelar(_nf_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nf RECORD;
BEGIN
  IF _motivo IS NULL OR length(_motivo) < 15 THEN
    RAISE EXCEPTION 'Motivo de cancelamento exige no mínimo 15 caracteres';
  END IF;
  SELECT * INTO v_nf FROM nota_fiscal WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF NOT public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_nf.status = 'cancelada' THEN RAISE EXCEPTION 'NF já cancelada'; END IF;
  UPDATE nota_fiscal SET status='cancelada', cancelada_em=now(),
    cancelamento_motivo=_motivo, cancelada_por=auth.uid()
  WHERE id = _nf_id;
  INSERT INTO nota_fiscal_evento (nota_fiscal_id, tipo, status_anterior, status_novo, payload, user_id)
  VALUES (_nf_id, 'cancelamento', v_nf.status, 'cancelada', jsonb_build_object('motivo', _motivo), auth.uid());
END $$;

-- ── RPC apurar_impostos_competencia ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apurar_impostos_competencia(_empresa_id uuid, _competencia date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg RECORD; v_inicio date; v_fim date;
  v_receita_servicos numeric := 0; v_receita_produtos numeric := 0; v_receita_total numeric := 0;
  v_iss numeric := 0; v_pis numeric := 0; v_cofins numeric := 0;
  v_irpj numeric := 0; v_csll numeric := 0; v_das numeric := 0;
  v_resultado jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_cfg FROM empresa_fiscal_config WHERE empresa_id = _empresa_id;
  IF v_cfg IS NULL THEN
    INSERT INTO empresa_fiscal_config (empresa_id) VALUES (_empresa_id) RETURNING * INTO v_cfg;
  END IF;
  v_inicio := date_trunc('month', _competencia)::date;
  v_fim := (v_inicio + interval '1 month - 1 day')::date;
  SELECT COALESCE(SUM(valor_servicos),0), COALESCE(SUM(valor_produtos),0),
         COALESCE(SUM(valor_iss),0), COALESCE(SUM(valor_pis),0), COALESCE(SUM(valor_cofins),0)
    INTO v_receita_servicos, v_receita_produtos, v_iss, v_pis, v_cofins
    FROM nota_fiscal
   WHERE empresa_id = _empresa_id AND competencia BETWEEN v_inicio AND v_fim
     AND status IN ('autorizada','emitida');
  v_receita_total := v_receita_servicos + v_receita_produtos;
  IF v_cfg.regime = 'lucro_presumido' THEN
    v_irpj := ROUND(v_receita_servicos * v_cfg.aliq_irpj_presuncao/100.0 * 0.15, 2);
    v_csll := ROUND(v_receita_servicos * v_cfg.aliq_csll_presuncao/100.0 * 0.09, 2);
    INSERT INTO apuracao_imposto (empresa_id, competencia, imposto, regime, base_calculo, aliquota, valor_devido, valor_a_pagar, vencimento, status, calculado_por, calculado_em)
    VALUES
      (_empresa_id, v_inicio, 'iss', v_cfg.regime, v_receita_servicos, v_cfg.aliq_iss, v_iss, v_iss, (v_fim + interval '10 days')::date, 'calculada', auth.uid(), now()),
      (_empresa_id, v_inicio, 'pis', v_cfg.regime, v_receita_total, v_cfg.aliq_pis, v_pis, v_pis, (v_fim + interval '25 days')::date, 'calculada', auth.uid(), now()),
      (_empresa_id, v_inicio, 'cofins', v_cfg.regime, v_receita_total, v_cfg.aliq_cofins, v_cofins, v_cofins, (v_fim + interval '25 days')::date, 'calculada', auth.uid(), now()),
      (_empresa_id, v_inicio, 'irpj', v_cfg.regime, v_receita_servicos, 15, v_irpj, v_irpj, (v_fim + interval '30 days')::date, 'calculada', auth.uid(), now()),
      (_empresa_id, v_inicio, 'csll', v_cfg.regime, v_receita_servicos, 9, v_csll, v_csll, (v_fim + interval '30 days')::date, 'calculada', auth.uid(), now())
    ON CONFLICT (empresa_id, competencia, imposto) DO UPDATE SET
      base_calculo = EXCLUDED.base_calculo, valor_devido = EXCLUDED.valor_devido,
      valor_a_pagar = EXCLUDED.valor_a_pagar, aliquota = EXCLUDED.aliquota,
      status = 'calculada', calculado_por = auth.uid(), calculado_em = now();
    v_resultado := jsonb_build_object('regime','lucro_presumido','receita_total',v_receita_total,
      'iss',v_iss,'pis',v_pis,'cofins',v_cofins,'irpj',v_irpj,'csll',v_csll);
  ELSIF v_cfg.regime = 'simples_nacional' THEN
    v_das := ROUND(v_receita_total * COALESCE(v_cfg.aliq_simples_efetiva, 6.0) / 100.0, 2);
    INSERT INTO apuracao_imposto (empresa_id, competencia, imposto, regime, base_calculo, aliquota, valor_devido, valor_a_pagar, vencimento, status, calculado_por, calculado_em, observacoes)
    VALUES (_empresa_id, v_inicio, 'das', v_cfg.regime, v_receita_total, COALESCE(v_cfg.aliq_simples_efetiva,6.0), v_das, v_das, (v_fim + interval '20 days')::date, 'calculada', auth.uid(), now(),
      'Anexo ' || COALESCE(v_cfg.anexo_simples,'-') || ' Faixa ' || COALESCE(v_cfg.faixa_simples::text,'-'))
    ON CONFLICT (empresa_id, competencia, imposto) DO UPDATE SET
      base_calculo = EXCLUDED.base_calculo, valor_devido = EXCLUDED.valor_devido,
      valor_a_pagar = EXCLUDED.valor_a_pagar, aliquota = EXCLUDED.aliquota,
      status = 'calculada', calculado_por = auth.uid(), calculado_em = now();
    v_resultado := jsonb_build_object('regime','simples_nacional','receita_total',v_receita_total,'das',v_das);
  END IF;
  RETURN v_resultado;
END $$;

NOTIFY pgrst, 'reload schema';
