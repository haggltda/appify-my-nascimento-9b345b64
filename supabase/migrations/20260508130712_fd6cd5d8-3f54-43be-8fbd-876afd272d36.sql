
CREATE OR REPLACE FUNCTION public.fn_promover_contratos_mz50(meses_default int DEFAULT 12)
RETURNS TABLE(contratos_inseridos int, contratos_existentes int, sem_empresa int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridos int := 0;
  v_existentes int := 0;
  v_sem_empresa int := 0;
  r record;
  v_empresa_id uuid;
  v_numero text;
  v_vig_ini date;
  v_valor numeric;
  v_cliente text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria')) THEN
    RAISE EXCEPTION 'Acesso negado: requer admin ou controladoria';
  END IF;

  FOR r IN
    WITH base AS (
      SELECT
        empresa,
        contrato,
        cliente,
        status_contrato,
        NULLIF(vigencia_inicio,'')::date AS vig_ini,
        NULLIF(regexp_replace(coalesce(valor_orcado_executado,'0'),'[^0-9.,-]','','g'),'')::numeric AS valor
      FROM public.mz_50_fato_orcamento_contratos_competencia
    ),
    ranked AS (
      SELECT
        empresa, contrato,
        MAX(vig_ini) AS vig_ini_max
      FROM base
      WHERE vig_ini IS NOT NULL
      GROUP BY empresa, contrato
    ),
    agg AS (
      SELECT
        b.empresa,
        b.contrato,
        MAX(b.cliente) AS cliente,
        r.vig_ini_max AS vig_ini,
        SUM(b.valor) AS valor_total
      FROM base b
      JOIN ranked r ON r.empresa=b.empresa AND r.contrato=b.contrato AND b.vig_ini=r.vig_ini_max
      GROUP BY b.empresa, b.contrato, r.vig_ini_max
    )
    SELECT * FROM agg
  LOOP
    SELECT id INTO v_empresa_id FROM public.empresas WHERE codigo = r.empresa LIMIT 1;
    IF v_empresa_id IS NULL THEN
      v_sem_empresa := v_sem_empresa + 1;
      CONTINUE;
    END IF;

    v_numero := left(r.contrato, 100);
    v_vig_ini := COALESCE(r.vig_ini, CURRENT_DATE);
    v_valor := COALESCE(r.valor_total, 0);
    v_cliente := COALESCE(r.cliente, 'NÃO INFORMADO');

    INSERT INTO public.contrato(
      empresa_id, numero, objeto, orgao,
      vigencia_inicio, vigencia_fim,
      valor_total, faturamento_mensal,
      status, observacoes
    ) VALUES (
      v_empresa_id, v_numero, left(r.contrato,200), left(v_cliente,200),
      v_vig_ini, (v_vig_ini + (meses_default || ' months')::interval)::date,
      v_valor, CASE WHEN meses_default > 0 THEN v_valor/meses_default ELSE 0 END,
      'ativo'::contrato_status,
      '[PROVISÓRIO mz_50] Aguardando planilha oficial de receita.'
    )
    ON CONFLICT (empresa_id, numero) DO NOTHING;

    IF FOUND THEN
      v_inseridos := v_inseridos + 1;
    ELSE
      v_existentes := v_existentes + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_inseridos, v_existentes, v_sem_empresa;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_promover_contratos_mz50(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_gerar_cronograma_provisorio(p_contrato_id uuid, p_meses int DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_contrato record;
  v_meses int;
  i int;
  v_comp date;
  v_valor_mensal numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria')) THEN
    RAISE EXCEPTION 'Acesso negado: requer admin ou controladoria';
  END IF;

  SELECT * INTO v_contrato FROM public.contrato WHERE id = p_contrato_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado', p_contrato_id;
  END IF;

  v_meses := COALESCE(p_meses,
    GREATEST(1, ((EXTRACT(YEAR FROM age(v_contrato.vigencia_fim, v_contrato.vigencia_inicio))*12
                 + EXTRACT(MONTH FROM age(v_contrato.vigencia_fim, v_contrato.vigencia_inicio))))::int));
  v_valor_mensal := COALESCE(v_contrato.faturamento_mensal,
                              CASE WHEN v_meses>0 THEN v_contrato.valor_total/v_meses ELSE 0 END);

  FOR i IN 0..v_meses-1 LOOP
    v_comp := date_trunc('month', v_contrato.vigencia_inicio + (i || ' months')::interval)::date;
    INSERT INTO public.cronograma_faturamento(
      empresa_id, contrato_id, competencia,
      data_emissao_prevista, data_recebimento_previsto,
      valor_previsto, status, observacoes
    ) VALUES (
      v_contrato.empresa_id, v_contrato.id, v_comp,
      (v_comp + interval '1 month - 1 day')::date,
      (v_comp + interval '1 month + 9 days')::date,
      v_valor_mensal, 'previsto'::cronograma_status,
      '[PROVISÓRIO mz_50]'
    )
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_gerar_cronograma_provisorio(uuid, int) TO authenticated;
