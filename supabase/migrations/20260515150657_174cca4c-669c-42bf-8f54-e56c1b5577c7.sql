
-- =========================================================================
-- BLOCO C — Motor de geração de lançamento contábil a partir de evento
-- =========================================================================

CREATE OR REPLACE FUNCTION public.gerar_lancamento_contabil(
  p_empresa_id        uuid,
  p_codigo_evento     text,
  p_data              date,
  p_valor             numeric,
  p_historico         text,
  p_origem_tipo       text DEFAULT NULL,
  p_origem_id         uuid DEFAULT NULL,
  p_centro_custo_id   uuid DEFAULT NULL,
  p_conta_banco_id    uuid DEFAULT NULL,   -- conta_contabil da conta bancária quando regra usa banco dinâmico
  p_conta_debito_id   uuid DEFAULT NULL,   -- override (ex.: EVT-014 manual)
  p_conta_credito_id  uuid DEFAULT NULL    -- override (ex.: EVT-014 manual)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra            regra_contabilizacao%ROWTYPE;
  v_conta_debito     uuid;
  v_conta_credito    uuid;
  v_classif_debito   text;
  v_classif_credito  text;
  v_lanc_id          uuid;
  v_numero           text;
  v_seq              int;
  v_hash             text;
  v_existente        uuid;
  v_banco_classif CONSTANT text := '01.1.1.02';
BEGIN
  -- Validações básicas
  IF p_empresa_id IS NULL OR p_codigo_evento IS NULL OR p_data IS NULL OR p_valor IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios faltando (empresa, evento, data, valor)';
  END IF;
  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo (recebido: %)', p_valor;
  END IF;

  -- Busca a regra
  SELECT * INTO v_regra
  FROM regra_contabilizacao
  WHERE empresa_id = p_empresa_id
    AND codigo_evento = p_codigo_evento
    AND ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regra ativa não encontrada para evento % na empresa %', p_codigo_evento, p_empresa_id;
  END IF;

  -- Resolve contas D/C
  v_conta_debito  := COALESCE(p_conta_debito_id,  v_regra.conta_debito_id);
  v_conta_credito := COALESCE(p_conta_credito_id, v_regra.conta_credito_id);

  -- Verifica se alguma é a conta-pai sintética de bancos (01.1.1.02) → exige p_conta_banco_id
  IF v_conta_debito IS NOT NULL THEN
    SELECT classificacao INTO v_classif_debito FROM conta_contabil WHERE id = v_conta_debito;
  END IF;
  IF v_conta_credito IS NOT NULL THEN
    SELECT classificacao INTO v_classif_credito FROM conta_contabil WHERE id = v_conta_credito;
  END IF;

  IF v_classif_debito = v_banco_classif THEN
    IF p_conta_banco_id IS NULL THEN
      RAISE EXCEPTION 'Evento % requer conta bancária (p_conta_banco_id) no DÉBITO', p_codigo_evento;
    END IF;
    v_conta_debito := p_conta_banco_id;
  END IF;
  IF v_classif_credito = v_banco_classif THEN
    IF p_conta_banco_id IS NULL THEN
      RAISE EXCEPTION 'Evento % requer conta bancária (p_conta_banco_id) no CRÉDITO', p_codigo_evento;
    END IF;
    v_conta_credito := p_conta_banco_id;
  END IF;

  IF v_conta_debito IS NULL OR v_conta_credito IS NULL THEN
    RAISE EXCEPTION 'Evento % sem contas D/C resolvidas (informe overrides para regras manuais)', p_codigo_evento;
  END IF;

  IF v_conta_debito = v_conta_credito THEN
    RAISE EXCEPTION 'Conta de DÉBITO igual à de CRÉDITO — partida inválida';
  END IF;

  -- Idempotência: hash determinístico por (empresa, evento, origem, valor, data)
  v_hash := encode(digest(
    p_empresa_id::text || '|' || p_codigo_evento || '|' ||
    COALESCE(p_origem_tipo, '') || '|' || COALESCE(p_origem_id::text, '') || '|' ||
    p_valor::text || '|' || p_data::text,
    'sha256'
  ), 'hex');

  SELECT id INTO v_existente
  FROM lancamento_contabil
  WHERE empresa_id = p_empresa_id AND hash_dedup = v_hash
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RETURN v_existente;
  END IF;

  -- Numeração: AAAA/NNNNNN sequencial por empresa+ano
  SELECT COUNT(*) + 1 INTO v_seq
  FROM lancamento_contabil
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM data_lancamento) = EXTRACT(YEAR FROM p_data);
  v_numero := to_char(p_data, 'YYYY') || '/' || lpad(v_seq::text, 6, '0');

  -- Cabeçalho
  INSERT INTO lancamento_contabil (
    empresa_id, numero, data_lancamento, competencia, historico,
    valor_total, origem, origem_tipo, origem_id, status, hash_dedup
  ) VALUES (
    p_empresa_id, v_numero, p_data, p_data,
    COALESCE(p_historico, v_regra.descricao),
    p_valor, 'auto:'||p_codigo_evento, p_origem_tipo, p_origem_id, 'efetivado', v_hash
  )
  RETURNING id INTO v_lanc_id;

  -- Partidas
  INSERT INTO lancamento_partida (lancamento_id, conta_contabil_id, centro_custo_id, dc, valor, historico)
  VALUES
    (v_lanc_id, v_conta_debito,  p_centro_custo_id, 'D', p_valor, p_historico),
    (v_lanc_id, v_conta_credito, p_centro_custo_id, 'C', p_valor, p_historico);

  RETURN v_lanc_id;
