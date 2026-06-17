
-- 1) Função que rotula sublinhas a partir da classificação contábil + descrição da conta
CREATE OR REPLACE FUNCTION public.dre_sublinha_label(_classificacao text, _descricao text)
RETURNS TABLE(linha_codigo text, sub_codigo text, sub_descricao text, sub_ordem int)
LANGUAGE sql IMMUTABLE AS $$
  SELECT t.linha_codigo, t.sub_codigo, t.sub_descricao, t.sub_ordem FROM (VALUES
    ('03.1.1',        '%',              'L01', '1.1',  'Serviços prestados', 1),
    ('03.1.2',        '%ISS%',          'L02', '2.1',  'ISSQN', 1),
    ('03.1.2',        '%PIS%',          'L02', '2.2',  'PIS', 2),
    ('03.1.2',        '%COFINS%',       'L02', '2.3',  'COFINS', 3),
    ('03.1.2',        '%Simples%',      'L02', '2.4',  'Simples Nacional', 4),
    ('03.1.2',        '%',              'L02', '2.9',  'Outras deduções', 9),
    ('04.1.1',        '%',              'L05', '5.6',  'Custo das mercadorias vendidas', 6),
    ('04.1.3.02.015', '%',              'L04', '4.8',  'Vale alimentação', 8),
    ('04.1.3.02.016', '%',              'L04', '4.9',  'Vale transporte', 9),
    ('04.1.3.02.021', '%',              'L05', '5.1',  'Uniformes', 1),
    ('04.1.3.02.022', '%',              'L05', '5.2',  'EPIs', 2),
    ('04.1.3.02',     '%Sal%',          'L04', '4.1',  'Salários operacionais', 1),
    ('04.1.3.02',     '%13º%',          'L04', '4.2',  '13º salário operacional', 2),
    ('04.1.3.02',     '%Férias%',       'L04', '4.3',  'Férias e abono', 3),
    ('04.1.3.02',     '%Aviso%',        'L04', '4.4',  'Aviso prévio / rescisões', 4),
    ('04.1.3.02',     '%Multa%FGTS%',   'L04', '4.5',  'Multa rescisória FGTS', 5),
    ('04.1.3.02',     '%FGTS%',         'L04', '4.6',  'FGTS operacional', 6),
    ('04.1.3.02',     '%INSS%',         'L04', '4.7',  'INSS / CPP operacional', 7),
    ('04.1.3.02',     '%Saúde%',        'L04', '4.10', 'Saúde ocupacional', 10),
    ('04.1.3.02',     '%Seguro%Vida%',  'L04', '4.11', 'Seguro de vida', 11),
    ('04.1.3.02',     '%Manuten%',      'L05', '5.4',  'Manutenção bens, equipamentos e imóveis', 4),
    ('04.1.3.02',     '%',              'L04', '4.99', 'Outros custos com pessoal', 99),
    ('04.1.3.03',     '%',              'L05', '5.3',  'Bens não imobilizáveis de pequeno valor', 3),
    ('04.2.1.02',     '%Sal%',          'L07', '7.1',  'Salários administrativos', 1),
    ('04.2.1.02',     '%Comiss%',       'L07', '7.2',  'Comissões sobre vendas', 2),
    ('04.2.1.02',     '%',              'L07', '7.9',  'Outras despesas com pessoal adm', 9),
    ('04.2.1.03',     '%Aluguel%',      'L08', '8.1',  'Aluguel e condomínio', 1),
    ('04.2.1.03',     '%Condomin%',     'L08', '8.1',  'Aluguel e condomínio', 1),
    ('04.2.1.03',     '%Energia%',      'L08', '8.2',  'Água, energia, telefone, internet', 2),
    ('04.2.1.03',     '%Água%',         'L08', '8.2',  'Água, energia, telefone, internet', 2),
    ('04.2.1.03',     '%Telefone%',     'L08', '8.2',  'Água, energia, telefone, internet', 2),
    ('04.2.1.03',     '%Internet%',     'L08', '8.2',  'Água, energia, telefone, internet', 2),
    ('04.2.1.03',     '%Material%',     'L08', '8.3',  'Material de escritório e uso/consumo', 3),
    ('04.2.1.03',     '%Copa%',         'L08', '8.4',  'Copa e cozinha', 4),
    ('04.2.1.03',     '%Combust%',      'L08', '8.5',  'Combustíveis, veículos, pedágios, estacionamento', 5),
    ('04.2.1.03',     '%culo%',         'L08', '8.5',  'Combustíveis, veículos, pedágios, estacionamento', 5),
    ('04.2.1.03',     '%Pedágio%',      'L08', '8.5',  'Combustíveis, veículos, pedágios, estacionamento', 5),
    ('04.2.1.03',     '%Estacion%',     'L08', '8.5',  'Combustíveis, veículos, pedágios, estacionamento', 5),
    ('04.2.1.03',     '%Viagem%',       'L08', '8.6',  'Viagens, deslocamento e estadias', 6),
    ('04.2.1.03',     '%Viagens%',      'L08', '8.6',  'Viagens, deslocamento e estadias', 6),
    ('04.2.1.03',     '%Desloc%',       'L08', '8.6',  'Viagens, deslocamento e estadias', 6),
    ('04.2.1.03',     '%Hono%',         'L08', '8.7',  'Honorários contábeis e serviços PJ', 7),
    ('04.2.1.03',     '%terceiros%',    'L08', '8.7',  'Honorários contábeis e serviços PJ', 7),
    ('04.2.1.03',     '%Processamento%','L08', '8.8',  'Processamento de dados / sistemas', 8),
    ('04.2.1.03',     '%Seguro%',       'L08', '8.9',  'Seguros e seguro-garantia', 9),
    ('04.2.1.03',     '%Cart%rio%',     'L08', '8.10', 'Cartórios, custas e tabelionatos', 10),
    ('04.2.1.03',     '%Custas%',       'L08', '8.10', 'Cartórios, custas e tabelionatos', 10),
    ('04.2.1.03',     '%Sindical%',     'L08', '8.11', 'Contribuição sindical / anuidades', 11),
    ('04.2.1.03',     '%Anuidade%',     'L08', '8.11', 'Contribuição sindical / anuidades', 11),
    ('04.2.1.03',     '%Curso%',        'L08', '8.12', 'Cursos, congressos e feiras', 12),
    ('04.2.1.03',     '%Congresso%',    'L08', '8.12', 'Cursos, congressos e feiras', 12),
    ('04.2.1.03',     '%Deprecia%',     'L08', '8.13', 'Depreciações e amortizações', 13),
    ('04.2.1.03',     '%Amortiza%',     'L08', '8.13', 'Depreciações e amortizações', 13),
    ('04.2.1.03',     '%Frete%',        'L08', '8.14', 'Fretes, correios e malotes', 14),
    ('04.2.1.03',     '%Correio%',      'L08', '8.14', 'Fretes, correios e malotes', 14),
    ('04.2.1.03',     '%Malote%',       'L08', '8.14', 'Fretes, correios e malotes', 14),
    ('04.2.1.03',     '%',              'L08', '8.99', 'Outras despesas administrativas', 99),
    ('04.2.2',        '%',              'L09', '9.1',  'Serviços terceiros / impostos comerciais', 1),
    ('04.2.3',        '%Juros pagos%',  'L10', '10.1', 'Juros pagos / encargos financiamentos', 1),
    ('04.2.3',        '%Encargos%',     'L10', '10.1', 'Juros pagos / encargos financiamentos', 1),
    ('04.2.3',        '%bancár%',       'L10', '10.2', 'Despesas bancárias e IOF', 2),
    ('04.2.3',        '%IOF%',          'L10', '10.2', 'Despesas bancárias e IOF', 2),
    ('04.2.3',        '%Desconto%conce%','L10','10.3', 'Descontos concedidos', 3),
    ('04.2.3',        '%Multa%',        'L10', '10.4', 'Multas e juros s/ tributos', 4),
    ('04.2.3',        '%Rendimento%',   'L11', '11.1', 'Rendimentos de aplicação', 1),
    ('04.2.3',        '%APLICA%',       'L11', '11.1', 'Rendimentos de aplicação', 1),
    ('04.2.3',        '%Juros recebidos%','L11','11.2','Juros e descontos obtidos', 2),
    ('04.2.3',        '%DESCONTOS OBTIDOS%','L11','11.2','Juros e descontos obtidos', 2),
    ('04.2.3',        '%Outras Receitas%','L11','11.3','Outras receitas / atualizações', 3),
    ('04.2.3',        '%MONETARIAS%',   'L11', '11.3', 'Outras receitas / atualizações', 3),
    ('04.2.3',        '%',              'L10', '10.9', 'Outras despesas financeiras', 9),
    ('04.2.4',        '%IPTU%',         'L12', '12.1', 'IPTU', 1),
    ('04.2.4',        '%IPVA%',         'L12', '12.2', 'IPVA', 2),
    ('04.2.4',        '%IRRF%',         'L12', '12.3', 'IRRF (exclusivo na fonte)', 3),
    ('04.2.4',        '%Multa%',        'L12', '12.4', 'Multas contratuais', 4),
    ('04.2.4',        '%',              'L12', '12.9', 'Outras', 9)
  ) AS t(prefixo, padrao_desc, linha_codigo, sub_codigo, sub_descricao, sub_ordem)
  WHERE COALESCE(_classificacao,'') LIKE t.prefixo || '%'
    AND COALESCE(_descricao,'') ILIKE t.padrao_desc
  ORDER BY length(t.prefixo) DESC,
           CASE WHEN t.padrao_desc='%' THEN 1 ELSE 0 END,
           t.sub_ordem
  LIMIT 1;
