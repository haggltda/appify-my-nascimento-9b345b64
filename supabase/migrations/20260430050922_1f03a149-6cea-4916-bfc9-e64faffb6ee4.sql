CREATE OR REPLACE FUNCTION public.integration_resolve_alias(
  p_tipo text,
  p_alias text,
  p_id_interno text,    -- now text: caller passes uuid as string OR enum value
  p_empresa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table   text;
  v_id_col  text;
  v_is_uuid boolean := true;
  v_value   text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CASE p_tipo
    WHEN 'contratos'         THEN v_table := 'integration_alias_contratos';        v_id_col := 'contrato_id';
    WHEN 'centros_custo'     THEN v_table := 'integration_alias_centros_custo';    v_id_col := 'centro_custo_id';
    WHEN 'empresas'          THEN v_table := 'integration_alias_empresas';         v_id_col := 'empresa_destino_id';
    WHEN 'bancos'            THEN v_table := 'integration_alias_bancos';           v_id_col := 'banco_id';
    WHEN 'formas_pagamento'  THEN v_table := 'integration_alias_formas_pagamento'; v_id_col := 'forma_pagamento'; v_is_uuid := false;
    ELSE RAISE EXCEPTION 'tipo de alias inválido: %', p_tipo;
  END CASE;

  IF v_is_uuid THEN
    v_value := quote_literal(p_id_interno) || '::uuid';
  ELSE
    v_value := quote_literal(p_id_interno);
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (empresa_id, alias, %I, status, resolvido_em, resolvido_por)
     VALUES (%L, %L, %s, ''resolvido''::integ_alias_status, now(), %L)
     ON CONFLICT (empresa_id, alias) DO UPDATE
       SET %I = EXCLUDED.%I,
           status = ''resolvido''::integ_alias_status,
           resolvido_em = now(),
           resolvido_por = EXCLUDED.resolvido_por',
    v_table, v_id_col,
    p_empresa_id, p_alias, v_value, auth.uid(),
    v_id_col, v_id_col
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.integration_resolve_alias(text, text, text, uuid) TO authenticated;