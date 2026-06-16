-- ============================================================
-- BLOCO 2: ESTOQUE COMPLETO
-- ============================================================

-- 1. ENUMS
CREATE TYPE produto_metodo_custeio AS ENUM ('compra', 'medio');
CREATE TYPE almox_tipo AS ENUM ('matriz', 'deposito', 'obra', 'veiculo', 'outro');
CREATE TYPE estoque_mov_tipo AS ENUM ('entrada', 'saida', 'transferencia', 'ajuste', 'reserva', 'liberacao_reserva', 'consumo');
CREATE TYPE estoque_mov_origem AS ENUM ('nf_entrada', 'rc', 'pedido_compra', 'ajuste_manual', 'transferencia', 'inventario', 'devolucao');
CREATE TYPE rc_destino AS ENUM ('estoque', 'contrato');

-- 2. SEQUENCE para código de produto
CREATE SEQUENCE IF NOT EXISTS produto_codigo_seq START 1;

-- 3. TABELA: produto_categoria
CREATE TABLE public.produto_categoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  controla_lote_padrao boolean NOT NULL DEFAULT false,
  controla_validade_padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

ALTER TABLE public.produto_categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select ON public.produto_categoria FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY pc_write ON public.produto_categoria FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE TRIGGER pc_set_updated BEFORE UPDATE ON public.produto_categoria FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pc_audit AFTER INSERT OR UPDATE OR DELETE ON public.produto_categoria FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 4. TABELA: produto
CREATE TABLE public.produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  codigo_externo text,
  descricao text NOT NULL,
  categoria_id uuid REFERENCES public.produto_categoria(id),
  unidade text NOT NULL DEFAULT 'UN',
  controla_lote boolean NOT NULL DEFAULT false,
  controla_validade boolean NOT NULL DEFAULT false,
  metodo_custeio produto_metodo_custeio NOT NULL DEFAULT 'medio',
  estoque_minimo numeric(15,4) NOT NULL DEFAULT 0,
  estoque_maximo numeric(15,4),
  preco_referencia numeric(15,4) NOT NULL DEFAULT 0,
  custo_medio_atual numeric(15,4) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX idx_produto_empresa ON public.produto(empresa_id);
CREATE INDEX idx_produto_categoria ON public.produto(categoria_id);
CREATE INDEX idx_produto_codigo_ext ON public.produto(empresa_id, codigo_externo) WHERE codigo_externo IS NOT NULL;

ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;

CREATE POLICY prod_select ON public.produto FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY prod_write ON public.produto FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE TRIGGER prod_set_updated BEFORE UPDATE ON public.produto FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prod_audit AFTER INSERT OR UPDATE OR DELETE ON public.produto FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Trigger: gera código automático se vazio
CREATE OR REPLACE FUNCTION produto_gerar_codigo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'PRD-' || LPAD(nextval('produto_codigo_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER prod_codigo_auto BEFORE INSERT ON public.produto FOR EACH ROW EXECUTE FUNCTION produto_gerar_codigo();

-- 5. TABELA: almoxarifado
CREATE TABLE public.almoxarifado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo almox_tipo NOT NULL DEFAULT 'deposito',
  contrato_id uuid REFERENCES public.contrato(id),
  responsavel text,
  endereco text,
  observacoes text,
  is_matriz boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

-- Apenas um almox matriz por empresa
CREATE UNIQUE INDEX uniq_almox_matriz_empresa ON public.almoxarifado(empresa_id) WHERE is_matriz = true;

ALTER TABLE public.almoxarifado ENABLE ROW LEVEL SECURITY;

CREATE POLICY almox_select ON public.almoxarifado FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY almox_write ON public.almoxarifado FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE TRIGGER almox_set_updated BEFORE UPDATE ON public.almoxarifado FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER almox_audit AFTER INSERT OR UPDATE OR DELETE ON public.almoxarifado FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Trigger: criar almox matriz automaticamente quando empresa for criada
CREATE OR REPLACE FUNCTION empresa_criar_almox_matriz()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.almoxarifado (empresa_id, codigo, nome, tipo, is_matriz, responsavel)
  VALUES (NEW.id, 'MATRIZ', 'Almoxarifado Matriz', 'matriz', true, 'Sede')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER empresa_almox_matriz_auto AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION empresa_criar_almox_matriz();

-- Backfill: criar almox matriz para empresas existentes
INSERT INTO public.almoxarifado (empresa_id, codigo, nome, tipo, is_matriz, responsavel)
SELECT id, 'MATRIZ', 'Almoxarifado Matriz', 'matriz', true, 'Sede'
FROM public.empresas
ON CONFLICT DO NOTHING;

-- 6. TABELA: estoque_lote
CREATE TABLE public.estoque_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produto(id),
  numero_lote text NOT NULL,
  data_fabricacao date,
  data_validade date,
  custo_unitario numeric(15,4) NOT NULL DEFAULT 0,
  fornecedor_id uuid REFERENCES public.fornecedor(id),
  nf_numero text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, numero_lote)
);

