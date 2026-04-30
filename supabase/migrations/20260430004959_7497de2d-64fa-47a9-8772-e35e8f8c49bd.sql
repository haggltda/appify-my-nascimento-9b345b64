-- =====================================================
-- BLOCO 6: COTAÇÃO DE FORNECEDORES
-- =====================================================

CREATE TYPE public.cotacao_status AS ENUM ('rascunho','aberta','em_analise','fechada','cancelada');
CREATE TYPE public.cotacao_fornecedor_status AS ENUM ('convidado','respondeu','recusou','vencedor','perdedor');

CREATE TABLE public.parametro_cotacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  min_propostas integer NOT NULL DEFAULT 3,
  valor_dispensa numeric(15,2) NOT NULL DEFAULT 1000.00,
  permite_fornecedor_exclusivo boolean NOT NULL DEFAULT true,
  permite_emergencia boolean NOT NULL DEFAULT true,
  peso_preco numeric(5,2) NOT NULL DEFAULT 70.00,
  peso_prazo_entrega numeric(5,2) NOT NULL DEFAULT 15.00,
  peso_prazo_pagamento numeric(5,2) NOT NULL DEFAULT 15.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pesos_somam_100 CHECK (peso_preco + peso_prazo_entrega + peso_prazo_pagamento = 100)
);

CREATE SEQUENCE IF NOT EXISTS cotacao_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS pc_cot_numero_seq START 100000;

CREATE TABLE public.cotacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero text NOT NULL UNIQUE DEFAULT ('COT-' || LPAD(nextval('cotacao_numero_seq')::text, 6, '0')),
  titulo text NOT NULL,
  descricao text,
  status public.cotacao_status NOT NULL DEFAULT 'rascunho',
  prazo_resposta date,
  motivo_dispensa text,
  justificativa_dispensa text,
  vencedor_fornecedor_id uuid REFERENCES public.fornecedor(id),
  pedido_compra_ids uuid[] DEFAULT '{}',
  criado_por uuid REFERENCES auth.users(id),
  fechado_por uuid REFERENCES auth.users(id),
  fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cotacao_empresa ON public.cotacao(empresa_id);
CREATE INDEX idx_cotacao_status ON public.cotacao(status);

CREATE TABLE public.cotacao_rc (
  cotacao_id uuid NOT NULL REFERENCES public.cotacao(id) ON DELETE CASCADE,
  requisicao_id uuid NOT NULL REFERENCES public.requisicao_compra(id) ON DELETE CASCADE,
  PRIMARY KEY (cotacao_id, requisicao_id)
);

CREATE TABLE public.cotacao_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacao(id) ON DELETE CASCADE,
  rc_item_id uuid REFERENCES public.requisicao_compra_item(id),
  produto_servico_id uuid,
  descricao text NOT NULL,
  unidade text,
  quantidade numeric(15,4) NOT NULL,
  observacoes text,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cotacao_item_cot ON public.cotacao_item(cotacao_id);

CREATE TABLE public.cotacao_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacao(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedor(id) ON DELETE RESTRICT,
  status public.cotacao_fornecedor_status NOT NULL DEFAULT 'convidado',
  convidado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  observacoes text,
  UNIQUE (cotacao_id, fornecedor_id)
);
CREATE INDEX idx_cotacao_forn_cot ON public.cotacao_fornecedor(cotacao_id);

CREATE TABLE public.cotacao_proposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacao(id) ON DELETE CASCADE,
  cotacao_fornecedor_id uuid NOT NULL REFERENCES public.cotacao_fornecedor(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedor(id),
  valor_frete numeric(15,2) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  prazo_entrega_dias integer,
  prazo_pagamento_dias integer,
  condicoes_pagamento text,
  validade_dias integer DEFAULT 30,
  observacoes text,
  score numeric(6,2),
  ranking integer,
  registrado_por uuid REFERENCES auth.users(id),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cotacao_id, fornecedor_id)
);
CREATE INDEX idx_cot_prop_cot ON public.cotacao_proposta(cotacao_id);

CREATE TABLE public.cotacao_proposta_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.cotacao_proposta(id) ON DELETE CASCADE,
  cotacao_item_id uuid NOT NULL REFERENCES public.cotacao_item(id) ON DELETE CASCADE,
  preco_unitario numeric(15,4) NOT NULL DEFAULT 0,
  ipi_pct numeric(5,2) DEFAULT 0,
  desconto_pct numeric(5,2) DEFAULT 0,
  marca text,
  observacoes text,
  UNIQUE (proposta_id, cotacao_item_id)
);
CREATE INDEX idx_cot_prop_item_prop ON public.cotacao_proposta_item(proposta_id);

