-- =====================================================
-- BLOCO 7: Contas a Pagar (auto da NF) + CNAB 240
-- =====================================================

-- ENUMs novos
CREATE TYPE public.forma_pagamento AS ENUM ('boleto','ted','pix','transferencia','dinheiro','cheque','debito_automatico');
CREATE TYPE public.remessa_status AS ENUM ('gerada','enviada','processada','rejeitada','cancelada');
CREATE TYPE public.titulo_remessa_status AS ENUM ('nao_enviado','enviado','pago','rejeitado');

-- Adiciona 'agendado' ao titulo_status (se não existir)
DO $$ BEGIN
  ALTER TYPE public.titulo_status ADD VALUE IF NOT EXISTS 'agendado';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- titulo_pagar: novas colunas
-- =====================================================
ALTER TABLE public.titulo_pagar
  ADD COLUMN IF NOT EXISTS nf_entrada_id uuid REFERENCES public.nf_entrada(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parcela_num integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_total integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento,
  ADD COLUMN IF NOT EXISTS linha_digitavel text,
  ADD COLUMN IF NOT EXISTS codigo_barras text,
  ADD COLUMN IF NOT EXISTS nosso_numero text,
  ADD COLUMN IF NOT EXISTS pix_chave text,
  ADD COLUMN IF NOT EXISTS remessa_id uuid,
  ADD COLUMN IF NOT EXISTS remessa_status public.titulo_remessa_status NOT NULL DEFAULT 'nao_enviado',
  ADD COLUMN IF NOT EXISTS data_agendamento date;

CREATE INDEX IF NOT EXISTS idx_tp_nf ON public.titulo_pagar(nf_entrada_id);
CREATE INDEX IF NOT EXISTS idx_tp_status ON public.titulo_pagar(status);
CREATE INDEX IF NOT EXISTS idx_tp_remessa ON public.titulo_pagar(remessa_id);

-- =====================================================
-- conta_bancaria: cadastro CNAB
-- =====================================================
ALTER TABLE public.conta_bancaria
  ADD COLUMN IF NOT EXISTS empresa_cnpj text,
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS cnab_convenio text,
  ADD COLUMN IF NOT EXISTS cnab_codigo_empresa text,
  ADD COLUMN IF NOT EXISTS cnab_carteira text,
  ADD COLUMN IF NOT EXISTS cnab_codigo_remessa text,
  ADD COLUMN IF NOT EXISTS cnab_layout text NOT NULL DEFAULT '240',
  ADD COLUMN IF NOT EXISTS cnab_proxima_sequencia integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cnab_proximo_lote integer NOT NULL DEFAULT 1;

-- =====================================================
-- remessa_cnab
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS remessa_cnab_seq START 1;

CREATE TABLE public.remessa_cnab (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid NOT NULL REFERENCES public.conta_bancaria(id),
  numero text NOT NULL DEFAULT ('REM-'||LPAD(nextval('remessa_cnab_seq')::text,6,'0')),
  sequencia_arquivo integer NOT NULL,
  layout text NOT NULL DEFAULT '240',
  data_geracao timestamptz NOT NULL DEFAULT now(),
  data_envio timestamptz,
  banco_codigo text NOT NULL,
  qtd_titulos integer NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  status public.remessa_status NOT NULL DEFAULT 'gerada',
  arquivo_nome text,
  arquivo_conteudo text, -- CNAB 240 em texto
  retorno_arquivo_nome text,
  retorno_processado_em timestamptz,
  observacoes text,
  gerada_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, sequencia_arquivo)
);
CREATE INDEX idx_remessa_empresa ON public.remessa_cnab(empresa_id);
CREATE INDEX idx_remessa_conta ON public.remessa_cnab(conta_bancaria_id);

CREATE TABLE public.remessa_cnab_titulo (
  remessa_id uuid NOT NULL REFERENCES public.remessa_cnab(id) ON DELETE CASCADE,
  titulo_id uuid NOT NULL REFERENCES public.titulo_pagar(id) ON DELETE RESTRICT,
  valor_remessa numeric(15,2) NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  retorno_status text,
  retorno_msg text,
  PRIMARY KEY (remessa_id, titulo_id)
);

