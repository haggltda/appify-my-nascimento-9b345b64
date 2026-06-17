DO $$ BEGIN CREATE TYPE nfsai_tipo AS ENUM ('nfse','nfe','nfce'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nfsai_status AS ENUM ('rascunho','emitida','autorizada','cancelada','rejeitada','denegada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nfsai_origem AS ENUM ('titulo','medicao','avulsa','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nfsai_ambiente AS ENUM ('homologacao','producao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE imposto_tipo AS ENUM ('iss','pis','cofins','irpj','csll','das','inss','irrf'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE apuracao_status AS ENUM ('aberta','calculada','fechada','pago','atrasado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.empresa_fiscal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  regime regime_tributario NOT NULL DEFAULT 'lucro_presumido',
  ambiente nfsai_ambiente NOT NULL DEFAULT 'homologacao',
  cnae_principal text, inscricao_municipal text, inscricao_estadual text,
  nfse_serie text DEFAULT '1', nfse_proximo_numero integer DEFAULT 1,
  nfse_provedor text, nfse_token_secret_name text,
  nfe_serie text DEFAULT '1', nfe_proximo_numero integer DEFAULT 1, nfe_provedor text,
  aliq_iss numeric(5,2) DEFAULT 5.00, aliq_pis numeric(5,2) DEFAULT 0.65,
  aliq_cofins numeric(5,2) DEFAULT 3.00,
  aliq_irpj_presuncao numeric(5,2) DEFAULT 32.00, aliq_csll_presuncao numeric(5,2) DEFAULT 32.00,
  anexo_simples text, faixa_simples integer, aliq_simples_efetiva numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_empresa_fiscal_config_upd BEFORE UPDATE ON empresa_fiscal_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.servico_municipal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_lc116 text NOT NULL, codigo_municipal text, descricao text NOT NULL,
  aliq_iss numeric(5,2) NOT NULL DEFAULT 5.00, iss_retido_padrao boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, codigo_lc116)
);
CREATE TRIGGER trg_servico_municipal_upd BEFORE UPDATE ON servico_municipal FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.cfop (
  codigo text PRIMARY KEY, descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')), ativo boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.nota_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo nfsai_tipo NOT NULL, origem nfsai_origem NOT NULL DEFAULT 'avulsa',
  numero integer, serie text,
  status nfsai_status NOT NULL DEFAULT 'rascunho',
  ambiente nfsai_ambiente NOT NULL DEFAULT 'homologacao',
  data_emissao timestamptz,
  competencia date NOT NULL DEFAULT date_trunc('month', now())::date,
  tomador_nome text NOT NULL, tomador_documento text NOT NULL,
  tomador_email text, tomador_endereco jsonb, tomador_municipio text, tomador_uf text,
  titulo_receber_id uuid REFERENCES titulo_receber(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES contrato(id) ON DELETE SET NULL,
  medicao_id uuid,
  valor_servicos numeric(15,2) DEFAULT 0, valor_produtos numeric(15,2) DEFAULT 0,
  valor_desconto numeric(15,2) DEFAULT 0, base_calculo numeric(15,2) DEFAULT 0,
  valor_iss numeric(15,2) DEFAULT 0, valor_pis numeric(15,2) DEFAULT 0,
  valor_cofins numeric(15,2) DEFAULT 0, valor_inss numeric(15,2) DEFAULT 0,
  valor_irrf numeric(15,2) DEFAULT 0, valor_csll numeric(15,2) DEFAULT 0,
  iss_retido boolean DEFAULT false,
  valor_liquido numeric(15,2) DEFAULT 0, valor_total numeric(15,2) DEFAULT 0,
  codigo_servico text, discriminacao text,
  protocolo text, codigo_verificacao text, link_xml text, link_pdf text,
  rejeicao_motivo text, cancelada_em timestamptz, cancelamento_motivo text, cancelada_por uuid,
  observacoes text, emitida_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nf_empresa ON nota_fiscal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_nf_titulo ON nota_fiscal(titulo_receber_id);
CREATE INDEX IF NOT EXISTS idx_nf_status ON nota_fiscal(status);
CREATE INDEX IF NOT EXISTS idx_nf_competencia ON nota_fiscal(competencia);
CREATE TRIGGER trg_nota_fiscal_upd BEFORE UPDATE ON nota_fiscal FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.nota_fiscal_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES nota_fiscal(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1, descricao text NOT NULL,
  quantidade numeric(15,4) NOT NULL DEFAULT 1,
  valor_unitario numeric(15,4) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  produto_id uuid REFERENCES produto(id) ON DELETE SET NULL,
  ncm text, cfop text REFERENCES cfop(codigo), unidade text,
  servico_municipal_id uuid REFERENCES servico_municipal(id) ON DELETE SET NULL,
  aliq_iss numeric(5,2), valor_iss numeric(15,2) DEFAULT 0,
  aliq_pis numeric(5,2), valor_pis numeric(15,2) DEFAULT 0,
  aliq_cofins numeric(5,2), valor_cofins numeric(15,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfi_nota ON nota_fiscal_item(nota_fiscal_id);

CREATE TABLE IF NOT EXISTS public.nota_fiscal_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES nota_fiscal(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  status_anterior nfsai_status, status_novo nfsai_status,
  payload jsonb, user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfe_nota ON nota_fiscal_evento(nota_fiscal_id);

CREATE TABLE IF NOT EXISTS public.apuracao_imposto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL, imposto imposto_tipo NOT NULL,
  regime regime_tributario NOT NULL,
  base_calculo numeric(15,2) NOT NULL DEFAULT 0,
  aliquota numeric(7,4) NOT NULL DEFAULT 0,
  valor_devido numeric(15,2) NOT NULL DEFAULT 0,
  valor_retido numeric(15,2) NOT NULL DEFAULT 0,
  valor_a_pagar numeric(15,2) NOT NULL DEFAULT 0,
  vencimento date, data_pagamento date, valor_pago numeric(15,2),
  status apuracao_status NOT NULL DEFAULT 'aberta',
  observacoes text, calculado_por uuid, calculado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, competencia, imposto)
);
CREATE TRIGGER trg_apuracao_imposto_upd BEFORE UPDATE ON apuracao_imposto FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.apuracao_imposto_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apuracao_id uuid NOT NULL REFERENCES apuracao_imposto(id) ON DELETE CASCADE,
  nota_fiscal_id uuid REFERENCES nota_fiscal(id) ON DELETE SET NULL,
  base numeric(15,2) NOT NULL DEFAULT 0,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aii_apuracao ON apuracao_imposto_item(apuracao_id);

ALTER TABLE empresa_fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE servico_municipal ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfop ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_fiscal_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_fiscal_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE apuracao_imposto ENABLE ROW LEVEL SECURITY;
ALTER TABLE apuracao_imposto_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_config_select" ON empresa_fiscal_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "fiscal_config_manage" ON empresa_fiscal_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY "servico_select" ON servico_municipal FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "servico_manage" ON servico_municipal FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY "cfop_select_all" ON cfop FOR SELECT TO authenticated USING (true);
CREATE POLICY "cfop_manage_admin" ON cfop FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "nf_select" ON nota_fiscal FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "nf_manage" ON nota_fiscal FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro'))
        AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro'))
        AND empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY "nfi_select" ON nota_fiscal_item FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM nota_fiscal n WHERE n.id = nota_fiscal_item.nota_fiscal_id
    AND (has_role(auth.uid(),'admin') OR n.empresa_id = get_user_empresa(auth.uid()))));
CREATE POLICY "nfi_manage" ON nota_fiscal_item FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nota_fiscal n WHERE n.id = nota_fiscal_item.nota_fiscal_id
    AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND n.empresa_id = get_user_empresa(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM nota_fiscal n WHERE n.id = nota_fiscal_item.nota_fiscal_id
    AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND n.empresa_id = get_user_empresa(auth.uid())))));

