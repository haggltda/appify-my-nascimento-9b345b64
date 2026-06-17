-- ENUMS
DO $$ BEGIN CREATE TYPE public.recebimento_status AS ENUM ('aguardando','em_conferencia','recebido','recebido_com_ocorrencia','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recebimento_item_condicao AS ENUM ('ok','avariado','trocado','faltante','excedente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recebimento_ocorrencia_status AS ENUM ('aberta','em_tratativa','resolvida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recebimento_ocorrencia_tipo AS ENUM ('quantidade','qualidade','produto_trocado','documento','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CABEÇALHO
CREATE TABLE IF NOT EXISTS public.recebimento_nf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nf_id uuid NOT NULL REFERENCES public.nf_entrada(id) ON DELETE CASCADE,
  almoxarifado_id uuid REFERENCES public.almoxarifado(id),
  status public.recebimento_status NOT NULL DEFAULT 'aguardando',
  recebido_por uuid,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nf_id)
);
CREATE INDEX IF NOT EXISTS idx_recebimento_empresa ON public.recebimento_nf(empresa_id, status);

-- ITENS
CREATE TABLE IF NOT EXISTS public.recebimento_nf_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES public.recebimento_nf(id) ON DELETE CASCADE,
  nf_item_id uuid REFERENCES public.nf_entrada_item(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produto(id),
  qtd_nf numeric(15,4) NOT NULL DEFAULT 0,
  qtd_recebida numeric(15,4) NOT NULL DEFAULT 0,
  condicao public.recebimento_item_condicao NOT NULL DEFAULT 'ok',
  observacoes text,
  foto_url text,
  conferido boolean NOT NULL DEFAULT false,
  conferido_em timestamptz,
  conferido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recebimento_item_receb ON public.recebimento_nf_item(recebimento_id);

-- OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS public.recebimento_ocorrencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  recebimento_id uuid NOT NULL REFERENCES public.recebimento_nf(id) ON DELETE CASCADE,
  recebimento_item_id uuid REFERENCES public.recebimento_nf_item(id) ON DELETE CASCADE,
  tipo public.recebimento_ocorrencia_tipo NOT NULL,
  descricao text NOT NULL,
  status public.recebimento_ocorrencia_status NOT NULL DEFAULT 'aberta',
  aberta_por uuid,
  aberta_em timestamptz NOT NULL DEFAULT now(),
  tratativa text,
  resolvida_por uuid,
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recebimento_ocorrencia_empresa ON public.recebimento_ocorrencia(empresa_id, status);

DROP TRIGGER IF EXISTS trg_recebimento_upd ON public.recebimento_nf;
CREATE TRIGGER trg_recebimento_upd BEFORE UPDATE ON public.recebimento_nf
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recebimento_ocorrencia_upd ON public.recebimento_ocorrencia;
CREATE TRIGGER trg_recebimento_ocorrencia_upd BEFORE UPDATE ON public.recebimento_ocorrencia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TRIGGER: Cria Recebimento ao criar NF
-- ============================================
CREATE OR REPLACE FUNCTION public.nf_criar_recebimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE
  v_receb_id uuid;
  v_almox uuid;
BEGIN
  v_almox := NEW.almoxarifado_id;
  IF v_almox IS NULL THEN
    SELECT id INTO v_almox FROM almoxarifado WHERE empresa_id=NEW.empresa_id AND is_matriz=true LIMIT 1;
  END IF;

  INSERT INTO recebimento_nf (empresa_id, nf_id, almoxarifado_id, status)
  VALUES (NEW.empresa_id, NEW.id, v_almox, 'aguardando')
  ON CONFLICT (nf_id) DO NOTHING
  RETURNING id INTO v_receb_id;

  -- Cria itens espelho
  IF v_receb_id IS NOT NULL THEN
    INSERT INTO recebimento_nf_item (recebimento_id, nf_item_id, produto_id, qtd_nf, qtd_recebida, condicao, conferido)
    SELECT v_receb_id, i.id, i.produto_id, i.quantidade, i.quantidade, 'ok', false
      FROM nf_entrada_item i WHERE i.nf_id = NEW.id;
  END IF;

  RETURN NEW;
END $func$;

DROP TRIGGER IF EXISTS trg_nf_criar_recebimento ON public.nf_entrada;
CREATE TRIGGER trg_nf_criar_recebimento
  AFTER INSERT ON public.nf_entrada
  FOR EACH ROW EXECUTE FUNCTION public.nf_criar_recebimento();

-- Quando itens forem inseridos depois (XML async), espelha também
CREATE OR REPLACE FUNCTION public.nf_item_espelhar_recebimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE v_receb_id uuid;
BEGIN
  SELECT id INTO v_receb_id FROM recebimento_nf WHERE nf_id = NEW.nf_id;
  IF v_receb_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM recebimento_nf_item WHERE recebimento_id=v_receb_id AND nf_item_id=NEW.id
  ) THEN
    INSERT INTO recebimento_nf_item (recebimento_id, nf_item_id, produto_id, qtd_nf, qtd_recebida, condicao, conferido)
    VALUES (v_receb_id, NEW.id, NEW.produto_id, NEW.quantidade, NEW.quantidade, 'ok', false);
  END IF;
  RETURN NEW;