-- Recalcula valor_total da proposta ao mudar itens
CREATE OR REPLACE FUNCTION public.cotacao_recalc_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_prop_id uuid; v_total numeric(15,2);
BEGIN
  v_prop_id := COALESCE(NEW.proposta_id, OLD.proposta_id);
  SELECT COALESCE(SUM(
      pi.preco_unitario * ci.quantidade
      * (1 - COALESCE(pi.desconto_pct,0)/100.0)
      * (1 + COALESCE(pi.ipi_pct,0)/100.0)
    ),0)
    INTO v_total
    FROM cotacao_proposta_item pi
    JOIN cotacao_item ci ON ci.id = pi.cotacao_item_id
   WHERE pi.proposta_id = v_prop_id;
  UPDATE cotacao_proposta
     SET valor_total = v_total + COALESCE(valor_frete,0)
   WHERE id = v_prop_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_cotacao_recalc_proposta
AFTER INSERT OR UPDATE OR DELETE ON public.cotacao_proposta_item
FOR EACH ROW EXECUTE FUNCTION public.cotacao_recalc_proposta();

CREATE OR REPLACE FUNCTION public.cotacao_recalc_total_frete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_subtotal numeric(15,2);
BEGIN
  IF NEW.valor_frete IS DISTINCT FROM OLD.valor_frete THEN
    SELECT COALESCE(SUM(
        pi.preco_unitario * ci.quantidade
        * (1 - COALESCE(pi.desconto_pct,0)/100.0)
        * (1 + COALESCE(pi.ipi_pct,0)/100.0)
      ),0)
      INTO v_subtotal
      FROM cotacao_proposta_item pi
      JOIN cotacao_item ci ON ci.id = pi.cotacao_item_id
     WHERE pi.proposta_id = NEW.id;
    NEW.valor_total := v_subtotal + COALESCE(NEW.valor_frete,0);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cotacao_recalc_frete
BEFORE UPDATE ON public.cotacao_proposta
FOR EACH ROW EXECUTE FUNCTION public.cotacao_recalc_total_frete();

CREATE TRIGGER trg_cotacao_upd BEFORE UPDATE ON public.cotacao
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_param_cotacao_upd BEFORE UPDATE ON public.parametro_cotacao
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RPC: calcular score
-- =====================================================
CREATE OR REPLACE FUNCTION public.cotacao_calcular_score(_cotacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot RECORD; v_param RECORD;
  v_min_preco numeric; v_min_pe int; v_max_pp int;
  v_prop RECORD;
  v_score numeric; v_s_preco numeric; v_s_pe numeric; v_s_pp numeric;
  v_count int := 0;
BEGIN
  SELECT * INTO v_cot FROM cotacao WHERE id = _cotacao_id;
  IF v_cot IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
            AND v_cot.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_param FROM parametro_cotacao WHERE empresa_id = v_cot.empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO parametro_cotacao (empresa_id) VALUES (v_cot.empresa_id) RETURNING * INTO v_param;
  END IF;

  SELECT MIN(NULLIF(valor_total,0)),
         MIN(NULLIF(prazo_entrega_dias,0)),
         MAX(NULLIF(prazo_pagamento_dias,0))
    INTO v_min_preco, v_min_pe, v_max_pp
    FROM cotacao_proposta
   WHERE cotacao_id = _cotacao_id AND valor_total > 0;

  IF v_min_preco IS NULL THEN
    RETURN jsonb_build_object('propostas_avaliadas', 0);
  END IF;

  FOR v_prop IN SELECT * FROM cotacao_proposta WHERE cotacao_id = _cotacao_id LOOP
    IF v_prop.valor_total <= 0 THEN
      UPDATE cotacao_proposta SET score = 0, ranking = NULL WHERE id = v_prop.id;
      CONTINUE;
    END IF;
    v_s_preco := (v_min_preco / v_prop.valor_total) * 100.0;
    IF v_prop.prazo_entrega_dias IS NULL OR v_prop.prazo_entrega_dias = 0 OR v_min_pe IS NULL THEN
      v_s_pe := 50;
    ELSE
      v_s_pe := (v_min_pe::numeric / v_prop.prazo_entrega_dias) * 100.0;
    END IF;
    IF v_prop.prazo_pagamento_dias IS NULL OR v_max_pp IS NULL OR v_max_pp = 0 THEN
      v_s_pp := 50;
    ELSE
      v_s_pp := (v_prop.prazo_pagamento_dias::numeric / v_max_pp) * 100.0;
    END IF;
    v_score := (v_s_preco * v_param.peso_preco
              + v_s_pe    * v_param.peso_prazo_entrega
              + v_s_pp    * v_param.peso_prazo_pagamento) / 100.0;
    UPDATE cotacao_proposta SET score = ROUND(v_score, 2) WHERE id = v_prop.id;
    v_count := v_count + 1;
  END LOOP;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC NULLS LAST, valor_total ASC) AS rk
      FROM cotacao_proposta WHERE cotacao_id = _cotacao_id
  )
  UPDATE cotacao_proposta cp SET ranking = r.rk
    FROM ranked r WHERE cp.id = r.id;

  RETURN jsonb_build_object('propostas_avaliadas', v_count, 'pesos',
    jsonb_build_object('preco', v_param.peso_preco, 'prazo_entrega', v_param.peso_prazo_entrega, 'prazo_pagamento', v_param.peso_prazo_pagamento));