$$;

-- 2) Coluna sub_codigo no orçamento por contrato + nova chave única
ALTER TABLE public.orcamento_contrato_linha
  ADD COLUMN IF NOT EXISTS sub_codigo text;

DROP INDEX IF EXISTS public.uq_ocl;
CREATE UNIQUE INDEX uq_ocl ON public.orcamento_contrato_linha
  (orcamento_contrato_id, dre_linha_id, (COALESCE(sub_codigo,'')), competencia,
   (COALESCE(centro_custo_id,'00000000-0000-0000-0000-000000000000'::uuid)), source);

CREATE INDEX IF NOT EXISTS ix_ocl_sub ON public.orcamento_contrato_linha (dre_linha_id, sub_codigo);

-- 3) Atualizar promover_mz50_orcamento p/ gravar sub_codigo
CREATE OR REPLACE FUNCTION public.promover_mz50_orcamento(_empresa_id uuid, _ano integer)
RETURNS TABLE(criados_contratos integer, criadas_linhas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    SELECT m.contrato AS contrato_txt, m.conta_contabil_codigo, m.conta_contabil_nome,
           m.classificacao_gerencial,
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
           (SELECT sub_codigo FROM public.dre_sublinha_label(b.conta_contabil_codigo, b.conta_contabil_nome) LIMIT 1) AS s_codigo,
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
    SELECT contrato_id, l_codigo, s_codigo, competencia, SUM(valor) AS valor_total
    FROM expandido WHERE l_codigo IS NOT NULL
    GROUP BY contrato_id, l_codigo, s_codigo, competencia
  ),
  inseridas AS (
    INSERT INTO orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, sub_codigo, competencia, valor_previsto, source, memoria_calculo)
    SELECT _empresa_id, oc.id, dl.id, a.s_codigo, a.competencia, a.valor_total, 'manual'::orcamento_linha_source,
           'Importado de mz_50'
    FROM agregado a
    JOIN orcamento_contrato oc ON oc.contrato_id=a.contrato_id AND oc.ciclo_id=v_ciclo_id
    JOIN dre_linhas dl ON dl.codigo=a.l_codigo
    ON CONFLICT (orcamento_contrato_id, dre_linha_id, (COALESCE(sub_codigo,'')), competencia, (COALESCE(centro_custo_id,'00000000-0000-0000-0000-000000000000'::uuid)), source)
      DO UPDATE SET valor_previsto = EXCLUDED.valor_previsto, memoria_calculo = EXCLUDED.memoria_calculo
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_criadas_l FROM inseridas;

  RETURN QUERY SELECT v_criados_c, v_criadas_l;