CREATE INDEX idx_lote_produto ON public.estoque_lote(produto_id);
CREATE INDEX idx_lote_validade ON public.estoque_lote(data_validade) WHERE data_validade IS NOT NULL;

ALTER TABLE public.estoque_lote ENABLE ROW LEVEL SECURITY;

CREATE POLICY lote_select ON public.estoque_lote FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY lote_write ON public.estoque_lote FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE TRIGGER lote_set_updated BEFORE UPDATE ON public.estoque_lote FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER lote_audit AFTER INSERT OR UPDATE OR DELETE ON public.estoque_lote FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 7. TABELA: estoque_saldo
CREATE TABLE public.estoque_saldo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  almoxarifado_id uuid NOT NULL REFERENCES public.almoxarifado(id),
  produto_id uuid NOT NULL REFERENCES public.produto(id),
  lote_id uuid REFERENCES public.estoque_lote(id),
  quantidade numeric(15,4) NOT NULL DEFAULT 0,
  quantidade_reservada numeric(15,4) NOT NULL DEFAULT 0,
  custo_unitario numeric(15,4) NOT NULL DEFAULT 0,
  valor_total numeric(15,4) GENERATED ALWAYS AS (quantidade * custo_unitario) STORED,
  ultima_movimentacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (almoxarifado_id, produto_id, lote_id)
);

CREATE INDEX idx_saldo_empresa ON public.estoque_saldo(empresa_id);
CREATE INDEX idx_saldo_almox_prod ON public.estoque_saldo(almoxarifado_id, produto_id);

ALTER TABLE public.estoque_saldo ENABLE ROW LEVEL SECURITY;

