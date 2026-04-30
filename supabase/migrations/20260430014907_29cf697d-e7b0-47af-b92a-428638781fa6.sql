ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'financeiro';

DO $$ BEGIN CREATE TYPE titulo_receber_meio AS ENUM ('boleto','pix','ted','dinheiro','deposito','cartao','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cobranca_registro_status AS ENUM ('pendente','enviado','registrado','rejeitado','baixado','liquidado','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pix_cobranca_status AS ENUM ('ativa','concluida','removida','expirada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE regua_canal AS ENUM ('email','whatsapp','sms','ligacao','protesto','serasa','negativacao','interno'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE regua_etapa_status AS ENUM ('pendente','executada','falhou','cancelada','reagendada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE template_tipo AS ENUM ('email','whatsapp','sms','interno'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nfse_status AS ENUM ('rascunho','emitida','cancelada','rejeitada','substituida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS titulo_receber_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS nfse_numero_seq START 1;

ALTER TABLE public.titulo_receber
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS sacado_nome text,
  ADD COLUMN IF NOT EXISTS sacado_documento text,
  ADD COLUMN IF NOT EXISTS sacado_email text,
  ADD COLUMN IF NOT EXISTS sacado_telefone text,
  ADD COLUMN IF NOT EXISTS sacado_endereco jsonb,
  ADD COLUMN IF NOT EXISTS nfse_id uuid,
  ADD COLUMN IF NOT EXISTS valor_juros numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_multa numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meio_cobranca titulo_receber_meio NOT NULL DEFAULT 'boleto',
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.titulo_receber SET sacado_nome = cliente_nome WHERE sacado_nome IS NULL;
UPDATE public.titulo_receber SET numero = numero_documento WHERE numero IS NULL;

ALTER TABLE public.titulo_receber ALTER COLUMN sacado_nome SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.titulo_receber ADD CONSTRAINT titulo_receber_empresa_numero_uniq UNIQUE (empresa_id, numero);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_titulo_receber_empresa ON public.titulo_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_titulo_receber_status ON public.titulo_receber(status);
CREATE INDEX IF NOT EXISTS idx_titulo_receber_venc ON public.titulo_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_titulo_receber_contrato ON public.titulo_receber(contrato_id);

CREATE TABLE IF NOT EXISTS public.titulo_receber_baixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  titulo_id uuid NOT NULL REFERENCES public.titulo_receber(id) ON DELETE CASCADE,
  data_baixa date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  valor_juros numeric(15,2) NOT NULL DEFAULT 0,
  valor_multa numeric(15,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  meio titulo_receber_meio NOT NULL DEFAULT 'boleto',
  conta_bancaria_id uuid REFERENCES public.conta_bancaria(id) ON DELETE SET NULL,
  movimento_bancario_id uuid,
  observacoes text,
  origem text DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baixa_titulo ON public.titulo_receber_baixa(titulo_id);

CREATE TABLE IF NOT EXISTS public.cobranca_boleto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  titulo_id uuid NOT NULL UNIQUE REFERENCES public.titulo_receber(id) ON DELETE CASCADE,
  conta_bancaria_id uuid REFERENCES public.conta_bancaria(id) ON DELETE SET NULL,
  nosso_numero text,
  linha_digitavel text,
  codigo_barras text,
  url_pdf text,
  carteira text,
  instrucoes text,
  status_registro cobranca_registro_status NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  registrado_em timestamptz,
  payload_remessa jsonb,
  payload_retorno jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cobranca_pix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  titulo_id uuid NOT NULL UNIQUE REFERENCES public.titulo_receber(id) ON DELETE CASCADE,
  conta_bancaria_id uuid REFERENCES public.conta_bancaria(id) ON DELETE SET NULL,
  txid text NOT NULL,
  chave_pix text,
  qrcode_imagem text,
  copia_e_cola text,
  e2eid text,
  status pix_cobranca_status NOT NULL DEFAULT 'ativa',
  expiracao_segundos integer DEFAULT 86400,
  expira_em timestamptz,
  pago_em timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cobranca_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  titulo_id uuid REFERENCES public.titulo_receber(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  origem text,
  payload jsonb,
  processado boolean NOT NULL DEFAULT false,
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  serie text,
  codigo_verificacao text,
  rps_numero text,
  rps_serie text,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  competencia date,
  tomador_nome text NOT NULL,
  tomador_documento text,
  tomador_email text,
  tomador_endereco jsonb,
  contrato_id uuid REFERENCES public.contrato(id) ON DELETE SET NULL,
  discriminacao text,
  valor_servicos numeric(15,2) NOT NULL,
  aliquota_iss numeric(5,2) DEFAULT 0,
  valor_iss numeric(15,2) DEFAULT 0,
  iss_retido boolean DEFAULT false,
  valor_pis numeric(15,2) DEFAULT 0,
  valor_cofins numeric(15,2) DEFAULT 0,
  valor_ir numeric(15,2) DEFAULT 0,
  valor_csll numeric(15,2) DEFAULT 0,
  valor_inss numeric(15,2) DEFAULT 0,
  valor_liquido numeric(15,2),
  status nfse_status NOT NULL DEFAULT 'rascunho',
  xml_url text,
  pdf_url text,
  protocolo text,
  motivo_cancelamento text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero, serie)
);

CREATE TABLE IF NOT EXISTS public.template_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo template_tipo NOT NULL,
  assunto text,
  corpo text NOT NULL,
  variaveis jsonb DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS template_mensagem_codigo_uniq ON public.template_mensagem (COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

CREATE TABLE IF NOT EXISTS public.regua_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  aplicar_para text NOT NULL DEFAULT 'todos',
  valor_minimo numeric(15,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.regua_cobranca_etapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regua_id uuid NOT NULL REFERENCES public.regua_cobranca(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  dias_em_relacao_vencimento integer NOT NULL,
  canal regua_canal NOT NULL,
  template_id uuid REFERENCES public.template_mensagem(id) ON DELETE SET NULL,
  valor_minimo numeric(15,2) DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  observacao text,
  UNIQUE (regua_id, ordem)
);

CREATE TABLE IF NOT EXISTS public.regua_cobranca_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo_id uuid NOT NULL REFERENCES public.titulo_receber(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.regua_cobranca_etapa(id) ON DELETE SET NULL,
  canal regua_canal NOT NULL,
  status regua_etapa_status NOT NULL DEFAULT 'pendente',
  agendado_para timestamptz,
  executado_em timestamptz,
  destinatario text,
  assunto text,
  conteudo text,
  resposta jsonb,
  erro text,
  executado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regua_exec_titulo ON public.regua_cobranca_execucao(titulo_id);

ALTER TABLE public.titulo_receber_baixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_boleto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_pix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_cobranca_etapa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regua_cobranca_execucao ENABLE ROW LEVEL SECURITY;

CREATE POLICY trb_select ON public.titulo_receber_baixa FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) AND empresa_id = get_user_empresa(auth.uid()))
);
CREATE POLICY trb_insert ON public.titulo_receber_baixa FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY cb_all ON public.cobranca_boleto FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY cp_all ON public.cobranca_pix FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY ce_all ON public.cobranca_evento FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY nf_select ON public.nfse FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm') OR has_role(auth.uid(),'fiscal_recebedor')) AND empresa_id = get_user_empresa(auth.uid()))
);
CREATE POLICY nf_modify ON public.nfse FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY tm_select ON public.template_mensagem FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR empresa_id IS NULL OR empresa_id = get_user_empresa(auth.uid())
);
CREATE POLICY tm_modify ON public.template_mensagem FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY rc_all ON public.regua_cobranca FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

CREATE POLICY rce_all ON public.regua_cobranca_etapa FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM regua_cobranca r WHERE r.id = regua_id
      AND (has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
      AND r.empresa_id = get_user_empresa(auth.uid())
  )
) WITH CHECK (
  has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM regua_cobranca r WHERE r.id = regua_id
      AND has_role(auth.uid(),'controladoria') AND r.empresa_id = get_user_empresa(auth.uid())
  )
);

