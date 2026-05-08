
CREATE TABLE IF NOT EXISTS public.integration_alias_contas_contabeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL,
  conta_contabil_id uuid REFERENCES public.conta_contabil(id) ON DELETE SET NULL,
  status public.integ_alias_status NOT NULL DEFAULT 'pendente',
  origem text,
  resolvido_por uuid,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, alias)
);

CREATE TABLE IF NOT EXISTS public.integration_alias_dre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alias text NOT NULL,
  dre_linha_id uuid REFERENCES public.dre_linhas(id) ON DELETE SET NULL,
  status public.integ_alias_status NOT NULL DEFAULT 'pendente',
  origem text,
  resolvido_por uuid,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, alias)
);

ALTER TABLE public.integration_alias_contas_contabeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alias_dre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alias_contas_admin_ctrl_select" ON public.integration_alias_contas_contabeis
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "alias_contas_admin_ctrl_ins" ON public.integration_alias_contas_contabeis
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "alias_contas_admin_ctrl_upd" ON public.integration_alias_contas_contabeis
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));

CREATE POLICY "alias_dre_admin_ctrl_select" ON public.integration_alias_dre
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "alias_dre_admin_ctrl_ins" ON public.integration_alias_dre
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "alias_dre_admin_ctrl_upd" ON public.integration_alias_dre
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));

CREATE OR REPLACE FUNCTION public.integration_resolve_alias(p_tipo text, p_alias text, p_id_interno text, p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table   text;
  v_id_col  text;
  v_is_uuid boolean := true;
  v_value   text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'controladoria'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CASE p_tipo
    WHEN 'contratos'         THEN v_table := 'integration_alias_contratos';        v_id_col := 'contrato_id';
    WHEN 'centros_custo'     THEN v_table := 'integration_alias_centros_custo';    v_id_col := 'centro_custo_id';
    WHEN 'empresas'          THEN v_table := 'integration_alias_empresas';         v_id_col := 'empresa_destino_id';
    WHEN 'bancos'            THEN v_table := 'integration_alias_bancos';           v_id_col := 'banco_id';
    WHEN 'formas_pagamento'  THEN v_table := 'integration_alias_formas_pagamento'; v_id_col := 'forma_pagamento'; v_is_uuid := false;
    WHEN 'contas_contabeis'  THEN v_table := 'integration_alias_contas_contabeis'; v_id_col := 'conta_contabil_id';
    WHEN 'dre'               THEN v_table := 'integration_alias_dre';              v_id_col := 'dre_linha_id';
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
$function$;
