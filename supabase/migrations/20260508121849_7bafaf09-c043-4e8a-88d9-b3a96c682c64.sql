-- 1) Coluna de vínculo título <-> parcela do cronograma
ALTER TABLE public.titulo_receber
  ADD COLUMN IF NOT EXISTS cronograma_id uuid REFERENCES public.cronograma_faturamento(id) ON DELETE SET NULL;

-- Garante 1 título ativo por parcela (cancelados podem coexistir)
CREATE UNIQUE INDEX IF NOT EXISTS uq_titulo_receber_cronograma_ativo
  ON public.titulo_receber (cronograma_id)
  WHERE cronograma_id IS NOT NULL AND status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_titulo_receber_cronograma ON public.titulo_receber(cronograma_id);

-- 2) Emite título a partir de uma parcela do cronograma
CREATE OR REPLACE FUNCTION public.emitir_titulo_de_cronograma(
  _cronograma_id uuid,
  _data_vencimento date DEFAULT NULL,
  _meio_cobranca titulo_receber_meio DEFAULT 'boleto',
  _conta_bancaria_id uuid DEFAULT NULL,
  _sacado_nome text DEFAULT NULL,
  _sacado_documento text DEFAULT NULL,
  _sacado_email text DEFAULT NULL,
  _descricao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parc RECORD;
  v_contrato RECORD;
  v_titulo_id uuid;
  v_numero text;
  v_venc date;
BEGIN
  SELECT * INTO v_parc FROM cronograma_faturamento WHERE id = _cronograma_id;
  IF v_parc IS NULL THEN RAISE EXCEPTION 'Parcela do cronograma não encontrada'; END IF;

  SELECT * INTO v_contrato FROM contrato WHERE id = v_parc.contrato_id;
  IF v_contrato IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR (has_role(auth.uid(),'controladoria') AND v_contrato.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para faturar';
  END IF;

  IF v_parc.valor_previsto IS NULL OR v_parc.valor_previsto <= 0 THEN
    RAISE EXCEPTION 'Parcela com valor inválido';
  END IF;

  IF v_parc.status::text IN ('cancelado','recebido') THEN
    RAISE EXCEPTION 'Parcela em status % não pode ser emitida', v_parc.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM titulo_receber
     WHERE cronograma_id = _cronograma_id AND status <> 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Parcela já possui título emitido';
  END IF;

  v_venc := COALESCE(_data_vencimento, v_parc.data_recebimento_previsto, v_parc.competencia + INTERVAL '30 days');
  v_numero := 'TR-' || to_char(now(),'YYYY') || '-' || LPAD(nextval('titulo_receber_numero_seq')::text, 6, '0');

  INSERT INTO titulo_receber (
    empresa_id, numero, numero_documento, cliente_nome, sacado_nome, sacado_documento, sacado_email,
    contrato_id, cronograma_id, competencia, valor, valor_recebido, data_emissao, data_vencimento,
    status, meio_cobranca, conta_bancaria_id, centro_custo_id, descricao, created_by
  ) VALUES (
    v_contrato.empresa_id, v_numero, v_numero,
    COALESCE(_sacado_nome, v_contrato.orgao, 'Cliente'),
    COALESCE(_sacado_nome, v_contrato.orgao, 'Cliente'),
    _sacado_documento, _sacado_email,
    v_parc.contrato_id, _cronograma_id, v_parc.competencia, v_parc.valor_previsto, 0,
    CURRENT_DATE, v_venc,
    'aberto'::titulo_status, _meio_cobranca, _conta_bancaria_id,
    v_contrato.centro_custo_id,
    COALESCE(_descricao, 'Faturamento contrato ' || v_contrato.numero || ' - competência ' || to_char(v_parc.competencia,'MM/YYYY')),
    auth.uid()
  ) RETURNING id INTO v_titulo_id;

  UPDATE cronograma_faturamento
     SET status = 'emitido',
         valor_emitido = v_parc.valor_previsto,
         numero_nf = COALESCE(numero_nf, v_numero),
         updated_at = now()
   WHERE id = _cronograma_id;

  RETURN jsonb_build_object('titulo_id', v_titulo_id, 'numero', v_numero, 'cronograma_id', _cronograma_id);
END $$;

-- 3) Emissão em lote
CREATE OR REPLACE FUNCTION public.emitir_titulos_cronograma_lote(
  _ids uuid[],
  _meio_cobranca titulo_receber_meio DEFAULT 'boleto',
  _conta_bancaria_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_ok int := 0;
  v_fail int := 0;
  v_results jsonb := '[]'::jsonb;
  v_res jsonb;
  v_err text;
BEGIN
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN
    RETURN jsonb_build_object('ok',0,'fail',0,'detalhes','[]'::jsonb);
  END IF;

  FOREACH v_id IN ARRAY _ids LOOP
    BEGIN
      v_res := public.emitir_titulo_de_cronograma(v_id, NULL, _meio_cobranca, _conta_bancaria_id);
      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('cronograma_id', v_id, 'ok', true, 'titulo', v_res));
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_err := SQLERRM;
      v_results := v_results || jsonb_build_array(jsonb_build_object('cronograma_id', v_id, 'ok', false, 'erro', v_err));
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', v_ok, 'fail', v_fail, 'detalhes', v_results);
END $$;