-- ============================================================
-- BLOCO 3: NF DE ENTRADA (Importação XML)
-- ============================================================

-- 1. ENUMS
CREATE TYPE nf_status AS ENUM ('importada', 'validada', 'lancada_estoque', 'cancelada', 'rejeitada');
CREATE TYPE nf_item_status AS ENUM ('ok', 'pendente_revisao', 'produto_novo', 'divergencia');
CREATE TYPE nf_origem_destino AS ENUM ('estoque', 'contrato', 'consumo_imediato');

-- 2. TABELA: nf_entrada (cabeçalho)
CREATE TABLE public.nf_entrada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  chave_acesso text NOT NULL,
  numero text NOT NULL,
  serie text,
  modelo text DEFAULT '55',
  data_emissao date NOT NULL,
  data_entrada date,
  fornecedor_id uuid REFERENCES public.fornecedor(id),
  fornecedor_cnpj text NOT NULL,
  fornecedor_razao text,
  natureza_operacao text,
  cfop text,
  valor_produtos numeric(15,2) NOT NULL DEFAULT 0,
  valor_frete numeric(15,2) NOT NULL DEFAULT 0,
  valor_seguro numeric(15,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  valor_outras_despesas numeric(15,2) NOT NULL DEFAULT 0,
  valor_icms numeric(15,2) NOT NULL DEFAULT 0,
  valor_ipi numeric(15,2) NOT NULL DEFAULT 0,
  valor_pis numeric(15,2) NOT NULL DEFAULT 0,
  valor_cofins numeric(15,2) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  status nf_status NOT NULL DEFAULT 'importada',
  destino nf_origem_destino NOT NULL DEFAULT 'estoque',
  almoxarifado_id uuid REFERENCES public.almoxarifado(id),
  contrato_id uuid REFERENCES public.contrato(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  pedido_compra_id uuid,
  xml_storage_path text,
  xml_protocolo text,
  sefaz_status text,
  sefaz_consultado_em timestamptz,
  importado_por uuid,
  importado_em timestamptz NOT NULL DEFAULT now(),
  validado_por uuid,
  validado_em timestamptz,
  lancado_por uuid,
  lancado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave_acesso)
);

CREATE INDEX idx_nf_empresa ON public.nf_entrada(empresa_id);
CREATE INDEX idx_nf_status ON public.nf_entrada(status);
CREATE INDEX idx_nf_fornecedor ON public.nf_entrada(fornecedor_id);
CREATE INDEX idx_nf_chave ON public.nf_entrada(chave_acesso);
CREATE INDEX idx_nf_data ON public.nf_entrada(data_emissao DESC);

ALTER TABLE public.nf_entrada ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfe_select ON public.nf_entrada FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY nfe_insert ON public.nf_entrada FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY nfe_update ON public.nf_entrada FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY nfe_delete ON public.nf_entrada FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER nfe_set_updated BEFORE UPDATE ON public.nf_entrada FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER nfe_audit AFTER INSERT OR UPDATE OR DELETE ON public.nf_entrada FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 3. TABELA: nf_entrada_item
CREATE TABLE public.nf_entrada_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id uuid NOT NULL REFERENCES public.nf_entrada(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  numero_item integer NOT NULL,
  produto_id uuid REFERENCES public.produto(id),
  codigo_fornecedor text,
  ean text,
  descricao_original text NOT NULL,
  ncm text,
  cfop text,
  unidade text NOT NULL DEFAULT 'UN',
  quantidade numeric(15,4) NOT NULL,
  valor_unitario numeric(15,4) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  valor_frete numeric(15,2) NOT NULL DEFAULT 0,
  valor_icms numeric(15,2) NOT NULL DEFAULT 0,
  valor_ipi numeric(15,2) NOT NULL DEFAULT 0,
  status nf_item_status NOT NULL DEFAULT 'ok',
  produto_criado_auto boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfi_nf ON public.nf_entrada_item(nf_id);
CREATE INDEX idx_nfi_produto ON public.nf_entrada_item(produto_id);
CREATE INDEX idx_nfi_status ON public.nf_entrada_item(status);

ALTER TABLE public.nf_entrada_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfi_select ON public.nf_entrada_item FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY nfi_write ON public.nf_entrada_item FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
         AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'))
              AND (has_role(auth.uid(), 'admin') OR empresa_id = get_user_empresa(auth.uid())));