END $func$;

DROP TRIGGER IF EXISTS trg_nf_item_espelhar_recebimento ON public.nf_entrada_item;
CREATE TRIGGER trg_nf_item_espelhar_recebimento
  AFTER INSERT ON public.nf_entrada_item
  FOR EACH ROW EXECUTE FUNCTION public.nf_item_espelhar_recebimento();

-- ============================================
-- FUNÇÃO: Confirmar recebimento
-- ============================================
CREATE OR REPLACE FUNCTION public.recebimento_confirmar(_recebimento_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE
  v_receb RECORD;
  v_nf RECORD;
  v_item RECORD;
  v_almox uuid;
  v_count_lancado int := 0;
  v_count_ocorrencias int := 0;
  v_tipo_ocor recebimento_ocorrencia_tipo;
  v_descr text;
  v_tem_divergencia boolean := false;
BEGIN
  SELECT * INTO v_receb FROM recebimento_nf WHERE id = _recebimento_id;
  IF v_receb IS NULL THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'almoxarife') OR has_role(auth.uid(),'fiscal_recebedor') OR has_role(auth.uid(),'controladoria'))
            AND v_receb.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar recebimento';
  END IF;

  IF v_receb.status IN ('recebido','recebido_com_ocorrencia','cancelado') THEN
    RAISE EXCEPTION 'Recebimento já finalizado (%)', v_receb.status;
  END IF;

  SELECT * INTO v_nf FROM nf_entrada WHERE id = v_receb.nf_id;
  v_almox := v_receb.almoxarifado_id;
  IF v_almox IS NULL THEN
    SELECT id INTO v_almox FROM almoxarifado WHERE empresa_id=v_receb.empresa_id AND is_matriz=true LIMIT 1;
  END IF;

  -- Lança no estoque o que foi recebido (qtd_recebida) e abre ocorrências para divergências
  FOR v_item IN
    SELECT ri.*, p.codigo AS produto_codigo
      FROM recebimento_nf_item ri
      LEFT JOIN produto p ON p.id = ri.produto_id
     WHERE ri.recebimento_id = _recebimento_id
  LOOP
    IF v_item.produto_id IS NULL THEN
      RAISE EXCEPTION 'Item sem produto vinculado — confira a NF antes';
    END IF;

    -- Lança a quantidade RECEBIDA (não a da NF) — política B: aceitar e abrir ocorrência
    IF v_item.qtd_recebida > 0 THEN
      INSERT INTO estoque_movimento
        (empresa_id, almoxarifado_id, produto_id, tipo, origem, origem_id,
         quantidade, custo_unitario, contrato_id, centro_custo_id,
         documento, observacoes, user_id)
      VALUES
        (v_receb.empresa_id, v_almox, v_item.produto_id, 'entrada', 'recebimento_nf', _recebimento_id,
         v_item.qtd_recebida,
         COALESCE((SELECT valor_unitario FROM nf_entrada_item WHERE id=v_item.nf_item_id),0),
         v_nf.contrato_id, v_nf.centro_custo_id,
         'NF '||v_nf.numero||'/'||COALESCE(v_nf.serie,'1')||' (recebimento)',
         'Entrada via recebimento físico', auth.uid());
      v_count_lancado := v_count_lancado + 1;
    END IF;

    -- Detecta divergência e abre ocorrência
    IF v_item.qtd_recebida <> v_item.qtd_nf OR v_item.condicao <> 'ok' THEN
      v_tem_divergencia := true;
      IF v_item.condicao = 'ok' AND v_item.qtd_recebida < v_item.qtd_nf THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Faltante: NF='||v_item.qtd_nf||' recebido='||v_item.qtd_recebida;
      ELSIF v_item.condicao = 'ok' AND v_item.qtd_recebida > v_item.qtd_nf THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Excedente: NF='||v_item.qtd_nf||' recebido='||v_item.qtd_recebida;
      ELSIF v_item.condicao = 'avariado' THEN
        v_tipo_ocor := 'qualidade'; v_descr := 'Avariado. '||COALESCE(v_item.observacoes,'');
      ELSIF v_item.condicao = 'trocado' THEN
        v_tipo_ocor := 'produto_trocado'; v_descr := 'Produto trocado. '||COALESCE(v_item.observacoes,'');
      ELSIF v_item.condicao = 'faltante' THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Item faltante. '||COALESCE(v_item.observacoes,'');
      ELSIF v_item.condicao = 'excedente' THEN
        v_tipo_ocor := 'quantidade'; v_descr := 'Item excedente. '||COALESCE(v_item.observacoes,'');
      ELSE
        v_tipo_ocor := 'outro'; v_descr := 'Divergência: '||COALESCE(v_item.observacoes,'');
      END IF;

      INSERT INTO recebimento_ocorrencia (empresa_id, recebimento_id, recebimento_item_id, tipo, descricao, aberta_por)
      VALUES (v_receb.empresa_id, _recebimento_id, v_item.id, v_tipo_ocor, v_descr, auth.uid());
      v_count_ocorrencias := v_count_ocorrencias + 1;
    END IF;
  END LOOP;

  UPDATE recebimento_nf SET
    status = CASE WHEN v_tem_divergencia THEN 'recebido_com_ocorrencia'::recebimento_status ELSE 'recebido'::recebimento_status END,
    recebido_por = auth.uid(),
    finalizado_em = now()
  WHERE id = _recebimento_id;

  -- Atualiza NF para lancada_estoque
  UPDATE nf_entrada SET status='lancada_estoque', lancado_por=auth.uid(), lancado_em=now()
   WHERE id = v_receb.nf_id AND status <> 'lancada_estoque';

  RETURN jsonb_build_object(
    'itens_lancados', v_count_lancado,
    'ocorrencias_abertas', v_count_ocorrencias,
    'recebimento_id', _recebimento_id
  );