END $$;

-- =====================================================
-- RPC: fechar cotação e gerar PC
-- =====================================================
CREATE OR REPLACE FUNCTION public.cotacao_fechar(
  _cotacao_id uuid,
  _vencedor_fornecedor_id uuid,
  _motivo_dispensa text DEFAULT NULL,
  _justificativa text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot RECORD; v_param RECORD; v_prop RECORD;
  v_n_propostas int; v_pc_id uuid; v_pc_numero text;
  v_item RECORD; v_rc_ids uuid[]; v_first_rc uuid;
BEGIN
  SELECT * INTO v_cot FROM cotacao WHERE id = _cotacao_id;
  IF v_cot IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cot.status = 'fechada' THEN RAISE EXCEPTION 'Cotação já fechada'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'comprador') AND v_cot.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Apenas comprador ou admin pode fechar cotação';
  END IF;

  SELECT * INTO v_param FROM parametro_cotacao WHERE empresa_id = v_cot.empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO parametro_cotacao (empresa_id) VALUES (v_cot.empresa_id) RETURNING * INTO v_param;
  END IF;

  SELECT COUNT(*) INTO v_n_propostas
    FROM cotacao_proposta WHERE cotacao_id = _cotacao_id AND valor_total > 0;
  IF v_n_propostas = 0 THEN RAISE EXCEPTION 'Não há propostas válidas para fechar'; END IF;

  SELECT * INTO v_prop FROM cotacao_proposta
   WHERE cotacao_id = _cotacao_id AND fornecedor_id = _vencedor_fornecedor_id;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Proposta do vencedor não encontrada'; END IF;

  -- Regra: se < min_propostas e valor > limite de dispensa, exige justificativa
  IF v_n_propostas < v_param.min_propostas AND v_prop.valor_total > v_param.valor_dispensa THEN
    IF _motivo_dispensa IS NULL OR _justificativa IS NULL OR length(_justificativa) < 10 THEN
      RAISE EXCEPTION 'Cotação com % propostas (mínimo %): informe motivo de dispensa e justificativa (mín 10 chars)',
        v_n_propostas, v_param.min_propostas;
    END IF;
    IF _motivo_dispensa NOT IN ('fornecedor_exclusivo','emergencia','valor_baixo','outro') THEN
      RAISE EXCEPTION 'motivo_dispensa inválido (use: fornecedor_exclusivo|emergencia|valor_baixo|outro)';
    END IF;
    IF _motivo_dispensa = 'fornecedor_exclusivo' AND NOT v_param.permite_fornecedor_exclusivo THEN
      RAISE EXCEPTION 'Empresa não permite dispensa por fornecedor exclusivo';
    END IF;
    IF _motivo_dispensa = 'emergencia' AND NOT v_param.permite_emergencia THEN
      RAISE EXCEPTION 'Empresa não permite dispensa por emergência';
    END IF;
  END IF;

  -- RC vinculada (primeira) entra no PC
  SELECT array_agg(requisicao_id) INTO v_rc_ids FROM cotacao_rc WHERE cotacao_id = _cotacao_id;
  IF v_rc_ids IS NOT NULL AND array_length(v_rc_ids,1) > 0 THEN
    v_first_rc := v_rc_ids[1];
  END IF;

  v_pc_numero := 'PC-' || LPAD(nextval('pc_cot_numero_seq')::text, 6, '0');

  INSERT INTO pedido_compra (empresa_id, numero, fornecedor_id, requisicao_id, status, data_emissao,
                              condicao_pagamento, valor_total, observacoes)
  VALUES (v_cot.empresa_id, v_pc_numero, _vencedor_fornecedor_id, v_first_rc, 'aprovado', CURRENT_DATE,
          v_prop.condicoes_pagamento, v_prop.valor_total,
          'Gerado da cotação ' || v_cot.numero ||
            CASE WHEN _justificativa IS NOT NULL THEN ' — ' || _justificativa ELSE '' END)
  RETURNING id INTO v_pc_id;

  FOR v_item IN
    SELECT ci.*, pi.preco_unitario, pi.ipi_pct, pi.desconto_pct
      FROM cotacao_item ci
      LEFT JOIN cotacao_proposta_item pi ON pi.cotacao_item_id = ci.id AND pi.proposta_id = v_prop.id
     WHERE ci.cotacao_id = _cotacao_id
     ORDER BY ci.ordem
  LOOP
    INSERT INTO pedido_compra_item (pedido_id, produto_servico_id, descricao, quantidade, preco_unitario, valor_total)
    VALUES (v_pc_id, v_item.produto_servico_id, v_item.descricao, v_item.quantidade,
            COALESCE(v_item.preco_unitario,0),
            COALESCE(v_item.preco_unitario,0) * v_item.quantidade
              * (1 - COALESCE(v_item.desconto_pct,0)/100.0)
              * (1 + COALESCE(v_item.ipi_pct,0)/100.0));
  END LOOP;

  UPDATE cotacao_fornecedor SET status = 'perdedor'
   WHERE cotacao_id = _cotacao_id AND fornecedor_id <> _vencedor_fornecedor_id;
  UPDATE cotacao_fornecedor SET status = 'vencedor'
   WHERE cotacao_id = _cotacao_id AND fornecedor_id = _vencedor_fornecedor_id;

  UPDATE cotacao SET
    status = 'fechada',
    vencedor_fornecedor_id = _vencedor_fornecedor_id,
    motivo_dispensa = _motivo_dispensa,
    justificativa_dispensa = _justificativa,
    pedido_compra_ids = ARRAY[v_pc_id],
    fechado_por = auth.uid(),
    fechado_em = now()
  WHERE id = _cotacao_id;

  IF v_rc_ids IS NOT NULL THEN
    BEGIN
      UPDATE requisicao_compra SET status_v2 = 'cotada'
       WHERE id = ANY(v_rc_ids) AND status_v2::text IN ('em_cotacao','aprovada','aprovada_total');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'pedido_compra_id', v_pc_id,
    'pedido_compra_numero', v_pc_numero,
    'cotacao_id', _cotacao_id,
    'vencedor_fornecedor_id', _vencedor_fornecedor_id,
    'valor_total', v_prop.valor_total,
    'propostas_validas', v_n_propostas
  );
