
DO $$
DECLARE
  r record;
  v_inserted uuid;
  i int;
  v_comp date;
BEGIN
  FOR r IN
    WITH base AS (
      SELECT empresa, contrato, cliente,
             NULLIF(vigencia_inicio,'')::date AS vig_ini,
             NULLIF(regexp_replace(coalesce(valor_orcado_executado,'0'),'[^0-9.,-]','','g'),'')::numeric AS valor
      FROM public.mz_50_fato_orcamento_contratos_competencia
    ),
    ranked AS (
      SELECT empresa, contrato, MAX(vig_ini) AS vig_ini_max
      FROM base WHERE vig_ini IS NOT NULL
      GROUP BY empresa, contrato
    ),
    agg AS (
      SELECT b.empresa, b.contrato, MAX(b.cliente) AS cliente,
             rk.vig_ini_max AS vig_ini, SUM(b.valor) AS valor_total
      FROM base b JOIN ranked rk
        ON rk.empresa=b.empresa AND rk.contrato=b.contrato AND b.vig_ini=rk.vig_ini_max
      GROUP BY b.empresa, b.contrato, rk.vig_ini_max
    )
    SELECT a.*, e.id AS empresa_id
    FROM agg a JOIN public.empresas e ON e.codigo=a.empresa
  LOOP
    INSERT INTO public.contrato(
      empresa_id, numero, objeto, orgao,
      vigencia_inicio, vigencia_fim,
      valor_total, faturamento_mensal,
      status, observacoes
    ) VALUES (
      r.empresa_id, left(r.contrato,100), left(r.contrato,200),
      left(COALESCE(r.cliente,'NÃO INFORMADO'),200),
      r.vig_ini, (r.vig_ini + interval '12 months')::date,
      COALESCE(r.valor_total,0), COALESCE(r.valor_total,0)/12,
      'ativo'::contrato_status,
      '[PROVISÓRIO mz_50] Aguardando planilha oficial de receita.'
    )
    ON CONFLICT (empresa_id, numero) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NOT NULL THEN
      FOR i IN 0..11 LOOP
        v_comp := date_trunc('month', r.vig_ini + (i || ' months')::interval)::date;
        INSERT INTO public.cronograma_faturamento(
          empresa_id, contrato_id, competencia,
          data_emissao_prevista, data_recebimento_previsto,
          valor_previsto, status, observacoes
        ) VALUES (
          r.empresa_id, v_inserted, v_comp,
          (v_comp + interval '1 month - 1 day')::date,
          (v_comp + interval '1 month + 9 days')::date,
          COALESCE(r.valor_total,0)/12,
          'previsto'::cronograma_status,
          '[PROVISÓRIO mz_50]'
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
      v_inserted := NULL;
    END IF;
  END LOOP;
END $$;
