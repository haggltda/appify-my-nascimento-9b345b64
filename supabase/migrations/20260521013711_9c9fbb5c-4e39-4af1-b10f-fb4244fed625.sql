
-- 1) Apaga linhas órfãs (sem sub_codigo) importadas do MZ50, para evitar duplicidade
DELETE FROM public.orcamento_contrato_linha
WHERE sub_codigo IS NULL
  AND source='manual'
  AND memoria_calculo='Importado de mz_50';

-- 2) Catálogo de sublinhas (dicionário)
CREATE OR REPLACE FUNCTION public.dre_sublinha_dict()
RETURNS TABLE(linha_codigo text, sub_codigo text, sub_descricao text, sub_ordem int)
LANGUAGE sql IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('L01','1.1',  'Serviços prestados', 1),
    ('L02','2.1',  'ISSQN', 1),
    ('L02','2.2',  'PIS', 2),
    ('L02','2.3',  'COFINS', 3),
    ('L02','2.4',  'Simples Nacional', 4),
    ('L02','2.9',  'Outras deduções', 9),
    ('L04','4.1',  'Salários operacionais', 1),
    ('L04','4.2',  '13º salário operacional', 2),
    ('L04','4.3',  'Férias e abono', 3),
    ('L04','4.4',  'Aviso prévio / rescisões', 4),
    ('L04','4.5',  'Multa rescisória FGTS', 5),
    ('L04','4.6',  'FGTS operacional', 6),
    ('L04','4.7',  'INSS / CPP operacional', 7),
    ('L04','4.8',  'Vale alimentação', 8),
    ('L04','4.9',  'Vale transporte', 9),
    ('L04','4.10', 'Saúde ocupacional', 10),
    ('L04','4.11', 'Seguro de vida', 11),
    ('L04','4.99', 'Outros custos com pessoal', 99),
    ('L05','5.1',  'Uniformes', 1),
    ('L05','5.2',  'EPIs', 2),
    ('L05','5.3',  'Bens não imobilizáveis de pequeno valor', 3),
    ('L05','5.4',  'Manutenção bens, equipamentos e imóveis', 4),
    ('L05','5.6',  'Custo das mercadorias vendidas', 6),
    ('L07','7.1',  'Salários administrativos', 1),
    ('L07','7.2',  'Comissões sobre vendas', 2),
    ('L07','7.9',  'Outras despesas com pessoal adm', 9),
    ('L08','8.1',  'Aluguel e condomínio', 1),
    ('L08','8.2',  'Água, energia, telefone, internet', 2),
    ('L08','8.3',  'Material de escritório e uso/consumo', 3),
    ('L08','8.4',  'Copa e cozinha', 4),
    ('L08','8.5',  'Combustíveis, veículos, pedágios, estacionamento', 5),
    ('L08','8.6',  'Viagens, deslocamento e estadias', 6),
    ('L08','8.7',  'Honorários contábeis e serviços PJ', 7),
    ('L08','8.8',  'Processamento de dados / sistemas', 8),
    ('L08','8.9',  'Seguros e seguro-garantia', 9),
    ('L08','8.10', 'Cartórios, custas e tabelionatos', 10),
    ('L08','8.11', 'Contribuição sindical / anuidades', 11),
    ('L08','8.12', 'Cursos, congressos e feiras', 12),
    ('L08','8.13', 'Depreciações e amortizações', 13),
    ('L08','8.14', 'Fretes, correios e malotes', 14),
    ('L08','8.99', 'Outras despesas administrativas', 99),
    ('L09','9.1',  'Serviços terceiros / impostos comerciais', 1),
    ('L10','10.1', 'Juros pagos / encargos financiamentos', 1),
    ('L10','10.2', 'Despesas bancárias e IOF', 2),
    ('L10','10.3', 'Descontos concedidos', 3),
    ('L10','10.4', 'Multas e juros s/ tributos', 4),
    ('L10','10.9', 'Outras despesas financeiras', 9),
    ('L11','11.1', 'Rendimentos de aplicação', 1),
    ('L11','11.2', 'Juros e descontos obtidos', 2),
    ('L11','11.3', 'Outras receitas / atualizações', 3),
    ('L12','12.1', 'IPTU', 1),
    ('L12','12.2', 'IPVA', 2),
    ('L12','12.3', 'IRRF (exclusivo na fonte)', 3),
    ('L12','12.4', 'Multas contratuais', 4),
    ('L12','12.9', 'Outras', 9)
  ) AS t(linha_codigo, sub_codigo, sub_descricao, sub_ordem);
$$;

-- 3) RPC detalhada usando o dicionário
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
         lbl.sub_codigo,
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
  SELECT dre_linha_id, sub_codigo, mes, SUM(valor) valor
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
)
SELECT l.id, l.codigo, l.descricao, l.natureza, l.ordem,
       c.sub_codigo,
       COALESCE(d.sub_descricao, c.sub_codigo, '— sem classificação —') AS sub_descricao,
       COALESCE(d.sub_ordem, 999) AS sub_ordem,
       m.mes,
       COALESCE(r.valor,0)::numeric AS realizado,
       COALESCE(o.valor,0)::numeric AS orcado
FROM linhas l
JOIN combo c ON c.dre_linha_id=l.id
CROSS JOIN meses m
LEFT JOIN public.dre_sublinha_dict() d ON d.linha_codigo=l.codigo AND d.sub_codigo=c.sub_codigo
LEFT JOIN realizado_ms r ON r.dre_linha_id=c.dre_linha_id AND r.sub_codigo IS NOT DISTINCT FROM c.sub_codigo AND r.mes=m.mes
LEFT JOIN orcado_ms o ON o.dre_linha_id=c.dre_linha_id AND o.sub_codigo IS NOT DISTINCT FROM c.sub_codigo AND o.mes=m.mes
ORDER BY l.ordem, COALESCE(d.sub_ordem, 999), c.sub_codigo NULLS LAST, m.mes;
$$;

-- 4) Repromover orçamento p/ todas as empresas ativas (2025 e 2026)
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
