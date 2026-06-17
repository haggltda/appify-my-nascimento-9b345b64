-- ============================================================
-- BLOCO 8: Infraestrutura de Integração Bancária (parametrização)
-- ============================================================

DO $$ BEGIN CREATE TYPE integracao_bancaria_tipo AS ENUM ('manual','api_rest','open_finance','cnab_arquivo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE integracao_ambiente AS ENUM ('sandbox','producao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE integracao_status AS ENUM ('nao_configurado','configurado','ativo','erro','pausado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE remessa_metodo_envio AS ENUM ('download_manual','api','ftp','sftp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE retorno_formato AS ENUM ('cnab240','cnab400','ofx','csv','api_json'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE retorno_status AS ENUM ('recebido','processando','processado','erro','parcial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE extrato_tipo AS ENUM ('credito','debito'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE extrato_status_conciliacao AS ENUM ('pendente','sugerido','conciliado','ignorado','divergente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.conta_bancaria
  ADD COLUMN IF NOT EXISTS integracao_tipo integracao_bancaria_tipo NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS integracao_ambiente integracao_ambiente NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS integracao_status integracao_status NOT NULL DEFAULT 'nao_configurado',
  ADD COLUMN IF NOT EXISTS integracao_api_url text,
  ADD COLUMN IF NOT EXISTS integracao_webhook_url text,
  ADD COLUMN IF NOT EXISTS integracao_client_id_ref text,
  ADD COLUMN IF NOT EXISTS integracao_client_secret_ref text,
  ADD COLUMN IF NOT EXISTS integracao_certificado_ref text,
  ADD COLUMN IF NOT EXISTS integracao_token_acesso_ref text,
  ADD COLUMN IF NOT EXISTS integracao_token_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS integracao_ftp_host text,
  ADD COLUMN IF NOT EXISTS integracao_ftp_porta int,
  ADD COLUMN IF NOT EXISTS integracao_ftp_pasta_remessa text,
  ADD COLUMN IF NOT EXISTS integracao_ftp_pasta_retorno text,
  ADD COLUMN IF NOT EXISTS integracao_ultima_sincronia timestamptz,
  ADD COLUMN IF NOT EXISTS integracao_ultimo_erro text,
  ADD COLUMN IF NOT EXISTS dias_baixa_automatica int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes_integracao text;

ALTER TABLE public.remessa_cnab
  ADD COLUMN IF NOT EXISTS metodo_envio remessa_metodo_envio NOT NULL DEFAULT 'download_manual',
  ADD COLUMN IF NOT EXISTS tentativas_envio int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_envio_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_envio_erro text,
  ADD COLUMN IF NOT EXISTS protocolo_banco text,
  ADD COLUMN IF NOT EXISTS data_confirmacao_banco timestamptz;

CREATE TABLE IF NOT EXISTS public.retorno_bancario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid NOT NULL REFERENCES public.conta_bancaria(id),
  formato retorno_formato NOT NULL DEFAULT 'cnab240',
  arquivo_nome text, arquivo_conteudo text, arquivo_hash text,
  data_geracao_arquivo date,
  data_recebimento timestamptz NOT NULL DEFAULT now(),
  data_processamento timestamptz,
  status retorno_status NOT NULL DEFAULT 'recebido',
  qtd_registros int DEFAULT 0, qtd_processados int DEFAULT 0, qtd_erros int DEFAULT 0,
  valor_total numeric(15,2) DEFAULT 0,
  origem text DEFAULT 'upload_manual',
  log_processamento text, recebido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, arquivo_hash)
);
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_empresa ON public.retorno_bancario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_retorno_bancario_status  ON public.retorno_bancario(status);

CREATE TABLE IF NOT EXISTS public.retorno_bancario_ocorrencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  retorno_id uuid NOT NULL REFERENCES public.retorno_bancario(id) ON DELETE CASCADE,
  titulo_pagar_id uuid REFERENCES public.titulo_pagar(id),
  titulo_receber_id uuid REFERENCES public.titulo_receber(id),
  nosso_numero text, seu_numero text,
  codigo_ocorrencia text, descricao_ocorrencia text,
  valor_titulo numeric(15,2), valor_pago numeric(15,2),
  valor_tarifa numeric(15,2) DEFAULT 0,
  valor_juros numeric(15,2) DEFAULT 0,
  valor_desconto numeric(15,2) DEFAULT 0,
  data_credito date, data_ocorrencia date,
  status_apos text,
  conta_id_credito uuid REFERENCES public.conta_bancaria(id),
  processado boolean NOT NULL DEFAULT false,
  erro_processamento text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retorno_ocor_retorno ON public.retorno_bancario_ocorrencia(retorno_id);
CREATE INDEX IF NOT EXISTS idx_retorno_ocor_titulo  ON public.retorno_bancario_ocorrencia(titulo_pagar_id);

CREATE TABLE IF NOT EXISTS public.extrato_bancario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid NOT NULL REFERENCES public.conta_bancaria(id),
  data_lancamento date NOT NULL, data_movimento date,
  tipo extrato_tipo NOT NULL,
  valor numeric(15,2) NOT NULL, saldo_apos numeric(15,2),
  descricao text, documento text, historico_codigo text,
  contraparte_nome text, contraparte_documento text,
  origem text DEFAULT 'manual',
  arquivo_origem_id uuid, hash_linha text,
  status_conciliacao extrato_status_conciliacao NOT NULL DEFAULT 'pendente',
  titulo_pagar_id uuid REFERENCES public.titulo_pagar(id),
  titulo_receber_id uuid REFERENCES public.titulo_receber(id),
  conciliado_em timestamptz, conciliado_por uuid,
  observacoes text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, hash_linha)
);
CREATE INDEX IF NOT EXISTS idx_extrato_empresa ON public.extrato_bancario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_extrato_conta_data ON public.extrato_bancario(conta_bancaria_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_extrato_status ON public.extrato_bancario(status_conciliacao);

CREATE TABLE IF NOT EXISTS public.conciliacao_regra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao_padrao text, contraparte_documento text,
  tipo_alvo extrato_tipo,
  conta_contabil_id uuid REFERENCES public.conta_contabil(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  prioridade int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conc_regra_empresa ON public.conciliacao_regra(empresa_id);

CREATE TABLE IF NOT EXISTS public.conciliacao_match (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  extrato_id uuid NOT NULL REFERENCES public.extrato_bancario(id) ON DELETE CASCADE,
  titulo_pagar_id uuid REFERENCES public.titulo_pagar(id),
  titulo_receber_id uuid REFERENCES public.titulo_receber(id),
  tipo_match text NOT NULL DEFAULT 'estrito',
  diferenca_valor numeric(15,2) DEFAULT 0,
  diferenca_dias int DEFAULT 0,
  confirmado_por uuid, confirmado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conc_match_extrato ON public.conciliacao_match(extrato_id);

CREATE TABLE IF NOT EXISTS public.parametro_integracao_bancaria (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  modo_match text NOT NULL DEFAULT 'estrito',
  tolerancia_valor numeric(15,2) NOT NULL DEFAULT 0,
  tolerancia_dias int NOT NULL DEFAULT 0,
  baixa_automatica boolean NOT NULL DEFAULT false,
  dias_baixa_automatica int NOT NULL DEFAULT 0,
  email_notificacao_erros text,
  webhook_global_url text,
  notificar_divergencias boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE TRIGGER trg_retorno_updated BEFORE UPDATE ON public.retorno_bancario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_conc_regra_updated BEFORE UPDATE ON public.conciliacao_regra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_param_int_bnc_updated BEFORE UPDATE ON public.parametro_integracao_bancaria FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.retorno_bancario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retorno_bancario_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extrato_bancario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacao_regra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacao_match ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametro_integracao_bancaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retorno_select ON public.retorno_bancario;
CREATE POLICY retorno_select ON public.retorno_bancario FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS retorno_modify ON public.retorno_bancario;
CREATE POLICY retorno_modify ON public.retorno_bancario FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

DROP POLICY IF EXISTS retorno_ocor_select ON public.retorno_bancario_ocorrencia;
CREATE POLICY retorno_ocor_select ON public.retorno_bancario_ocorrencia FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS retorno_ocor_modify ON public.retorno_bancario_ocorrencia;
CREATE POLICY retorno_ocor_modify ON public.retorno_bancario_ocorrencia FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

DROP POLICY IF EXISTS extrato_select ON public.extrato_bancario;
CREATE POLICY extrato_select ON public.extrato_bancario FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS extrato_modify ON public.extrato_bancario;
CREATE POLICY extrato_modify ON public.extrato_bancario FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

DROP POLICY IF EXISTS conc_regra_select ON public.conciliacao_regra;
CREATE POLICY conc_regra_select ON public.conciliacao_regra FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS conc_regra_modify ON public.conciliacao_regra;
CREATE POLICY conc_regra_modify ON public.conciliacao_regra FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid())));

DROP POLICY IF EXISTS conc_match_select ON public.conciliacao_match;
CREATE POLICY conc_match_select ON public.conciliacao_match FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS conc_match_modify ON public.conciliacao_match;
CREATE POLICY conc_match_modify ON public.conciliacao_match FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND empresa_id = get_user_empresa(auth.uid())));