CREATE POLICY "nfev_select" ON nota_fiscal_evento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM nota_fiscal n WHERE n.id = nota_fiscal_evento.nota_fiscal_id
    AND (has_role(auth.uid(),'admin') OR n.empresa_id = get_user_empresa(auth.uid()))));
CREATE POLICY "nfev_insert" ON nota_fiscal_evento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM nota_fiscal n WHERE n.id = nota_fiscal_evento.nota_fiscal_id
    AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND n.empresa_id = get_user_empresa(auth.uid())))));

CREATE POLICY "apur_select" ON apuracao_imposto FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "apur_manage" ON apuracao_imposto FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY "apur_item_select" ON apuracao_imposto_item FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM apuracao_imposto a WHERE a.id = apuracao_imposto_item.apuracao_id
    AND (has_role(auth.uid(),'admin') OR a.empresa_id = get_user_empresa(auth.uid()))));
CREATE POLICY "apur_item_manage" ON apuracao_imposto_item FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM apuracao_imposto a WHERE a.id = apuracao_imposto_item.apuracao_id
    AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND a.empresa_id = get_user_empresa(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM apuracao_imposto a WHERE a.id = apuracao_imposto_item.apuracao_id
    AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND a.empresa_id = get_user_empresa(auth.uid())))));

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
  IF NOT (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro'))
        AND _empresa_id = get_user_empresa(auth.uid()))) THEN
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
    COALESCE(_valor_servicos,0), COALESCE(_valor_produtos,0), v_base, v_iss, v_pis, v_cofins,
    v_base, v_base - v_iss - v_pis - v_cofins, _codigo_servico, _discriminacao, auth.uid()
  ) RETURNING id INTO v_nf_id;
  INSERT INTO nota_fiscal_evento (nota_fiscal_id, tipo, status_novo, payload, user_id)
  VALUES (v_nf_id, 'emissao', 'rascunho', jsonb_build_object('numero', v_numero, 'serie', v_serie), auth.uid());
  RETURN v_nf_id;
