DO $mig$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_roles text;
  v_cmd text;
  v_perm text;
  v_sql text;
  v_targets text[] := ARRAY[
    'titulo_pagar','titulo_pagar_baixa','titulo_pagar_parcela',
    'titulo_receber','titulo_receber_baixa','titulo_receber_parcela',
    'pre_titulo_pagar','financeiro_pagamento_aprovacao','financeiro_pagamento_log','financeiro_pagamento_validacao',
    'programacao_pagamento','movimento_bancario','extrato_bancario',
    'conciliacao_match','conciliacao_regra','conciliacao_regras',
    'cnab_remessa','cnab_retorno','cobranca_boleto','cobranca_evento','cobranca_pix',
    'banco_layout','banco_layout_template','banco_layout_teste','banco_layout_versao',
    'conta_bancaria','fornecedor',
    'requisicao_compra','requisicao_compra_item',
    'pedido_compra','pedido_compra_item',
    'cotacao','cotacao_fornecedor','cotacao_item','cotacao_proposta','cotacao_proposta_item','cotacao_rc',
    'nf_entrada','nf_entrada_item','nf_entrada_log',
    'nota_fiscal','nota_fiscal_evento','nota_fiscal_item',
    'recebimento_nf','recebimento_nf_item','recebimento_ocorrencia'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (v_targets)
      AND (qual ILIKE '%get_user_empresa%' OR with_check ILIKE '%get_user_empresa%')
  LOOP
    v_qual  := r.qual;
    v_check := r.with_check;

    -- regex: opcional alias.empresa_id = get_user_empresa(auth.uid())
    -- => user_pode_atuar_empresa(auth.uid(), <alias.>empresa_id)
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(
        v_qual,
        '(\(?)(([a-zA-Z_][a-zA-Z0-9_]*\.)?empresa_id)\s*=\s*get_user_empresa\(auth\.uid\(\)\)(\)?)',
        'user_pode_atuar_empresa(auth.uid(), \2)',
        'g'
      );
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(
        v_check,
        '(\(?)(([a-zA-Z_][a-zA-Z0-9_]*\.)?empresa_id)\s*=\s*get_user_empresa\(auth\.uid\(\)\)(\)?)',
        'user_pode_atuar_empresa(auth.uid(), \2)',
        'g'
      );
    END IF;

    IF (v_qual ILIKE '%get_user_empresa%') OR (v_check ILIKE '%get_user_empresa%') THEN
      RAISE NOTICE 'PULADO (padrão não reconhecido): %.% / %', r.schemaname, r.tablename, r.policyname;
      CONTINUE;
    END IF;

    v_roles := array_to_string(ARRAY(SELECT quote_ident(unnest) FROM unnest(r.roles)), ', ');
    v_cmd := r.cmd;
    v_perm := CASE WHEN r.permissive = 'PERMISSIVE' THEN 'AS PERMISSIVE' ELSE 'AS RESTRICTIVE' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    v_sql := format('CREATE POLICY %I ON %I.%I %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename, v_perm, v_cmd, v_roles);

    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_qual);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;

    EXECUTE v_sql;
  END LOOP;
END
$mig$;