CREATE TRIGGER nfi_set_updated BEFORE UPDATE ON public.nf_entrada_item FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER nfi_audit AFTER INSERT OR UPDATE OR DELETE ON public.nf_entrada_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 4. TABELA: nf_entrada_log
CREATE TABLE public.nf_entrada_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id uuid NOT NULL REFERENCES public.nf_entrada(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  evento text NOT NULL,
  detalhes jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfl_nf ON public.nf_entrada_log(nf_id);
CREATE INDEX idx_nfl_data ON public.nf_entrada_log(created_at DESC);

ALTER TABLE public.nf_entrada_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfl_select ON public.nf_entrada_log FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY nfl_insert ON public.nf_entrada_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador'));

-- 5. STORAGE BUCKET para XMLs
INSERT INTO storage.buckets (id, name, public)
VALUES ('nfe-xml', 'nfe-xml', false)
ON CONFLICT (id) DO NOTHING;

-- Path pattern: {empresa_id}/{ano}/{mes}/{chave_acesso}.xml
CREATE POLICY "NFe XML — select por empresa" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nfe-xml'
         AND (has_role(auth.uid(), 'admin')
              OR storage_path_empresa(name) = get_user_empresa(auth.uid())));

CREATE POLICY "NFe XML — insert por empresa" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nfe-xml'
              AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'comprador') OR has_role(auth.uid(), 'controladoria'))
              AND (has_role(auth.uid(), 'admin')
                   OR storage_path_empresa(name) = get_user_empresa(auth.uid())));

CREATE POLICY "NFe XML — delete por empresa admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nfe-xml' AND has_role(auth.uid(), 'admin'));

-- 6. FUNÇÃO: lançar NF no estoque (cria movimentos de entrada para todos os itens)
CREATE OR REPLACE FUNCTION public.nf_lancar_estoque(_nf_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nf RECORD;
  v_item RECORD;
  v_almox uuid;
  v_count int := 0;
  v_pendente_count int;
BEGIN
  SELECT * INTO v_nf FROM nf_entrada WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;

  IF NOT (has_role(auth.uid(), 'admin')
          OR ((has_role(auth.uid(), 'almoxarife') OR has_role(auth.uid(), 'controladoria') OR has_role(auth.uid(), 'comprador'))
              AND v_nf.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para lançar NF';
  END IF;

  IF v_nf.status = 'lancada_estoque' THEN
    RAISE EXCEPTION 'NF já lançada no estoque';
  END IF;

  IF v_nf.status NOT IN ('importada', 'validada') THEN
    RAISE EXCEPTION 'NF com status % não pode ser lançada', v_nf.status;
  END IF;

  -- Bloqueia se houver itens pendentes de revisão
  SELECT COUNT(*) INTO v_pendente_count
    FROM nf_entrada_item
   WHERE nf_id = _nf_id AND status IN ('pendente_revisao', 'produto_novo');

  IF v_pendente_count > 0 THEN
    RAISE EXCEPTION 'Existem % item(ns) pendente(s) de revisão. Confirme antes de lançar.', v_pendente_count;
  END IF;

  -- Determina almoxarifado
  v_almox := v_nf.almoxarifado_id;
  IF v_almox IS NULL THEN
    SELECT id INTO v_almox FROM almoxarifado
     WHERE empresa_id = v_nf.empresa_id AND is_matriz = true LIMIT 1;
  END IF;
  IF v_almox IS NULL THEN
    RAISE EXCEPTION 'Almoxarifado não definido e Matriz não encontrada';
  END IF;

  -- Cria movimento de entrada para cada item
  FOR v_item IN SELECT * FROM nf_entrada_item WHERE nf_id = _nf_id ORDER BY numero_item LOOP
    IF v_item.produto_id IS NULL THEN
      RAISE EXCEPTION 'Item % sem produto vinculado', v_item.numero_item;
    END IF;

    INSERT INTO estoque_movimento
      (empresa_id, almoxarifado_id, produto_id, tipo, origem, origem_id,
       quantidade, custo_unitario, contrato_id, centro_custo_id,
       documento, observacoes, user_id)
    VALUES
      (v_nf.empresa_id, v_almox, v_item.produto_id, 'entrada', 'nf_entrada', _nf_id,
       v_item.quantidade, v_item.valor_unitario, v_nf.contrato_id, v_nf.centro_custo_id,
       'NF ' || v_nf.numero || '/' || COALESCE(v_nf.serie, '1'),
       'Entrada via NF ' || v_nf.numero, auth.uid());

    v_count := v_count + 1;
  END LOOP;

  -- Atualiza NF
  UPDATE nf_entrada SET
    status = 'lancada_estoque',
    lancado_por = auth.uid(),
    lancado_em = now(),
    almoxarifado_id = v_almox
  WHERE id = _nf_id;

  -- Log
  INSERT INTO nf_entrada_log (nf_id, empresa_id, evento, detalhes, user_id)
  VALUES (_nf_id, v_nf.empresa_id, 'lancada_estoque',
          jsonb_build_object('itens_lancados', v_count, 'almoxarifado_id', v_almox),
          auth.uid());

  RETURN jsonb_build_object('itens_lancados', v_count, 'almoxarifado_id', v_almox, 'nf_id', _nf_id);
END $$;