END;$function$;

-- 4) RPC detalhada (linha + sublinha + mês)
CREATE OR REPLACE FUNCTION public.dre_gerencial_competencia_detalhado(_empresa_id uuid, _ano integer, _versao_obz uuid DEFAULT NULL)
RETURNS TABLE(
  dre_linha_id uuid, linha_codigo text, linha_descricao text, linha_natureza text, linha_ordem int,
  sub_codigo text, sub_descricao text, sub_ordem int,
  mes int, realizado numeric, orcado numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas
  WHERE ativo=true AND (empresa_id=_empresa_id OR empresa_id IS NULL)
    AND codigo LIKE 'L%'
),
partidas AS (
  SELECT cc.dre_linha_id,
         lbl.sub_codigo, lbl.sub_descricao, lbl.sub_ordem,
         EXTRACT(MONTH FROM COALESCE(lc.competencia, lc.data_lancamento))::int AS mes,
         CASE WHEN cc.natureza::text IN ('receita','passivo','patrimonio_liquido')
              THEN CASE WHEN p.dc='C' THEN p.valor ELSE -p.valor END
              ELSE CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END
         END AS valor
  FROM public.lancamento_partida p
  JOIN public.lancamento_contabil lc ON lc.id = p.lancamento_id
  JOIN public.conta_contabil cc ON cc.id = p.conta_contabil_id
  LEFT JOIN LATERAL public.dre_sublinha_label(cc.classificacao, cc.descricao) lbl ON true
  WHERE lc.empresa_id=_empresa_id AND lc.status='efetivado'
    AND cc.dre_linha_id IS NOT NULL
    AND EXTRACT(YEAR FROM COALESCE(lc.competencia, lc.data_lancamento))=_ano
),
realizado_ms AS (
  SELECT dre_linha_id, sub_codigo, MAX(sub_descricao) sub_descricao, MAX(sub_ordem) sub_ordem,
         mes, SUM(valor) valor
  FROM partidas GROUP BY dre_linha_id, sub_codigo, mes
),
orcado_ms AS (
  SELECT v.dre_linha_id, v.sub_codigo, EXTRACT(MONTH FROM v.competencia)::int AS mes, SUM(v.valor_previsto) valor
  FROM public.orcamento_contrato_linha v
  JOIN public.orcamento_contrato oc ON oc.id=v.orcamento_contrato_id
  JOIN public.orcamento_ciclo cic ON cic.id=oc.ciclo_id
  WHERE v.empresa_id=_empresa_id AND cic.ano=_ano
  GROUP BY v.dre_linha_id, v.sub_codigo, EXTRACT(MONTH FROM v.competencia)
),
combo AS (
  SELECT dre_linha_id, sub_codigo FROM realizado_ms
  UNION
  SELECT dre_linha_id, sub_codigo FROM orcado_ms
),
sub_meta AS (
  SELECT dre_linha_id, sub_codigo, MAX(sub_descricao) sub_descricao, MAX(sub_ordem) sub_ordem
  FROM realizado_ms GROUP BY dre_linha_id, sub_codigo
)
SELECT l.id, l.codigo, l.descricao, l.natureza, l.ordem,
       c.sub_codigo,
       COALESCE(sm.sub_descricao, c.sub_codigo, '—') AS sub_descricao,
       COALESCE(sm.sub_ordem, 999) AS sub_ordem,
       m.mes,
       COALESCE(r.valor,0)::numeric AS realizado,
       COALESCE(o.valor,0)::numeric AS orcado
FROM linhas l
JOIN combo c ON c.dre_linha_id=l.id
CROSS JOIN meses m
LEFT JOIN sub_meta sm ON sm.dre_linha_id=c.dre_linha_id AND sm.sub_codigo IS NOT DISTINCT FROM c.sub_codigo
LEFT JOIN realizado_ms r ON r.dre_linha_id=c.dre_linha_id AND r.sub_codigo IS NOT DISTINCT FROM c.sub_codigo AND r.mes=m.mes
LEFT JOIN orcado_ms o ON o.dre_linha_id=c.dre_linha_id AND o.sub_codigo IS NOT DISTINCT FROM c.sub_codigo AND o.mes=m.mes
ORDER BY l.ordem, c.sub_codigo NULLS LAST, m.mes;
$$;

-- 5) Repromover orçamento p/ popular sub_codigo (2025/2026, empresas ativas)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, codigo FROM empresas WHERE ativa=true LOOP
    BEGIN
      PERFORM public.promover_mz50_orcamento(r.id, 2025);
      PERFORM public.promover_mz50_orcamento(r.id, 2026);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falhou promoção empresa %: %', r.codigo, SQLERRM;
    END;
  END LOOP;
END$$;