-- FK retroativa em titulo_pagar
DO $$ BEGIN
  ALTER TABLE public.titulo_pagar
    ADD CONSTRAINT titulo_pagar_remessa_fk FOREIGN KEY (remessa_id) REFERENCES public.remessa_cnab(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER trg_remessa_upd BEFORE UPDATE ON public.remessa_cnab
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RPC: gerar títulos a partir da NF (chamada por trigger)
-- =====================================================
CREATE OR REPLACE FUNCTION public.nf_gerar_titulos(_nf_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_nf RECORD; v_pc RECORD;
  v_partes text[]; v_n int; v_dias int;
  v_valor_parcela numeric(15,2); v_valor_total numeric(15,2);
  v_count int := 0; v_doc text;
  v_data_emis date := CURRENT_DATE;
  v_fornecedor_id uuid;
BEGIN
  SELECT * INTO v_nf FROM nf_entrada WHERE id = _nf_id;
  IF v_nf IS NULL THEN RAISE EXCEPTION 'NF não encontrada'; END IF;

  -- já tem títulos?
  IF EXISTS (SELECT 1 FROM titulo_pagar WHERE nf_entrada_id = _nf_id) THEN
    RETURN jsonb_build_object('skip', true, 'reason','titulos ja gerados');
  END IF;

  v_valor_total := COALESCE(v_nf.valor_total, 0);
  IF v_valor_total <= 0 THEN
    RETURN jsonb_build_object('skip', true, 'reason','valor_total zero');
  END IF;

  v_doc := COALESCE(v_nf.numero,'') || '/' || COALESCE(v_nf.serie,'1');

  -- fornecedor: tenta da NF (campo livre) -> PC -> nulo
  v_fornecedor_id := NULL;
  IF v_nf.pedido_compra_id IS NOT NULL THEN
    SELECT * INTO v_pc FROM pedido_compra WHERE id = v_nf.pedido_compra_id;
    IF v_pc IS NOT NULL THEN v_fornecedor_id := v_pc.fornecedor_id; END IF;
  END IF;

  -- determina parcelas pela condição de pagamento "30", "30/60/90", "à vista"
  v_partes := NULL;
  IF v_pc.condicao_pagamento IS NOT NULL THEN
    v_partes := regexp_split_to_array(regexp_replace(v_pc.condicao_pagamento,'[^0-9/]','','g'),'/');
    v_partes := array_remove(v_partes, '');
  END IF;

  IF v_partes IS NULL OR array_length(v_partes,1) IS NULL OR array_length(v_partes,1)=0 THEN
    -- 1 parcela à vista (vencimento +30 dias se nada definido)
    v_partes := ARRAY['30'];
  END IF;

  v_n := array_length(v_partes,1);
  v_valor_parcela := ROUND(v_valor_total / v_n, 2);

  FOR i IN 1..v_n LOOP
    v_dias := COALESCE(NULLIF(v_partes[i],'')::int, 30);
    -- ajusta última parcela para fechar centavos
    IF i = v_n THEN
      v_valor_parcela := v_valor_total - (ROUND(v_valor_total / v_n, 2) * (v_n-1));
    END IF;

    INSERT INTO titulo_pagar
      (empresa_id, fornecedor_id, pedido_id, nf_entrada_id, numero_documento,
       parcela_num, parcela_total, competencia, data_emissao, data_vencimento,
       valor, valor_pago, status, centro_custo_id, observacoes,
       forma_pagamento, remessa_status)
    VALUES
      (v_nf.empresa_id, v_fornecedor_id, v_nf.pedido_compra_id, _nf_id,
       v_doc || ' #' || i || '/' || v_n,
       i, v_n, v_data_emis, v_data_emis, (v_data_emis + (v_dias || ' days')::interval)::date,
       ROUND(v_valor_parcela,2), 0, 'aberto'::titulo_status,
       v_nf.centro_custo_id,
       'Auto-gerado da NF ' || v_doc,
       'boleto'::forma_pagamento, 'nao_enviado'::titulo_remessa_status);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('itens_gerados', v_count, 'nf_id', _nf_id, 'valor_total', v_valor_total);
END $$;

-- Trigger automático: NF passou para 'lancada_estoque' -> gera títulos
CREATE OR REPLACE FUNCTION public.nf_lancada_gerar_titulos_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status = 'lancada_estoque' AND (OLD.status IS DISTINCT FROM 'lancada_estoque') THEN
    PERFORM public.nf_gerar_titulos(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nf_lancada_gerar_titulos ON public.nf_entrada;
CREATE TRIGGER trg_nf_lancada_gerar_titulos
AFTER UPDATE ON public.nf_entrada
FOR EACH ROW EXECUTE FUNCTION public.nf_lancada_gerar_titulos_trg();

-- =====================================================
-- RPC: agendar título
-- =====================================================
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

  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
            AND v_t.empresa_id = get_user_empresa(auth.uid()))) THEN
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

-- =====================================================
-- RPC: gerar remessa CNAB 240 (Pagamento Fornecedor 20/30)
-- =====================================================
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

  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
            AND v_conta.empresa_id = get_user_empresa(auth.uid()))) THEN
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

-- =====================================================
-- RLS para novas tabelas
-- =====================================================
ALTER TABLE public.remessa_cnab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remessa_cnab_titulo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remessa_select" ON public.remessa_cnab FOR SELECT
USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));
CREATE POLICY "remessa_write" ON public.remessa_cnab FOR ALL
USING (has_role(auth.uid(),'admin')
   OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = get_user_empresa(auth.uid())))
WITH CHECK (has_role(auth.uid(),'admin')
   OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = get_user_empresa(auth.uid())));

CREATE POLICY "remessa_titulo_all" ON public.remessa_cnab_titulo FOR ALL
USING (EXISTS (SELECT 1 FROM remessa_cnab r WHERE r.id = remessa_id
        AND (has_role(auth.uid(),'admin') OR r.empresa_id = get_user_empresa(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM remessa_cnab r WHERE r.id = remessa_id
        AND (has_role(auth.uid(),'admin')
          OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND r.empresa_id = get_user_empresa(auth.uid())))));