END;
$$;

-- Função para estornar (gera lançamento espelho com sinais invertidos)
CREATE OR REPLACE FUNCTION public.estornar_lancamento_contabil(
  p_lancamento_id uuid,
  p_motivo        text DEFAULT 'Estorno'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig         lancamento_contabil%ROWTYPE;
  v_novo_id      uuid;
  v_seq          int;
  v_numero       text;
  v_hash         text;
BEGIN
  SELECT * INTO v_orig FROM lancamento_contabil WHERE id = p_lancamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento % não encontrado', p_lancamento_id;
  END IF;
  IF v_orig.status = 'estornado' THEN
    RAISE EXCEPTION 'Lançamento % já estornado', p_lancamento_id;
  END IF;

  v_hash := encode(digest('estorno|'||p_lancamento_id::text, 'sha256'), 'hex');

  SELECT COUNT(*) + 1 INTO v_seq
  FROM lancamento_contabil
  WHERE empresa_id = v_orig.empresa_id
    AND EXTRACT(YEAR FROM data_lancamento) = EXTRACT(YEAR FROM CURRENT_DATE);
  v_numero := to_char(CURRENT_DATE, 'YYYY') || '/' || lpad(v_seq::text, 6, '0');

  INSERT INTO lancamento_contabil (
    empresa_id, numero, data_lancamento, competencia, historico,
    valor_total, origem, origem_tipo, origem_id, status, hash_dedup
  ) VALUES (
    v_orig.empresa_id, v_numero, CURRENT_DATE, v_orig.competencia,
    'ESTORNO ' || v_orig.numero || ' — ' || p_motivo,
    v_orig.valor_total, 'estorno', 'lancamento_contabil', v_orig.id, 'efetivado', v_hash
  )
  RETURNING id INTO v_novo_id;

  -- Inverte D ↔ C
  INSERT INTO lancamento_partida (lancamento_id, conta_contabil_id, centro_custo_id, dc, valor, historico)
  SELECT v_novo_id, conta_contabil_id, centro_custo_id,
         CASE WHEN dc='D' THEN 'C'::dc_tipo ELSE 'D'::dc_tipo END,
         valor, 'Estorno: '||COALESCE(historico,'')
  FROM lancamento_partida
  WHERE lancamento_id = p_lancamento_id;

  UPDATE lancamento_contabil SET status='estornado', updated_at=now() WHERE id = p_lancamento_id;

  RETURN v_novo_id;
END;
$$;

-- Garante que a extensão pgcrypto está disponível para digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