END $$;

CREATE OR REPLACE FUNCTION public.nota_fiscal_autorizar(_nf_id uuid, _protocolo text DEFAULT NULL, _link_pdf text DEFAULT NULL, _link_xml text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nf RECORD;
BEGIN
  SELECT * INTO v_nf FROM nota_fiscal WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND v_nf.empresa_id = get_user_empresa(auth.uid()))) THEN
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

CREATE OR REPLACE FUNCTION public.nota_fiscal_cancelar(_nf_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nf RECORD;
BEGIN
  IF _motivo IS NULL OR length(_motivo) < 15 THEN
    RAISE EXCEPTION 'Motivo de cancelamento exige no mínimo 15 caracteres';
  END IF;
  SELECT * INTO v_nf FROM nota_fiscal WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND v_nf.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_nf.status = 'cancelada' THEN RAISE EXCEPTION 'NF já cancelada'; END IF;
  UPDATE nota_fiscal SET status='cancelada', cancelada_em=now(),
    cancelamento_motivo=_motivo, cancelada_por=auth.uid()
  WHERE id = _nf_id;
  INSERT INTO nota_fiscal_evento (nota_fiscal_id, tipo, status_anterior, status_novo, payload, user_id)
  VALUES (_nf_id, 'cancelamento', v_nf.status, 'cancelada', jsonb_build_object('motivo', _motivo), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.apurar_impostos_competencia(_empresa_id uuid, _competencia date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg RECORD; v_inicio date; v_fim date;
  v_receita_servicos numeric := 0; v_receita_produtos numeric := 0; v_receita_total numeric := 0;
  v_iss numeric := 0; v_pis numeric := 0; v_cofins numeric := 0;
  v_irpj numeric := 0; v_csll numeric := 0; v_das numeric := 0;
  v_resultado jsonb := '{}'::jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'admin')
    OR ((has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'controladoria'))
        AND _empresa_id = get_user_empresa(auth.uid()))) THEN
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

INSERT INTO cfop (codigo, descricao, tipo) VALUES
  ('5101','Venda de produção do estabelecimento','saida'),
  ('5102','Venda de mercadoria adquirida ou recebida de terceiros','saida'),
  ('5933','Prestação de serviço tributado pelo ISSQN','saida'),
  ('6101','Venda de produção do estabelecimento (interestadual)','saida'),
  ('6102','Venda de mercadoria de terceiros (interestadual)','saida'),
  ('1102','Compra para comercialização','entrada'),
  ('1556','Compra de material para uso ou consumo','entrada'),
  ('2102','Compra para comercialização (interestadual)','entrada')
ON CONFLICT (codigo) DO NOTHING;