CREATE POLICY rcex_all ON public.regua_cobranca_execucao FOR ALL TO authenticated USING (
  has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) AND empresa_id = get_user_empresa(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid()))
);

DROP TRIGGER IF EXISTS cb_updated_at ON public.cobranca_boleto;
CREATE TRIGGER cb_updated_at BEFORE UPDATE ON public.cobranca_boleto FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS cp_updated_at ON public.cobranca_pix;
CREATE TRIGGER cp_updated_at BEFORE UPDATE ON public.cobranca_pix FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS nf_updated_at ON public.nfse;
CREATE TRIGGER nf_updated_at BEFORE UPDATE ON public.nfse FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS tm_updated_at ON public.template_mensagem;
CREATE TRIGGER tm_updated_at BEFORE UPDATE ON public.template_mensagem FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS rc_updated_at ON public.regua_cobranca;
CREATE TRIGGER rc_updated_at BEFORE UPDATE ON public.regua_cobranca FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.titulo_receber_atualizar_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_recebido numeric(15,2);
  v_titulo RECORD;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = NEW.titulo_id FOR UPDATE;
  SELECT COALESCE(SUM(valor),0) INTO v_total_recebido FROM titulo_receber_baixa WHERE titulo_id = NEW.titulo_id;
  UPDATE titulo_receber SET
    valor_recebido = v_total_recebido,
    valor_juros = COALESCE((SELECT SUM(valor_juros) FROM titulo_receber_baixa WHERE titulo_id = NEW.titulo_id), 0),
    valor_multa = COALESCE((SELECT SUM(valor_multa) FROM titulo_receber_baixa WHERE titulo_id = NEW.titulo_id), 0),
    valor_desconto = COALESCE((SELECT SUM(valor_desconto) FROM titulo_receber_baixa WHERE titulo_id = NEW.titulo_id), 0),
    status = CASE
      WHEN v_total_recebido >= v_titulo.valor THEN 'pago'::titulo_status
      WHEN v_total_recebido > 0 THEN 'parcial'::titulo_status
      ELSE v_titulo.status
    END,
    data_recebimento = CASE WHEN v_total_recebido >= v_titulo.valor THEN NEW.data_baixa ELSE v_titulo.data_recebimento END
  WHERE id = NEW.titulo_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trb_atualizar_status ON public.titulo_receber_baixa;
