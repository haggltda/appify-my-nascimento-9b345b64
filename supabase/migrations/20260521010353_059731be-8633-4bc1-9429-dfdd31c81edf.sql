
CREATE OR REPLACE FUNCTION public.promover_mz50_orcamento(_empresa_id uuid, _ano integer)
RETURNS TABLE(criados_contratos integer, criadas_linhas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_ciclo_id uuid; v_emp_codigo text;
  v_criados_c integer := 0; v_criadas_l integer := 0;
BEGIN
  SELECT codigo INTO v_emp_codigo FROM empresas WHERE id = _empresa_id;
  IF v_emp_codigo IS NULL THEN RAISE EXCEPTION 'empresa não encontrada'; END IF;

  SELECT id INTO v_ciclo_id FROM orcamento_ciclo WHERE empresa_id=_empresa_id AND ano=_ano LIMIT 1;
  IF v_ciclo_id IS NULL THEN
    INSERT INTO orcamento_ciclo (empresa_id, ano, nome, status)
      VALUES (_empresa_id, _ano, 'Importado mz_50 ' || _ano, 'aberto')
      RETURNING id INTO v_ciclo_id;
  END IF;

  WITH novos AS (
    SELECT DISTINCT c.id AS contrato_id
    FROM mz_50_fato_orcamento_contratos_competencia m
    JOIN contrato c ON c.empresa_id=_empresa_id AND lower(trim(c.numero)) = lower(trim(m.contrato))
    WHERE m.empresa = v_emp_codigo
    AND NOT EXISTS (SELECT 1 FROM orcamento_contrato oc WHERE oc.ciclo_id=v_ciclo_id AND oc.contrato_id=c.id)
  )
  INSERT INTO orcamento_contrato (empresa_id, ciclo_id, contrato_id, status)
    SELECT _empresa_id, v_ciclo_id, contrato_id, 'rascunho' FROM novos;
  GET DIAGNOSTICS v_criados_c = ROW_COUNT;

  WITH base AS (
    SELECT m.contrato AS contrato_txt, m.conta_contabil_codigo, m.classificacao_gerencial,
           NULLIF(m.valor_orcado_executado,'')::numeric AS valor,
           NULLIF(m.vigencia_inicio,'')::date AS ini, NULLIF(m.fim_contrato,'')::date AS fim
    FROM mz_50_fato_orcamento_contratos_competencia m
    WHERE m.empresa = v_emp_codigo AND UPPER(COALESCE(m.impacta_dre,''))='SIM'
      AND m.tipo_orcamento='ORÇADO' AND NULLIF(m.valor_orcado_executado,'') IS NOT NULL
      AND m.destino_id IS NULL
  ),
  expandido AS (
    SELECT c.id AS contrato_id,
           public.resolver_dre_linha(b.conta_contabil_codigo, b.classificacao_gerencial) AS l_codigo,
           gs.competencia, b.valor
    FROM base b
    JOIN contrato c ON c.empresa_id=_empresa_id AND lower(trim(c.numero))=lower(trim(b.contrato_txt))
    CROSS JOIN LATERAL (
      SELECT generate_series(
        date_trunc('month', GREATEST(b.ini, make_date(_ano,1,1)))::date,
        date_trunc('month', LEAST(COALESCE(b.fim, make_date(_ano,12,31)), make_date(_ano,12,31)))::date,
        '1 month'::interval
      )::date AS competencia
    ) gs
    WHERE b.ini IS NOT NULL
      AND COALESCE(b.fim, make_date(_ano,12,31)) >= make_date(_ano,1,1)
      AND b.ini <= make_date(_ano,12,31)
  ),
  agregado AS (
    SELECT contrato_id, l_codigo, competencia, SUM(valor) AS valor_total
    FROM expandido WHERE l_codigo IS NOT NULL
    GROUP BY contrato_id, l_codigo, competencia
  ),
  inseridas AS (
    INSERT INTO orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, competencia, valor_previsto, source, memoria_calculo)
    SELECT _empresa_id, oc.id, dl.id, a.competencia, a.valor_total, 'manual'::orcamento_linha_source,
           'Importado de mz_50'
    FROM agregado a
    JOIN orcamento_contrato oc ON oc.contrato_id=a.contrato_id AND oc.ciclo_id=v_ciclo_id
    JOIN dre_linhas dl ON dl.codigo=a.l_codigo
    ON CONFLICT (orcamento_contrato_id, dre_linha_id, competencia, (COALESCE(centro_custo_id,'00000000-0000-0000-0000-000000000000'::uuid)), source)
      DO UPDATE SET valor_previsto = EXCLUDED.valor_previsto, memoria_calculo = EXCLUDED.memoria_calculo
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_criadas_l FROM inseridas;

  RETURN QUERY SELECT v_criados_c, v_criadas_l;
END;$$;

DO $$
DECLARE r record; res record;
BEGIN
  FOR r IN SELECT id, codigo FROM empresas WHERE ativa=true LOOP
    SELECT * INTO res FROM public.promover_mz50_orcamento(r.id, 2025);
    RAISE NOTICE '% 2025: contratos=%, linhas=%', r.codigo, res.criados_contratos, res.criadas_linhas;
    SELECT * INTO res FROM public.promover_mz50_orcamento(r.id, 2026);
    RAISE NOTICE '% 2026: contratos=%, linhas=%', r.codigo, res.criados_contratos, res.criadas_linhas;
  END LOOP;
END $$;