END $func$;

-- RLS
ALTER TABLE public.recebimento_nf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimento_nf_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimento_ocorrencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receb_select" ON public.recebimento_nf FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id=get_user_empresa(auth.uid()));
CREATE POLICY "receb_update" ON public.recebimento_nf FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR
    ((has_role(auth.uid(),'almoxarife') OR has_role(auth.uid(),'fiscal_recebedor') OR has_role(auth.uid(),'controladoria'))
      AND empresa_id=get_user_empresa(auth.uid())));
CREATE POLICY "receb_insert" ON public.recebimento_nf FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR
    ((has_role(auth.uid(),'almoxarife') OR has_role(auth.uid(),'fiscal_recebedor') OR has_role(auth.uid(),'comprador'))
      AND empresa_id=get_user_empresa(auth.uid())));

CREATE POLICY "receb_item_select" ON public.recebimento_nf_item FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM recebimento_nf r WHERE r.id=recebimento_id
    AND (has_role(auth.uid(),'admin') OR r.empresa_id=get_user_empresa(auth.uid()))));
CREATE POLICY "receb_item_all" ON public.recebimento_nf_item FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM recebimento_nf r WHERE r.id=recebimento_id
    AND (has_role(auth.uid(),'admin') OR
      ((has_role(auth.uid(),'almoxarife') OR has_role(auth.uid(),'fiscal_recebedor') OR has_role(auth.uid(),'controladoria'))
        AND r.empresa_id=get_user_empresa(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM recebimento_nf r WHERE r.id=recebimento_id
    AND (has_role(auth.uid(),'admin') OR
      ((has_role(auth.uid(),'almoxarife') OR has_role(auth.uid(),'fiscal_recebedor') OR has_role(auth.uid(),'controladoria'))
        AND r.empresa_id=get_user_empresa(auth.uid())))));

CREATE POLICY "ocor_select" ON public.recebimento_ocorrencia FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id=get_user_empresa(auth.uid()));
CREATE POLICY "ocor_insert" ON public.recebimento_ocorrencia FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR empresa_id=get_user_empresa(auth.uid()));
CREATE POLICY "ocor_update" ON public.recebimento_ocorrencia FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR
    ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'almoxarife'))
      AND empresa_id=get_user_empresa(auth.uid())));