CREATE TRIGGER trb_atualizar_status AFTER INSERT ON public.titulo_receber_baixa
  FOR EACH ROW EXECUTE FUNCTION titulo_receber_atualizar_status();

CREATE OR REPLACE FUNCTION public.faturar_contrato_competencia(
  _contrato_id uuid,
  _competencia date,
  _valor numeric,
  _data_vencimento date,
  _meio_cobranca titulo_receber_meio DEFAULT 'boleto',
  _conta_bancaria_id uuid DEFAULT NULL,
  _sacado_nome text DEFAULT NULL,
  _sacado_documento text DEFAULT NULL,
  _sacado_email text DEFAULT NULL,
  _descricao text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato RECORD;
  v_titulo_id uuid;
  v_numero text;
BEGIN
  SELECT * INTO v_contrato FROM contrato WHERE id = _contrato_id;
  IF v_contrato IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND v_contrato.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para faturar';
  END IF;

  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  IF EXISTS (SELECT 1 FROM titulo_receber 
              WHERE contrato_id = _contrato_id AND competencia = _competencia AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Já existe título para este contrato na competência %', to_char(_competencia,'MM/YYYY');
  END IF;

  v_numero := 'TR-' || to_char(now(),'YYYY') || '-' || LPAD(nextval('titulo_receber_numero_seq')::text, 6, '0');

  INSERT INTO titulo_receber (
    empresa_id, numero, numero_documento, cliente_nome, sacado_nome, sacado_documento, sacado_email,
    contrato_id, competencia, valor, valor_recebido, data_emissao, data_vencimento,
    status, meio_cobranca, conta_bancaria_id, centro_custo_id, descricao, created_by
  ) VALUES (
    v_contrato.empresa_id, v_numero, v_numero,
    COALESCE(_sacado_nome, v_contrato.orgao, 'Cliente'),
    COALESCE(_sacado_nome, v_contrato.orgao, 'Cliente'),
    _sacado_documento, _sacado_email,
    _contrato_id, _competencia, _valor, 0, CURRENT_DATE, _data_vencimento,
    'aberto'::titulo_status, _meio_cobranca, _conta_bancaria_id,
    v_contrato.centro_custo_id,
    COALESCE(_descricao, 'Faturamento contrato ' || v_contrato.numero || ' - competência ' || to_char(_competencia,'MM/YYYY')),
    auth.uid()
  ) RETURNING id INTO v_titulo_id;

  RETURN jsonb_build_object('titulo_id', v_titulo_id, 'numero', v_numero);
END $$;

CREATE OR REPLACE FUNCTION public.titulo_baixar(
  _titulo_id uuid,
  _valor numeric,
  _data_baixa date DEFAULT CURRENT_DATE,
  _meio titulo_receber_meio DEFAULT 'boleto',
  _conta_bancaria_id uuid DEFAULT NULL,
  _juros numeric DEFAULT 0,
  _multa numeric DEFAULT 0,
  _desconto numeric DEFAULT 0,
  _observacoes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo RECORD;
  v_baixa_id uuid;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = _titulo_id;
  IF v_titulo IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND v_titulo.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para dar baixa';
  END IF;

  IF v_titulo.status IN ('pago','cancelado') THEN
    RAISE EXCEPTION 'Título já está com status %', v_titulo.status;
  END IF;

  IF (v_titulo.valor_recebido + _valor) > (v_titulo.valor + 0.01) THEN
    RAISE EXCEPTION 'Valor da baixa excede o saldo do título';
  END IF;

  INSERT INTO titulo_receber_baixa (
    empresa_id, titulo_id, data_baixa, valor, valor_juros, valor_multa, valor_desconto,
    meio, conta_bancaria_id, observacoes, created_by
  ) VALUES (
    v_titulo.empresa_id, _titulo_id, _data_baixa, _valor, _juros, _multa, _desconto,
    _meio, _conta_bancaria_id, _observacoes, auth.uid()
  ) RETURNING id INTO v_baixa_id;

  RETURN jsonb_build_object('baixa_id', v_baixa_id);
END $$;

CREATE OR REPLACE FUNCTION public.cobranca_gerar_pix(_titulo_id uuid, _chave_pix text DEFAULT NULL, _expiracao_segundos integer DEFAULT 86400)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo RECORD; v_pix_id uuid; v_txid text;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = _titulo_id;
  IF v_titulo IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND v_titulo.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_txid := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO cobranca_pix (empresa_id, titulo_id, conta_bancaria_id, txid, chave_pix, expiracao_segundos, expira_em)
  VALUES (v_titulo.empresa_id, _titulo_id, v_titulo.conta_bancaria_id, v_txid, _chave_pix, _expiracao_segundos, now() + (_expiracao_segundos || ' seconds')::interval)
  ON CONFLICT (titulo_id) DO UPDATE
    SET txid = EXCLUDED.txid, chave_pix = EXCLUDED.chave_pix,
        expira_em = EXCLUDED.expira_em, status = 'ativa', updated_at = now()
  RETURNING id INTO v_pix_id;
  UPDATE titulo_receber SET meio_cobranca = 'pix' WHERE id = _titulo_id;
  RETURN jsonb_build_object('pix_id', v_pix_id, 'txid', v_txid);
END $$;

CREATE OR REPLACE FUNCTION public.cobranca_gerar_boleto(_titulo_id uuid, _carteira text DEFAULT NULL, _instrucoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titulo RECORD; v_id uuid; v_nosso_numero text;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = _titulo_id;
  IF v_titulo IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND v_titulo.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_nosso_numero := LPAD(nextval('titulo_receber_numero_seq')::text, 10, '0');
  INSERT INTO cobranca_boleto (empresa_id, titulo_id, conta_bancaria_id, nosso_numero, carteira, instrucoes, status_registro)
  VALUES (v_titulo.empresa_id, _titulo_id, v_titulo.conta_bancaria_id, v_nosso_numero, _carteira, _instrucoes, 'pendente')
  ON CONFLICT (titulo_id) DO UPDATE
    SET nosso_numero = EXCLUDED.nosso_numero, carteira = EXCLUDED.carteira, instrucoes = EXCLUDED.instrucoes, updated_at = now()
  RETURNING id INTO v_id;
  UPDATE titulo_receber SET meio_cobranca = 'boleto' WHERE id = _titulo_id;
  RETURN jsonb_build_object('boleto_id', v_id, 'nosso_numero', v_nosso_numero);
END $$;

CREATE OR REPLACE FUNCTION public.titulo_receber_marcar_vencidos()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE titulo_receber SET status = 'vencido'::titulo_status
   WHERE status IN ('aberto'::titulo_status,'parcial'::titulo_status)
     AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.regua_agendar_etapas(_titulo_id uuid, _regua_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo RECORD; v_regua RECORD; v_etapa RECORD; v_count int := 0;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = _titulo_id;
  IF v_titulo IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;

  IF _regua_id IS NULL THEN
    SELECT * INTO v_regua FROM regua_cobranca
     WHERE empresa_id = v_titulo.empresa_id AND ativo = true
       AND (valor_minimo IS NULL OR v_titulo.valor >= valor_minimo)
     ORDER BY created_at ASC LIMIT 1;
  ELSE
    SELECT * INTO v_regua FROM regua_cobranca WHERE id = _regua_id;
  END IF;
  IF v_regua IS NULL THEN RETURN jsonb_build_object('agendadas', 0, 'motivo','sem régua aplicável'); END IF;

  FOR v_etapa IN
    SELECT * FROM regua_cobranca_etapa
     WHERE regua_id = v_regua.id AND ativo = true
       AND (valor_minimo IS NULL OR v_titulo.valor >= valor_minimo)
     ORDER BY ordem
  LOOP
    INSERT INTO regua_cobranca_execucao (
      empresa_id, titulo_id, etapa_id, canal, status, agendado_para, destinatario
    ) VALUES (
      v_titulo.empresa_id, _titulo_id, v_etapa.id, v_etapa.canal, 'pendente',
      (v_titulo.data_vencimento + v_etapa.dias_em_relacao_vencimento)::timestamptz,
      v_titulo.sacado_email
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('agendadas', v_count, 'regua_id', v_regua.id);
END $$;

INSERT INTO public.template_mensagem (empresa_id, codigo, nome, tipo, assunto, corpo, variaveis) VALUES
  (NULL, 'cobranca_pre_venc', 'Aviso pré-vencimento', 'email', 'Lembrete: fatura {{numero}} vence em {{dias}} dias',
   'Olá {{sacado}}, sua fatura {{numero}} no valor de R$ {{valor}} vence em {{data_vencimento}}.',
   '["numero","sacado","valor","data_vencimento","dias"]'::jsonb),
  (NULL, 'cobranca_venc_hoje', 'Vencimento hoje', 'email', 'Sua fatura {{numero}} vence hoje',
   'Olá {{sacado}}, sua fatura {{numero}} no valor de R$ {{valor}} vence hoje. Boleto/PIX em anexo.',
   '["numero","sacado","valor","data_vencimento"]'::jsonb),
  (NULL, 'cobranca_atraso_5', 'Atraso 5 dias', 'email', 'Fatura {{numero}} em atraso',
   'Identificamos que a fatura {{numero}} (R$ {{valor}}) venceu em {{data_vencimento}} e ainda consta em aberto.',
   '["numero","sacado","valor","data_vencimento"]'::jsonb),
  (NULL, 'cobranca_atraso_15', 'Atraso 15 dias', 'whatsapp', NULL,
   'Olá {{sacado}}, a fatura {{numero}} (R$ {{valor}}) está há {{dias_atraso}} dias em atraso.',
   '["numero","sacado","valor","dias_atraso"]'::jsonb),
  (NULL, 'cobranca_protesto', 'Aviso de protesto', 'email', 'AVISO: protesto da fatura {{numero}}',
   'A fatura {{numero}} (R$ {{valor}}) com {{dias_atraso}} dias de atraso será encaminhada a protesto.',
   '["numero","sacado","valor","dias_atraso"]'::jsonb),
  (NULL, 'cobranca_serasa', 'Negativação SERASA', 'email', 'Sua fatura {{numero}} será negativada',
   'A fatura {{numero}} (R$ {{valor}}) com {{dias_atraso}} dias de atraso será incluída em órgãos de proteção ao crédito.',
   '["numero","sacado","valor","dias_atraso"]'::jsonb)
ON CONFLICT DO NOTHING;