END $$;

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.parametro_cotacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_rc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_proposta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_proposta_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "param_cot_select" ON public.parametro_cotacao FOR SELECT
USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "param_cot_write" ON public.parametro_cotacao FOR ALL
USING (has_role(auth.uid(),'admin')
    OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid())))
WITH CHECK (has_role(auth.uid(),'admin')
    OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY "cot_select" ON public.cotacao FOR SELECT
USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "cot_insert" ON public.cotacao FOR INSERT
WITH CHECK (has_role(auth.uid(),'admin')
   OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())));
CREATE POLICY "cot_update" ON public.cotacao FOR UPDATE
USING (has_role(auth.uid(),'admin')
   OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())))
WITH CHECK (has_role(auth.uid(),'admin')
   OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())));
CREATE POLICY "cot_delete" ON public.cotacao FOR DELETE
USING (has_role(auth.uid(),'admin')
   OR (has_role(auth.uid(),'comprador') AND empresa_id = get_user_empresa(auth.uid()) AND status = 'rascunho'));

CREATE POLICY "cot_rc_all" ON public.cotacao_rc FOR ALL
USING (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin') OR c.empresa_id = get_user_empresa(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin')
          OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
              AND c.empresa_id = get_user_empresa(auth.uid())))));

CREATE POLICY "cot_item_all" ON public.cotacao_item FOR ALL
USING (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin') OR c.empresa_id = get_user_empresa(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin')
          OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
              AND c.empresa_id = get_user_empresa(auth.uid())))));

CREATE POLICY "cot_forn_all" ON public.cotacao_fornecedor FOR ALL
USING (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin') OR c.empresa_id = get_user_empresa(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin')
          OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
              AND c.empresa_id = get_user_empresa(auth.uid())))));

CREATE POLICY "cot_prop_all" ON public.cotacao_proposta FOR ALL
USING (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin') OR c.empresa_id = get_user_empresa(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM cotacao c WHERE c.id = cotacao_id
        AND (has_role(auth.uid(),'admin')
          OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
              AND c.empresa_id = get_user_empresa(auth.uid())))));

CREATE POLICY "cot_prop_item_all" ON public.cotacao_proposta_item FOR ALL
USING (EXISTS (SELECT 1 FROM cotacao_proposta p JOIN cotacao c ON c.id = p.cotacao_id
        WHERE p.id = proposta_id
          AND (has_role(auth.uid(),'admin') OR c.empresa_id = get_user_empresa(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM cotacao_proposta p JOIN cotacao c ON c.id = p.cotacao_id
        WHERE p.id = proposta_id
          AND (has_role(auth.uid(),'admin')
            OR ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria'))
                AND c.empresa_id = get_user_empresa(auth.uid())))));