DROP POLICY IF EXISTS param_int_bnc_select ON public.parametro_integracao_bancaria;
CREATE POLICY param_int_bnc_select ON public.parametro_integracao_bancaria FOR SELECT
  USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
DROP POLICY IF EXISTS param_int_bnc_modify ON public.parametro_integracao_bancaria;
CREATE POLICY param_int_bnc_modify ON public.parametro_integracao_bancaria FOR ALL
  USING (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND empresa_id = get_user_empresa(auth.uid())));

CREATE OR REPLACE FUNCTION public.cnab_processar_retorno(_retorno_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_ret RECORD;
BEGIN
  SELECT * INTO v_ret FROM retorno_bancario WHERE id = _retorno_id;
  IF v_ret IS NULL THEN RAISE EXCEPTION 'Retorno não encontrado'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND v_ret.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE retorno_bancario
     SET status = 'processado',
         data_processamento = now(),
         log_processamento = COALESCE(log_processamento,'') || E'\n[STUB] Parser ainda não implementado.'
   WHERE id = _retorno_id;
  RETURN jsonb_build_object('status','stub','retorno_id',_retorno_id,
    'mensagem','Parser placeholder — plugar implementação real depois.');
END $$;

CREATE OR REPLACE FUNCTION public.extrato_importar(_conta_bancaria_id uuid, _formato retorno_formato, _conteudo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_conta RECORD;
BEGIN
  SELECT * INTO v_conta FROM conta_bancaria WHERE id = _conta_bancaria_id;
  IF v_conta IS NULL THEN RAISE EXCEPTION 'Conta bancária não encontrada'; END IF;
  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND v_conta.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN jsonb_build_object('status','stub','conta_bancaria_id',_conta_bancaria_id,
    'mensagem','Importador placeholder — plugar parser OFX/CSV depois.');
END $$;

CREATE OR REPLACE FUNCTION public.conciliacao_auto_match(_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_param RECORD; v_extrato RECORD; v_titulo RECORD;
  v_count_match int := 0; v_count_total int := 0;
BEGIN
  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
           AND _empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_param FROM parametro_integracao_bancaria WHERE empresa_id = _empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO parametro_integracao_bancaria (empresa_id) VALUES (_empresa_id) RETURNING * INTO v_param;
  END IF;

  FOR v_extrato IN
    SELECT * FROM extrato_bancario
     WHERE empresa_id = _empresa_id
       AND status_conciliacao = 'pendente'
       AND tipo = 'debito'
  LOOP
    v_count_total := v_count_total + 1;
    SELECT tp.* INTO v_titulo
      FROM titulo_pagar tp
     WHERE tp.empresa_id = _empresa_id
       AND tp.valor = v_extrato.valor
       AND COALESCE(tp.data_pagamento, tp.data_agendamento, tp.data_vencimento) = v_extrato.data_lancamento
       AND tp.status IN ('agendado','enviado','pago')
       AND NOT EXISTS (SELECT 1 FROM conciliacao_match cm WHERE cm.titulo_pagar_id = tp.id)
     LIMIT 1;

    IF v_titulo.id IS NOT NULL THEN
      INSERT INTO conciliacao_match (empresa_id, extrato_id, titulo_pagar_id, tipo_match, confirmado_por, confirmado_em)
      VALUES (_empresa_id, v_extrato.id, v_titulo.id, 'estrito', auth.uid(), now());
      UPDATE extrato_bancario
         SET status_conciliacao = 'conciliado',
             titulo_pagar_id = v_titulo.id,
             conciliado_em = now(),
             conciliado_por = auth.uid()
       WHERE id = v_extrato.id;
      v_count_match := v_count_match + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'modo','estrito',
    'extratos_avaliados', v_count_total,
    'matches_realizados', v_count_match,
    'pendentes', v_count_total - v_count_match
  );
END $$;