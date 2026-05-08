
CREATE OR REPLACE FUNCTION public.cnab_gerar_remessa_cobranca(_conta_bancaria_id uuid, _boleto_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conta RECORD;
  v_emp RECORD;
  v_b RECORD;
  v_remessa_id uuid;
  v_remessa_numero text;
  v_seq int;
  v_qtd int := 0;
  v_valor numeric(15,2) := 0;
  v_arq text := '';
  v_data text := to_char(now(),'DDMMYYYY');
  v_hora text := to_char(now(),'HH24MISS');
  v_cnpj text;
  v_boleto_id uuid;
  v_ordem int := 0;
  v_titulo RECORD;
BEGIN
  SELECT * INTO v_conta FROM conta_bancaria WHERE id = _conta_bancaria_id;
  IF v_conta IS NULL THEN RAISE EXCEPTION 'Conta bancária não encontrada'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
       OR ((has_role(auth.uid(),'controladoria')
         OR has_role(auth.uid(),'financeiro')
         OR has_role(auth.uid(),'diretor_adm'))
            AND v_conta.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para gerar remessa nesta conta';
  END IF;

  IF _boleto_ids IS NULL OR array_length(_boleto_ids,1) IS NULL OR array_length(_boleto_ids,1)=0 THEN
    RAISE EXCEPTION 'Selecione ao menos 1 boleto';
  END IF;

  IF v_conta.cnab_convenio IS NULL OR v_conta.cnab_codigo_empresa IS NULL THEN
    RAISE EXCEPTION 'Cadastro CNAB incompleto: configure convênio e código da empresa na conta bancária';
  END IF;

  SELECT * INTO v_emp FROM empresas WHERE id = v_conta.empresa_id;
  v_cnpj := regexp_replace(COALESCE(v_emp.cnpj,''),'[^0-9]','','g');
  v_seq := COALESCE(v_conta.cnab_proxima_sequencia, 1);
  v_remessa_numero := 'COBR-' || LPAD(nextval('remessa_cnab_seq')::text,6,'0');

  v_arq := '# CNAB 240 — REMESSA COBRANCA ' || v_remessa_numero || E'\n';
  v_arq := v_arq || '# Banco ' || COALESCE(v_conta.banco_nome,'') || ' Ag/Cc ' || v_conta.agencia || '/' || v_conta.conta || E'\n';
  v_arq := v_arq || '# Empresa ' || COALESCE(v_emp.razao_social, v_emp.nome_fantasia, '') || ' CNPJ ' || v_cnpj || E'\n';
  v_arq := v_arq || '# Gerado em ' || v_data || ' ' || v_hora || E'\n';

  FOREACH v_boleto_id IN ARRAY _boleto_ids LOOP
    v_ordem := v_ordem + 1;
    SELECT b.*, t.numero AS titulo_numero, t.valor AS titulo_valor, t.data_vencimento, t.sacado_nome, t.sacado_documento
      INTO v_b
      FROM cobranca_boleto b
      JOIN titulo_receber t ON t.id = b.titulo_id
      WHERE b.id = v_boleto_id AND b.empresa_id = v_conta.empresa_id;
    IF v_b.id IS NULL THEN CONTINUE; END IF;

    v_qtd := v_qtd + 1;
    v_valor := v_valor + COALESCE(v_b.titulo_valor,0);

    v_arq := v_arq ||
      LPAD(v_ordem::text,5,'0') || ';' ||
      rpad(v_b.nosso_numero,20,' ') || ';' ||
      rpad(COALESCE(v_b.titulo_numero,''),15,' ') || ';' ||
      to_char(v_b.data_vencimento,'DDMMYYYY') || ';' ||
      LPAD((COALESCE(v_b.titulo_valor,0)*100)::bigint::text,15,'0') || ';' ||
      rpad(left(COALESCE(v_b.sacado_nome,''),40),40,' ') || ';' ||
      regexp_replace(COALESCE(v_b.sacado_documento,''),'[^0-9]','','g') ||
      E'\n';
  END LOOP;

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Nenhum boleto válido encontrado entre os IDs informados';
  END IF;

  INSERT INTO remessa_cnab(
    empresa_id, conta_bancaria_id, formato, arquivo_nome, arquivo_conteudo,
    arquivo_hash, data_geracao_arquivo, status, qtd_registros, valor_total, origem
  ) VALUES (
    v_conta.empresa_id, _conta_bancaria_id, 'cnab240'::retorno_formato,
    v_remessa_numero || '.rem', v_arq,
    encode(digest(v_arq,'sha256'),'hex'),
    now(), 'gerada', v_qtd, v_valor, 'cobranca'
  )
  RETURNING id INTO v_remessa_id;

  v_ordem := 0;
  FOREACH v_boleto_id IN ARRAY _boleto_ids LOOP
    SELECT b.titulo_id, t.valor INTO v_b FROM cobranca_boleto b JOIN titulo_receber t ON t.id=b.titulo_id WHERE b.id=v_boleto_id;
    IF v_b.titulo_id IS NULL THEN CONTINUE; END IF;
    v_ordem := v_ordem + 1;
    INSERT INTO remessa_cnab_titulo(remessa_id, titulo_id, valor_remessa, ordem)
      VALUES (v_remessa_id, v_b.titulo_id, COALESCE(v_b.valor,0), v_ordem)
      ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE cobranca_boleto SET status_registro='enviado', enviado_em=now()
   WHERE id = ANY(_boleto_ids);

  UPDATE conta_bancaria SET cnab_proxima_sequencia = v_seq + 1 WHERE id = _conta_bancaria_id;

  RETURN jsonb_build_object(
    'remessa_id', v_remessa_id,
    'numero', v_remessa_numero,
    'qtd', v_qtd,
    'valor_total', v_valor
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cnab_gerar_remessa_cobranca(uuid, uuid[]) TO authenticated;