CREATE POLICY saldo_select ON public.estoque_saldo FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
-- Saldos só são alterados por triggers de movimentação; admin pode forçar
CREATE POLICY saldo_admin_write ON public.estoque_saldo FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER saldo_set_updated BEFORE UPDATE ON public.estoque_saldo FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. TABELA: estoque_movimento (histórico imutável)
CREATE TABLE public.estoque_movimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  almoxarifado_id uuid NOT NULL REFERENCES public.almoxarifado(id),
  almoxarifado_destino_id uuid REFERENCES public.almoxarifado(id),
  produto_id uuid NOT NULL REFERENCES public.produto(id),
  lote_id uuid REFERENCES public.estoque_lote(id),
  tipo estoque_mov_tipo NOT NULL,
  origem estoque_mov_origem NOT NULL,
  origem_id uuid,
  quantidade numeric(15,4) NOT NULL,
  custo_unitario numeric(15,4) NOT NULL DEFAULT 0,
  valor_total numeric(15,4) GENERATED ALWAYS AS (quantidade * custo_unitario) STORED,
  data_movimento timestamptz NOT NULL DEFAULT now(),
  contrato_id uuid REFERENCES public.contrato(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  documento text,
  observacoes text,
  user_id uuid,
  permitiu_negativo boolean NOT NULL DEFAULT false,
  justificativa_negativo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_empresa ON public.estoque_movimento(empresa_id);
CREATE INDEX idx_mov_almox ON public.estoque_movimento(almoxarifado_id);
CREATE INDEX idx_mov_produto ON public.estoque_movimento(produto_id);
CREATE INDEX idx_mov_origem ON public.estoque_movimento(origem, origem_id);
CREATE INDEX idx_mov_data ON public.estoque_movimento(data_movimento);

ALTER TABLE public.estoque_movimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY mov_select ON public.estoque_movimento FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY mov_insert ON public.estoque_movimento FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador') OR has_role(auth.uid(), 'controladoria'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));
-- Sem UPDATE/DELETE: histórico imutável (exceto admin)
CREATE POLICY mov_admin_modify ON public.estoque_movimento FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER mov_audit AFTER INSERT OR UPDATE OR DELETE ON public.estoque_movimento FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 9. TABELA: estoque_reserva
CREATE TABLE public.estoque_reserva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  almoxarifado_id uuid NOT NULL REFERENCES public.almoxarifado(id),
  produto_id uuid NOT NULL REFERENCES public.produto(id),
  lote_id uuid REFERENCES public.estoque_lote(id),
  quantidade numeric(15,4) NOT NULL,
  requisicao_id uuid REFERENCES public.requisicao_compra(id),
  contrato_id uuid REFERENCES public.contrato(id),
  status text NOT NULL DEFAULT 'ativa',
  reservado_por uuid,
  reservado_em timestamptz NOT NULL DEFAULT now(),
  liberado_por uuid,
  liberado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reserva_empresa ON public.estoque_reserva(empresa_id);
CREATE INDEX idx_reserva_rc ON public.estoque_reserva(requisicao_id);
CREATE INDEX idx_reserva_status ON public.estoque_reserva(status) WHERE status = 'ativa';

ALTER TABLE public.estoque_reserva ENABLE ROW LEVEL SECURITY;

CREATE POLICY res_select ON public.estoque_reserva FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY res_write ON public.estoque_reserva FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE TRIGGER res_set_updated BEFORE UPDATE ON public.estoque_reserva FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER res_audit AFTER INSERT OR UPDATE OR DELETE ON public.estoque_reserva FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 10. Adiciona campo destino em requisicao_compra
ALTER TABLE public.requisicao_compra
  ADD COLUMN IF NOT EXISTS destino rc_destino NOT NULL DEFAULT 'estoque',
  ADD COLUMN IF NOT EXISTS almoxarifado_destino_id uuid REFERENCES public.almoxarifado(id);

-- 11. FUNÇÃO: aplicar movimento ao saldo
CREATE OR REPLACE FUNCTION estoque_aplicar_movimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_saldo_atual numeric(15,4);
  v_qtd_disponivel numeric(15,4);
  v_novo_custo_medio numeric(15,4);
  v_qtd_existente numeric(15,4);
  v_custo_existente numeric(15,4);
  v_metodo produto_metodo_custeio;
BEGIN
  SELECT metodo_custeio INTO v_metodo FROM produto WHERE id = NEW.produto_id;

  -- ENTRADA
  IF NEW.tipo IN ('entrada', 'ajuste') AND NEW.quantidade > 0 THEN
    INSERT INTO estoque_saldo (empresa_id, almoxarifado_id, produto_id, lote_id, quantidade, custo_unitario, ultima_movimentacao)
    VALUES (NEW.empresa_id, NEW.almoxarifado_id, NEW.produto_id, NEW.lote_id, NEW.quantidade, NEW.custo_unitario, NEW.data_movimento)
    ON CONFLICT (almoxarifado_id, produto_id, lote_id) DO UPDATE
      SET quantidade = estoque_saldo.quantidade + NEW.quantidade,
          custo_unitario = CASE
            WHEN v_metodo = 'medio' AND (estoque_saldo.quantidade + NEW.quantidade) > 0 THEN
              ((estoque_saldo.quantidade * estoque_saldo.custo_unitario) + (NEW.quantidade * NEW.custo_unitario))
              / (estoque_saldo.quantidade + NEW.quantidade)
            ELSE NEW.custo_unitario
          END,
          ultima_movimentacao = NEW.data_movimento;

    -- Atualiza custo médio do produto
    IF v_metodo = 'medio' THEN
      SELECT COALESCE(SUM(quantidade), 0), COALESCE(SUM(quantidade * custo_unitario) / NULLIF(SUM(quantidade), 0), 0)
        INTO v_qtd_existente, v_novo_custo_medio
        FROM estoque_saldo WHERE produto_id = NEW.produto_id AND empresa_id = NEW.empresa_id;
      UPDATE produto SET custo_medio_atual = v_novo_custo_medio WHERE id = NEW.produto_id;
    END IF;

  -- SAÍDA / CONSUMO
  ELSIF NEW.tipo IN ('saida', 'consumo') OR (NEW.tipo = 'ajuste' AND NEW.quantidade < 0) THEN
    SELECT quantidade, quantidade - quantidade_reservada INTO v_saldo_atual, v_qtd_disponivel
      FROM estoque_saldo
     WHERE almoxarifado_id = NEW.almoxarifado_id AND produto_id = NEW.produto_id
       AND (lote_id = NEW.lote_id OR (lote_id IS NULL AND NEW.lote_id IS NULL));

    IF v_saldo_atual IS NULL THEN v_saldo_atual := 0; END IF;

    -- Bloqueio de saldo negativo
    IF v_saldo_atual < ABS(NEW.quantidade) AND NOT NEW.permitiu_negativo THEN
      RAISE EXCEPTION 'Saldo insuficiente: disponível %, solicitado %. Use justificativa para forçar.',
        v_saldo_atual, ABS(NEW.quantidade);
    END IF;

    IF NEW.permitiu_negativo AND NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife')) THEN
      RAISE EXCEPTION 'Apenas admin ou almoxarife pode forçar saldo negativo';
    END IF;

    IF NEW.permitiu_negativo AND (NEW.justificativa_negativo IS NULL OR NEW.justificativa_negativo = '') THEN
      RAISE EXCEPTION 'Justificativa obrigatória para saldo negativo';
    END IF;

    UPDATE estoque_saldo
       SET quantidade = quantidade - ABS(NEW.quantidade),
           ultima_movimentacao = NEW.data_movimento
     WHERE almoxarifado_id = NEW.almoxarifado_id AND produto_id = NEW.produto_id
       AND (lote_id = NEW.lote_id OR (lote_id IS NULL AND NEW.lote_id IS NULL));

  -- TRANSFERÊNCIA (saída origem + entrada destino)
  ELSIF NEW.tipo = 'transferencia' THEN
    IF NEW.almoxarifado_destino_id IS NULL THEN
      RAISE EXCEPTION 'Transferência exige almoxarifado_destino_id';
    END IF;
    UPDATE estoque_saldo SET quantidade = quantidade - ABS(NEW.quantidade), ultima_movimentacao = NEW.data_movimento
     WHERE almoxarifado_id = NEW.almoxarifado_id AND produto_id = NEW.produto_id
       AND (lote_id = NEW.lote_id OR (lote_id IS NULL AND NEW.lote_id IS NULL));
    INSERT INTO estoque_saldo (empresa_id, almoxarifado_id, produto_id, lote_id, quantidade, custo_unitario, ultima_movimentacao)
    VALUES (NEW.empresa_id, NEW.almoxarifado_destino_id, NEW.produto_id, NEW.lote_id, ABS(NEW.quantidade), NEW.custo_unitario, NEW.data_movimento)
    ON CONFLICT (almoxarifado_id, produto_id, lote_id) DO UPDATE
      SET quantidade = estoque_saldo.quantidade + ABS(NEW.quantidade),
          ultima_movimentacao = NEW.data_movimento;
  END IF;

  -- Captura user_id automaticamente
  IF NEW.user_id IS NULL THEN NEW.user_id := auth.uid(); END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER mov_aplicar_saldo BEFORE INSERT ON public.estoque_movimento
  FOR EACH ROW EXECUTE FUNCTION estoque_aplicar_movimento();

-- 12. FUNÇÃO: aplicar reserva
CREATE OR REPLACE FUNCTION estoque_aplicar_reserva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disponivel numeric(15,4);
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ativa' THEN
    SELECT quantidade - quantidade_reservada INTO v_disponivel
      FROM estoque_saldo
     WHERE almoxarifado_id = NEW.almoxarifado_id AND produto_id = NEW.produto_id
       AND (lote_id = NEW.lote_id OR (lote_id IS NULL AND NEW.lote_id IS NULL));

    IF COALESCE(v_disponivel, 0) < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo disponível insuficiente para reserva: % < %', COALESCE(v_disponivel, 0), NEW.quantidade;
    END IF;

    UPDATE estoque_saldo
       SET quantidade_reservada = quantidade_reservada + NEW.quantidade
     WHERE almoxarifado_id = NEW.almoxarifado_id AND produto_id = NEW.produto_id
       AND (lote_id = NEW.lote_id OR (lote_id IS NULL AND NEW.lote_id IS NULL));

    IF NEW.reservado_por IS NULL THEN NEW.reservado_por := auth.uid(); END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'ativa' AND NEW.status IN ('liberada', 'consumida', 'cancelada') THEN
    UPDATE estoque_saldo
       SET quantidade_reservada = GREATEST(0, quantidade_reservada - OLD.quantidade)
     WHERE almoxarifado_id = OLD.almoxarifado_id AND produto_id = OLD.produto_id
       AND (lote_id = OLD.lote_id OR (lote_id IS NULL AND OLD.lote_id IS NULL));

    IF NEW.liberado_por IS NULL THEN NEW.liberado_por := auth.uid(); END IF;
    IF NEW.liberado_em IS NULL THEN NEW.liberado_em := now(); END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER reserva_aplicar BEFORE INSERT OR UPDATE ON public.estoque_reserva
  FOR EACH ROW EXECUTE FUNCTION estoque_aplicar_reserva();

-- 13. FUNÇÃO: reservar automaticamente ao aprovar RC com destino estoque
CREATE OR REPLACE FUNCTION rc_reservar_automatico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD;
  v_almox_id uuid;
  v_disponivel numeric(15,4);
  v_produto_id uuid;
BEGIN
  -- Apenas ao mover para 'aprovada' e destino estoque
  IF NEW.status_v2 IN ('aprovada', 'aprovada_total') AND OLD.status_v2 IS DISTINCT FROM NEW.status_v2
     AND NEW.destino = 'estoque' THEN

    -- Determina almoxarifado: específico da RC ou matriz da empresa
    v_almox_id := NEW.almoxarifado_destino_id;
    IF v_almox_id IS NULL THEN
      SELECT id INTO v_almox_id FROM almoxarifado
       WHERE empresa_id = NEW.empresa_id AND is_matriz = true LIMIT 1;
    END IF;

    -- Para cada item da RC, tenta reservar se houver produto vinculado e saldo
    FOR v_item IN SELECT * FROM requisicao_compra_item WHERE requisicao_id = NEW.id LOOP
      -- Tenta localizar produto pelo código (descrição livre fica sem reserva)
      SELECT id INTO v_produto_id FROM produto
       WHERE empresa_id = NEW.empresa_id
         AND (codigo = v_item.descricao OR descricao = v_item.descricao)
       LIMIT 1;

      IF v_produto_id IS NOT NULL AND v_almox_id IS NOT NULL THEN
        SELECT COALESCE(SUM(quantidade - quantidade_reservada), 0) INTO v_disponivel
          FROM estoque_saldo
         WHERE almoxarifado_id = v_almox_id AND produto_id = v_produto_id;

        IF v_disponivel >= v_item.quantidade THEN
          INSERT INTO estoque_reserva (empresa_id, almoxarifado_id, produto_id, quantidade,
                                        requisicao_id, contrato_id, status, reservado_por)
          VALUES (NEW.empresa_id, v_almox_id, v_produto_id, v_item.quantidade,
                  NEW.id, NEW.contrato_id, 'ativa', auth.uid());
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER rc_reserva_auto AFTER UPDATE ON public.requisicao_compra
  FOR EACH ROW EXECUTE FUNCTION rc_reservar_automatico();

-- 14. View útil: saldos consolidados por produto
CREATE OR REPLACE VIEW public.v_estoque_consolidado AS
SELECT
  s.empresa_id,
  s.almoxarifado_id,
  a.nome as almoxarifado_nome,
  a.is_matriz,
  s.produto_id,
  p.codigo as produto_codigo,
  p.descricao as produto_descricao,
  p.unidade,
  p.categoria_id,
  p.estoque_minimo,
  p.estoque_maximo,
  SUM(s.quantidade) as quantidade_total,
  SUM(s.quantidade_reservada) as quantidade_reservada_total,
  SUM(s.quantidade - s.quantidade_reservada) as quantidade_disponivel,
  AVG(s.custo_unitario) as custo_unitario_medio,
  SUM(s.valor_total) as valor_total_estoque,
  CASE WHEN SUM(s.quantidade) < p.estoque_minimo THEN true ELSE false END as abaixo_minimo
FROM public.estoque_saldo s
JOIN public.almoxarifado a ON a.id = s.almoxarifado_id
JOIN public.produto p ON p.id = s.produto_id
GROUP BY s.empresa_id, s.almoxarifado_id, a.nome, a.is_matriz, s.produto_id, p.codigo, p.descricao, p.unidade, p.categoria_id, p.estoque_minimo, p.estoque_maximo;