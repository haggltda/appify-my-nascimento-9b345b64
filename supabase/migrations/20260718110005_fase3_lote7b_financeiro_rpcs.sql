-- FASE 3 (lote 7b, parte 4 — Financeiro) — RPCs com has_role(admin)/
-- get_user_empresa embutido no corpo (não em RLS) que ficaram de fora do
-- lote 2 porque a tabela em si (titulo_pagar/titulo_receber/pre_titulo_pagar/
-- malote_pagamento/conta_bancaria) já tinha sido corrigida, mas as RPCs que
-- operam sobre ela mantinham a própria cópia do check antigo.
--
-- Menu espelha a tabela-mãe de cada RPC (mesmo já usado no lote 2):
--   titulo_pagar_baixar/pre_titulo_*/malote_*/cnab_gerar_remessa/
--   titulo_agendar                              → 'contas-pagar'
--   faturar_contrato_competencia/titulo_baixar/
--   cobranca_gerar_pix/cobranca_gerar_boleto    → 'contas-receber'
--   cnab_processar_retorno/extrato_importar/
--   conciliacao_auto_match                      → 'conciliacao-bancaria'

-- ── titulo_pagar_baixar ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.titulo_pagar_baixar(
  _titulo_id uuid,
  _valor numeric,
  _data_baixa date DEFAULT CURRENT_DATE,
  _conta_bancaria_id uuid DEFAULT NULL,
  _juros numeric DEFAULT 0,
  _multa numeric DEFAULT 0,
  _desconto numeric DEFAULT 0,
  _observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_t RECORD; v_saldo numeric; v_novo_pago numeric; v_novo_status titulo_status;
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT * INTO v_t FROM titulo_pagar WHERE id=_titulo_id FOR UPDATE;
  IF v_t IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF v_t.status = 'pago' THEN RAISE EXCEPTION 'Título já pago'; END IF;
  IF v_t.status = 'cancelado' THEN RAISE EXCEPTION 'Título cancelado'; END IF;

  v_saldo := v_t.valor - COALESCE(v_t.valor_pago,0) + COALESCE(_juros,0) + COALESCE(_multa,0) - COALESCE(_desconto,0);
  IF _valor > v_saldo + 0.01 THEN RAISE EXCEPTION 'Valor maior que saldo (%) ', v_saldo; END IF;

  v_novo_pago := COALESCE(v_t.valor_pago,0) + _valor;
  v_novo_status := CASE
    WHEN v_novo_pago >= v_t.valor + COALESCE(_juros,0) + COALESCE(_multa,0) - COALESCE(_desconto,0) - 0.01 THEN 'pago'::titulo_status
    ELSE 'parcial'::titulo_status
  END;

  UPDATE titulo_pagar
     SET valor_pago = v_novo_pago,
         status = v_novo_status,
         data_pagamento = CASE WHEN v_novo_status='pago' THEN _data_baixa ELSE data_pagamento END,
         conta_bancaria_id = COALESCE(_conta_bancaria_id, conta_bancaria_id),
         observacoes = COALESCE(observacoes,'') || CASE WHEN _observacoes IS NOT NULL THEN E'\n[BAIXA '||to_char(_data_baixa,'DD/MM/YYYY')||'] '||_observacoes ELSE '' END
   WHERE id=_titulo_id;

  RETURN jsonb_build_object('titulo_id', _titulo_id, 'status', v_novo_status, 'valor_pago_total', v_novo_pago, 'saldo', v_t.valor - v_novo_pago);
END $$;

-- ── pre_titulo_submeter ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pre_titulo_submeter(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE pre_titulo_pagar SET status='em_aprovacao'::pre_titulo_status WHERE id=_id AND status='rascunho';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-título não encontrado ou não está em rascunho'; END IF;
END $$;

-- ── pre_titulo_aprovar ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pre_titulo_aprovar(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'aprovar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar';
  END IF;
  UPDATE pre_titulo_pagar
     SET status='aprovado'::pre_titulo_status, aprovador_id=auth.uid(), aprovado_em=now()
   WHERE id=_id AND status='em_aprovacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-título não encontrado ou não está em aprovação'; END IF;
END $$;

-- ── pre_titulo_rejeitar ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pre_titulo_rejeitar(_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'aprovar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE pre_titulo_pagar
     SET status='rejeitado'::pre_titulo_status, aprovador_id=auth.uid(), aprovado_em=now(), motivo_rejeicao=_motivo
   WHERE id=_id AND status='em_aprovacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-título não encontrado ou não está em aprovação'; END IF;
END $$;

-- ── pre_titulo_promover ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pre_titulo_promover(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_pt RECORD; v_titulo_id uuid;
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_pt FROM pre_titulo_pagar WHERE id=_id;
  IF v_pt IS NULL THEN RAISE EXCEPTION 'Pré-título não encontrado'; END IF;
  IF v_pt.status <> 'aprovado' THEN RAISE EXCEPTION 'Pré-título precisa estar aprovado para virar título'; END IF;

  INSERT INTO titulo_pagar(
    empresa_id, fornecedor_id, numero_documento, competencia, data_emissao, data_vencimento,
    valor, conta_contabil_id, centro_custo_id, forma_pagamento, status, observacoes, parcela_num, parcela_total
  ) VALUES (
    v_pt.empresa_id, v_pt.fornecedor_id, COALESCE(v_pt.numero_documento, 'PT-'||left(v_pt.id::text,8)),
    COALESCE(v_pt.competencia, date_trunc('month', v_pt.data_vencimento)::date),
    v_pt.data_emissao, v_pt.data_vencimento,
    v_pt.valor, v_pt.conta_contabil_id, v_pt.centro_custo_id,
    COALESCE(v_pt.forma_pagamento::text::forma_pagamento, 'boleto'::forma_pagamento),
    'aberto'::titulo_status, v_pt.observacoes, 1, 1
  ) RETURNING id INTO v_titulo_id;

  UPDATE pre_titulo_pagar
     SET status='promovido'::pre_titulo_status, titulo_pagar_id=v_titulo_id
   WHERE id=_id;

  RETURN v_titulo_id;
END $$;

-- ── malote_criar ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.malote_criar(_empresa_id uuid, _conta_bancaria_id uuid, _data_pagamento date, _descricao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'incluir'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO malote_pagamento(empresa_id, conta_bancaria_id, data_pagamento, descricao, criado_por)
  VALUES (_empresa_id, _conta_bancaria_id, _data_pagamento, _descricao, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── malote_adicionar_titulo ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.malote_adicionar_titulo(_malote_id uuid, _titulo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m RECORD; v_t RECORD;
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_m FROM malote_pagamento WHERE id=_malote_id;
  IF v_m IS NULL THEN RAISE EXCEPTION 'Malote não encontrado'; END IF;
  IF v_m.status <> 'rascunho' THEN RAISE EXCEPTION 'Malote já enviado/executado'; END IF;
  SELECT * INTO v_t FROM titulo_pagar WHERE id=_titulo_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF v_t.empresa_id <> v_m.empresa_id THEN RAISE EXCEPTION 'Título de empresa diferente do malote'; END IF;
  IF v_t.status NOT IN ('aberto','agendado','parcial') THEN RAISE EXCEPTION 'Título não está em status pagável'; END IF;

  INSERT INTO malote_titulo(malote_id, titulo_pagar_id) VALUES (_malote_id, _titulo_id) ON CONFLICT DO NOTHING;
  UPDATE malote_pagamento m
     SET qtd_titulos = (SELECT COUNT(*) FROM malote_titulo WHERE malote_id=m.id),
         valor_total = (SELECT COALESCE(SUM(t.valor),0) FROM malote_titulo mt JOIN titulo_pagar t ON t.id=mt.titulo_pagar_id WHERE mt.malote_id=m.id)
   WHERE id=_malote_id;
END $$;

-- ── malote_remover_titulo ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.malote_remover_titulo(_malote_id uuid, _titulo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m RECORD;
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_m FROM malote_pagamento WHERE id=_malote_id;
  IF v_m.status <> 'rascunho' THEN RAISE EXCEPTION 'Malote já enviado/executado'; END IF;
  DELETE FROM malote_titulo WHERE malote_id=_malote_id AND titulo_pagar_id=_titulo_id;
  UPDATE malote_pagamento m
     SET qtd_titulos = (SELECT COUNT(*) FROM malote_titulo WHERE malote_id=m.id),
         valor_total = (SELECT COALESCE(SUM(t.valor),0) FROM malote_titulo mt JOIN titulo_pagar t ON t.id=mt.titulo_pagar_id WHERE mt.malote_id=m.id)
   WHERE id=_malote_id;
END $$;

-- ── malote_executar ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.malote_executar(_malote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m RECORD; v_ids uuid[]; v_remessa jsonb;
BEGIN
  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_m FROM malote_pagamento WHERE id=_malote_id;
  IF v_m IS NULL THEN RAISE EXCEPTION 'Malote não encontrado'; END IF;
  IF v_m.status <> 'rascunho' THEN RAISE EXCEPTION 'Malote já enviado'; END IF;
  IF v_m.qtd_titulos = 0 THEN RAISE EXCEPTION 'Malote sem títulos'; END IF;

  SELECT array_agg(titulo_pagar_id) INTO v_ids FROM malote_titulo WHERE malote_id=_malote_id;
  v_remessa := cnab_gerar_remessa(v_m.conta_bancaria_id, v_ids);

  UPDATE malote_pagamento
     SET status='enviado'::malote_status,
         remessa_id = (v_remessa->>'remessa_id')::uuid,
         enviado_em = now()
   WHERE id=_malote_id;

  RETURN v_remessa;
END $$;

-- ── titulo_agendar ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.titulo_agendar(
  _titulo_id uuid,
  _conta_bancaria_id uuid,
  _data_pgto date,
  _forma public.forma_pagamento DEFAULT 'boleto'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_t RECORD;
BEGIN
  SELECT * INTO v_t FROM titulo_pagar WHERE id = _titulo_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;

  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_t.status NOT IN ('aberto','parcial') THEN
    RAISE EXCEPTION 'Título com status % não pode ser agendado', v_t.status;
  END IF;

  UPDATE titulo_pagar SET
    conta_bancaria_id = _conta_bancaria_id,
    data_agendamento = _data_pgto,
    forma_pagamento = _forma,
    status = 'agendado'::titulo_status,
    updated_at = now()
  WHERE id = _titulo_id;

  RETURN jsonb_build_object('titulo_id', _titulo_id, 'agendado_para', _data_pgto);
END $$;

-- ── cnab_gerar_remessa ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cnab_gerar_remessa(
  _conta_bancaria_id uuid,
  _titulo_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_conta RECORD; v_emp RECORD; v_t RECORD;
  v_seq int; v_lote int := 1;
  v_remessa_id uuid; v_remessa_numero text;
  v_qtd int := 0; v_valor numeric(15,2) := 0;
  v_arq text := '';
  v_header_arq text; v_header_lote text; v_segmA text;
  v_trailer_lote text; v_trailer_arq text;
  v_data text := to_char(now(),'DDMMYYYY');
  v_hora text := to_char(now(),'HH24MISS');
  v_reg int := 0;
  v_titulo_id uuid;
  v_ordem int := 0;
  v_cnpj_limpo text;
  v_forn_doc text;
BEGIN
  SELECT * INTO v_conta FROM conta_bancaria WHERE id = _conta_bancaria_id;
  IF v_conta IS NULL THEN RAISE EXCEPTION 'Conta bancária não encontrada'; END IF;

  IF NOT public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF _titulo_ids IS NULL OR array_length(_titulo_ids,1) IS NULL OR array_length(_titulo_ids,1)=0 THEN
    RAISE EXCEPTION 'Selecione ao menos 1 título';
  END IF;

  IF v_conta.cnab_convenio IS NULL OR v_conta.cnab_codigo_empresa IS NULL THEN
    RAISE EXCEPTION 'Cadastro CNAB incompleto: configure convênio e código da empresa na conta bancária';
  END IF;

  SELECT * INTO v_emp FROM empresas WHERE id = v_conta.empresa_id;
  v_cnpj_limpo := regexp_replace(COALESCE(v_conta.empresa_cnpj, v_emp.cnpj, ''),'[^0-9]','','g');

  v_seq := v_conta.cnab_proxima_sequencia;
  v_remessa_numero := 'REM-' || LPAD(nextval('remessa_cnab_seq')::text,6,'0');

  -- Header de Arquivo (240 chars) — registro 0
  v_header_arq :=
    LPAD(v_conta.banco_codigo,3,'0') ||  -- banco
    '0000' ||                             -- lote 0000 = header arq
    '0' ||                                -- registro 0
    rpad('',9,' ') ||                     -- CNAB brancos
    '2' ||                                -- tipo inscrição (2=CNPJ)
    LPAD(v_cnpj_limpo,14,'0') ||
    rpad(COALESCE(v_conta.cnab_convenio,''),20,' ') ||
    LPAD(v_conta.agencia,5,'0') ||
    rpad(COALESCE(v_conta.digito,''),1,' ') ||
    LPAD(v_conta.conta,12,'0') ||
    rpad(COALESCE(v_conta.digito,''),1,' ') ||
    ' ' ||
    rpad(COALESCE(v_emp.razao_social, v_emp.nome, 'EMPRESA'),30,' ') ||
    rpad(COALESCE(v_conta.banco_nome,''),30,' ') ||
    rpad('',10,' ') ||
    '1' ||                                -- código remessa (1)
    v_data || v_hora ||
    LPAD(v_seq::text,6,'0') ||
    '083' ||                              -- versão layout
    '00000' ||
    rpad('',20,' ') ||                    -- reservado banco
    rpad('',20,' ') ||                    -- reservado empresa
    rpad('',29,' ');
  v_arq := v_arq || v_header_arq || E'\n';
  v_reg := v_reg + 1;

  -- Header de Lote (registro 1) — Pagamentos a Fornecedores (20)
  v_header_lote :=
    LPAD(v_conta.banco_codigo,3,'0') ||
    LPAD(v_lote::text,4,'0') ||
    '1' ||
    'C' ||                                -- operação (C=crédito)
    '20' ||                               -- serviço 20=pagamento fornecedor
    '30' ||                               -- forma 30=DOC/TED (genérico)
    '046' ||                              -- versão lote
    ' ' ||
    '2' || LPAD(v_cnpj_limpo,14,'0') ||
    rpad(COALESCE(v_conta.cnab_convenio,''),20,' ') ||
    LPAD(v_conta.agencia,5,'0') ||
    rpad(COALESCE(v_conta.digito,''),1,' ') ||
    LPAD(v_conta.conta,12,'0') ||
    rpad(COALESCE(v_conta.digito,''),1,' ') ||
    ' ' ||
    rpad(COALESCE(v_emp.razao_social, v_emp.nome, 'EMPRESA'),30,' ') ||
    rpad('',40,' ') ||                    -- mensagem
    rpad('',30,' ') ||                    -- endereço
    LPAD('0',5,'0') || rpad('',15,' ') || rpad('',20,' ') ||
    LPAD('0',5,'0') ||
    rpad('',2,' ') ||
    rpad('',8,' ') ||
    rpad('',10,' ');
  v_arq := v_arq || v_header_lote || E'\n';
  v_reg := v_reg + 1;

  -- Detalhe Segmento A (pagamento)
  FOREACH v_titulo_id IN ARRAY _titulo_ids LOOP
    v_ordem := v_ordem + 1;
    SELECT t.*, f.razao_social AS forn_nome, f.cnpj AS forn_cnpj
      INTO v_t
      FROM titulo_pagar t
      LEFT JOIN fornecedor f ON f.id = t.fornecedor_id
     WHERE t.id = v_titulo_id;
    IF v_t IS NULL THEN CONTINUE; END IF;
    IF v_t.empresa_id <> v_conta.empresa_id THEN
      RAISE EXCEPTION 'Título % de empresa diferente da conta', v_titulo_id;
    END IF;
    IF v_t.status NOT IN ('aberto','agendado','parcial') THEN
      RAISE EXCEPTION 'Título % com status % não pode ir para remessa', v_titulo_id, v_t.status;
    END IF;
    IF v_t.remessa_status = 'enviado' THEN
      RAISE EXCEPTION 'Título % já está em remessa', v_titulo_id;
    END IF;

    v_forn_doc := regexp_replace(COALESCE(v_t.forn_cnpj,''),'[^0-9]','','g');

    v_segmA :=
      LPAD(v_conta.banco_codigo,3,'0') ||
      LPAD(v_lote::text,4,'0') ||
      '3' ||
      LPAD(v_ordem::text,5,'0') ||
      'A' ||
      '000' ||                              -- tipo movimento (000=inclusão)
      '018' ||                              -- câmara (018=TED)
      LPAD(v_conta.banco_codigo,3,'0') ||   -- banco favorecido (simplificação)
      LPAD('0',5,'0') ||                    -- agência favorecido
      ' ' ||
      LPAD('0',12,'0') ||                   -- conta favorecido
      ' ' ||
      ' ' ||
      rpad(COALESCE(v_t.forn_nome,'FORNECEDOR'),30,' ') ||
      rpad(COALESCE(v_t.numero_documento, v_t.id::text),20,' ') ||
      to_char(COALESCE(v_t.data_agendamento, v_t.data_vencimento),'DDMMYYYY') ||
      'BRL' ||
      LPAD('0',15,'0') ||
      LPAD(REPLACE(to_char(v_t.valor,'FM00000000000000.00'),'.',''),15,'0') ||
      rpad('',15,' ') ||                    -- nosso número
      to_char(COALESCE(v_t.data_agendamento, v_t.data_vencimento),'DDMMYYYY') ||
      LPAD('0',15,'0') ||
      rpad('',40,' ') ||
      rpad('',2,' ') ||
      LPAD('0',14,'0') ||
      rpad('',6,' ');
    v_arq := v_arq || v_segmA || E'\n';
    v_reg := v_reg + 1;
    v_qtd := v_qtd + 1;
    v_valor := v_valor + v_t.valor;
  END LOOP;

  -- Trailer de Lote (registro 5)
  v_trailer_lote :=
    LPAD(v_conta.banco_codigo,3,'0') ||
    LPAD(v_lote::text,4,'0') ||
    '5' ||
    rpad('',9,' ') ||
    LPAD((v_qtd + 2)::text,6,'0') || -- qtd registros do lote (header+detalhes+trailer)
    LPAD(REPLACE(to_char(v_valor,'FM000000000000000.00'),'.',''),18,'0') ||
    LPAD('0',18,'0') ||
    LPAD('0',6,'0') ||
    rpad('',165,' ');
  v_arq := v_arq || v_trailer_lote || E'\n';
  v_reg := v_reg + 1;

  -- Trailer de Arquivo (registro 9)
  v_trailer_arq :=
    LPAD(v_conta.banco_codigo,3,'0') ||
    '9999' ||
    '9' ||
    rpad('',9,' ') ||
    '000001' ||                          -- qtd lotes
    LPAD((v_reg + 1)::text,6,'0') ||     -- qtd registros total (incluindo este trailer)
    LPAD('0',6,'0') ||
    rpad('',205,' ');
  v_arq := v_arq || v_trailer_arq || E'\n';

  -- Persiste remessa
  INSERT INTO remessa_cnab
    (empresa_id, conta_bancaria_id, numero, sequencia_arquivo, layout, banco_codigo,
     qtd_titulos, valor_total, status, arquivo_nome, arquivo_conteudo, gerada_por)
  VALUES
    (v_conta.empresa_id, _conta_bancaria_id, v_remessa_numero, v_seq, '240', v_conta.banco_codigo,
     v_qtd, v_valor, 'gerada',
     'CNAB240_' || v_conta.banco_codigo || '_' || LPAD(v_seq::text,6,'0') || '.REM',
     v_arq, auth.uid())
  RETURNING id INTO v_remessa_id;

  -- Vincula títulos
  v_ordem := 0;
  FOREACH v_titulo_id IN ARRAY _titulo_ids LOOP
    v_ordem := v_ordem + 1;
    INSERT INTO remessa_cnab_titulo (remessa_id, titulo_id, valor_remessa, ordem)
    SELECT v_remessa_id, v_titulo_id, valor, v_ordem FROM titulo_pagar WHERE id = v_titulo_id;
    UPDATE titulo_pagar SET remessa_id = v_remessa_id, remessa_status = 'enviado'
     WHERE id = v_titulo_id;
  END LOOP;

  -- Incrementa sequência
  UPDATE conta_bancaria SET cnab_proxima_sequencia = v_seq + 1 WHERE id = _conta_bancaria_id;

  RETURN jsonb_build_object(
    'remessa_id', v_remessa_id,
    'numero', v_remessa_numero,
    'sequencia', v_seq,
    'qtd_titulos', v_qtd,
    'valor_total', v_valor,
    'arquivo_nome', 'CNAB240_'||v_conta.banco_codigo||'_'||LPAD(v_seq::text,6,'0')||'.REM'
  );
END $$;

-- ── faturar_contrato_competencia ─────────────────────────────────────────
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

  IF NOT public.can_access(auth.uid(), 'contas-receber', 'incluir'::app_acao) THEN
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

-- ── titulo_baixar ────────────────────────────────────────────────────────
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

  IF NOT public.can_access(auth.uid(), 'contas-receber', 'alterar'::app_acao) THEN
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

-- ── cobranca_gerar_pix ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cobranca_gerar_pix(_titulo_id uuid, _chave_pix text DEFAULT NULL, _expiracao_segundos integer DEFAULT 86400)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo RECORD; v_pix_id uuid; v_txid text;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = _titulo_id;
  IF v_titulo IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF NOT public.can_access(auth.uid(), 'contas-receber', 'alterar'::app_acao) THEN
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

-- ── cobranca_gerar_boleto ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cobranca_gerar_boleto(_titulo_id uuid, _carteira text DEFAULT NULL, _instrucoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titulo RECORD; v_id uuid; v_nosso_numero text;
BEGIN
  SELECT * INTO v_titulo FROM titulo_receber WHERE id = _titulo_id;
  IF v_titulo IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF NOT public.can_access(auth.uid(), 'contas-receber', 'alterar'::app_acao) THEN
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

-- ── cnab_processar_retorno ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cnab_processar_retorno(_retorno_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_ret RECORD;
BEGIN
  SELECT * INTO v_ret FROM retorno_bancario WHERE id = _retorno_id;
  IF v_ret IS NULL THEN RAISE EXCEPTION 'Retorno não encontrado'; END IF;
  IF NOT public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao) THEN
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

-- ── extrato_importar ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extrato_importar(_conta_bancaria_id uuid, _formato retorno_formato, _conteudo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_conta RECORD;
BEGIN
  SELECT * INTO v_conta FROM conta_bancaria WHERE id = _conta_bancaria_id;
  IF v_conta IS NULL THEN RAISE EXCEPTION 'Conta bancária não encontrada'; END IF;
  IF NOT public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN jsonb_build_object('status','stub','conta_bancaria_id',_conta_bancaria_id,
    'mensagem','Importador placeholder — plugar parser OFX/CSV depois.');
END $$;

-- ── conciliacao_auto_match ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.conciliacao_auto_match(_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_param RECORD; v_extrato RECORD; v_titulo RECORD;
  v_count_match int := 0; v_count_total int := 0;
BEGIN
  IF NOT public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao) THEN
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

NOTIFY pgrst, 'reload schema';
