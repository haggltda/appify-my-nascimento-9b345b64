
-- 1) Enum: adicionar 'socios'
ALTER TYPE public.cc_tipo ADD VALUE IF NOT EXISTS 'socios';

-- 2) Reordenar linhas e inserir L12S
UPDATE public.dre_linhas SET ordem=15 WHERE codigo='L14';
UPDATE public.dre_linhas SET ordem=14 WHERE codigo='L13';
UPDATE public.dre_linhas SET ordem=13 WHERE codigo='L12';

INSERT INTO public.dre_linhas (codigo, descricao, natureza, ordem, ativo, empresa_id)
SELECT 'L12S', '(-) Despesas Não Operacionais (Sócios)', 'despesa', 12, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.dre_linhas WHERE codigo='L12S');

-- 3) dre_sublinha_dict: catálogo completo + L12S
CREATE OR REPLACE FUNCTION public.dre_sublinha_dict()
RETURNS TABLE(linha_codigo text, sub_codigo text, sub_descricao text, sub_ordem integer)
LANGUAGE sql IMMUTABLE
AS $function$
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
    ('L08','8.15', 'EPIs/materiais (administrativo)', 15),
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
    ('L12','12.9', 'Outras', 9),
    ('L12S','12S.1','Antonio (sócio)', 1),
    ('L12S','12S.2','Guiomar (sócio)', 2),
    ('L12S','12S.3','Senilton (sócio)', 3),
    ('L12S','12S.4','Helena (sócia)', 4),
    ('L12S','12S.5','Carlos Eduardo (sócio)', 5),
    ('L12S','12S.9','Outros — sócios', 9)
  ) AS t(linha_codigo, sub_codigo, sub_descricao, sub_ordem);
$function$;

-- 4) dre_gerencial_competencia com override por CC
CREATE OR REPLACE FUNCTION public.dre_gerencial_competencia(_empresa_id uuid, _ano integer, _versao_obz uuid DEFAULT NULL::uuid)
RETURNS TABLE(dre_linha_id uuid, codigo text, descricao text, natureza text, ordem integer, mes integer, realizado numeric, orcado numeric, variacao numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas
  WHERE ativo=true AND (empresa_id=_empresa_id OR empresa_id IS NULL)
),
ids AS (
  SELECT
    (SELECT id FROM public.dre_linhas WHERE codigo='L08' AND (empresa_id=_empresa_id OR empresa_id IS NULL) LIMIT 1) AS l08,
    (SELECT id FROM public.dre_linhas WHERE codigo='L12S' AND (empresa_id=_empresa_id OR empresa_id IS NULL) LIMIT 1) AS l12s
),
versao AS (
  SELECT id FROM public.obz_versoes
  WHERE empresa_id=_empresa_id AND ano=_ano
    AND ((_versao_obz IS NOT NULL AND id=_versao_obz)
         OR (_versao_obz IS NULL AND status='aprovada'))
  ORDER BY revisao DESC, versao DESC, updated_at DESC LIMIT 1
),
partidas AS (
  SELECT
    CASE
      WHEN cct.tipo::text='socios' THEN (SELECT l12s FROM ids)
      WHEN cct.tipo::text='adm' AND (
           cc.classificacao LIKE '04.1.3.02.021%'
        OR cc.classificacao LIKE '04.1.3.02.022%'
        OR cc.classificacao LIKE '04.1.1%'
      ) THEN (SELECT l08 FROM ids)
      ELSE cc.dre_linha_id
    END AS dre_linha_id,
    EXTRACT(MONTH FROM COALESCE(lc.competencia, lc.data_lancamento))::int AS mes,
    CASE WHEN cc.natureza::text IN ('receita','passivo','patrimonio_liquido')
         THEN CASE WHEN p.dc='C' THEN p.valor ELSE -p.valor END
         ELSE CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END
    END AS valor
  FROM public.lancamento_partida p
  JOIN public.lancamento_contabil lc ON lc.id=p.lancamento_id
  JOIN public.conta_contabil cc ON cc.id=p.conta_contabil_id
  LEFT JOIN public.centros_custo cct ON cct.id=p.centro_custo_id
  WHERE lc.empresa_id=_empresa_id AND lc.status='efetivado'
    AND cc.dre_linha_id IS NOT NULL
    AND EXTRACT(YEAR FROM COALESCE(lc.competencia, lc.data_lancamento))=_ano
),
realizado_m AS (SELECT dre_linha_id, mes, SUM(valor) AS valor FROM partidas WHERE dre_linha_id IS NOT NULL GROUP BY dre_linha_id, mes),
orcado_m AS (
  SELECT v.dre_linha_id, per.mes, SUM(v.valor) AS valor
  FROM public.obz_valores v JOIN public.obz_periodos per ON per.id=v.periodo_id
  WHERE v.versao_id=(SELECT id FROM versao) GROUP BY v.dre_linha_id, per.mes
)
SELECT l.id, l.codigo, l.descricao, l.natureza, l.ordem, m.mes,
       COALESCE(r.valor,0)::numeric,
       COALESCE(o.valor,0)::numeric,
       (COALESCE(r.valor,0)-COALESCE(o.valor,0))::numeric
FROM linhas l CROSS JOIN meses m
LEFT JOIN realizado_m r ON r.dre_linha_id=l.id AND r.mes=m.mes
LEFT JOIN orcado_m o ON o.dre_linha_id=l.id AND o.mes=m.mes
ORDER BY l.ordem, l.codigo, m.mes;
$function$;

-- 5) dre_gerencial_competencia_detalhado com override por CC
CREATE OR REPLACE FUNCTION public.dre_gerencial_competencia_detalhado(_empresa_id uuid, _ano integer, _versao_obz uuid DEFAULT NULL::uuid)
RETURNS TABLE(dre_linha_id uuid, linha_codigo text, linha_descricao text, linha_natureza text, linha_ordem integer, sub_codigo text, sub_descricao text, sub_ordem integer, mes integer, realizado numeric, orcado numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas
  WHERE ativo=true AND (empresa_id=_empresa_id OR empresa_id IS NULL)
    AND codigo LIKE 'L%'
),
ids AS (
  SELECT
    (SELECT id FROM public.dre_linhas WHERE codigo='L08' AND (empresa_id=_empresa_id OR empresa_id IS NULL) LIMIT 1) AS l08,
    (SELECT id FROM public.dre_linhas WHERE codigo='L12S' AND (empresa_id=_empresa_id OR empresa_id IS NULL) LIMIT 1) AS l12s
),
socio_sub AS (
  SELECT id AS cc_id,
    CASE
      WHEN lower(nome) LIKE '%antonio%' THEN '12S.1'
      WHEN lower(nome) LIKE '%guiomar%' THEN '12S.2'
      WHEN lower(nome) LIKE '%senilton%' THEN '12S.3'
      WHEN lower(nome) LIKE '%helena%' THEN '12S.4'
      WHEN lower(nome) LIKE '%carlos%eduardo%' OR lower(nome) LIKE '%cadu%' THEN '12S.5'
      ELSE '12S.9'
    END AS sub_codigo
  FROM public.centros_custo WHERE tipo::text='socios'
),
partidas AS (
  SELECT
    CASE
      WHEN cct.tipo::text='socios' THEN (SELECT l12s FROM ids)
      WHEN cct.tipo::text='adm' AND (
           cc.classificacao LIKE '04.1.3.02.021%'
        OR cc.classificacao LIKE '04.1.3.02.022%'
        OR cc.classificacao LIKE '04.1.1%'
      ) THEN (SELECT l08 FROM ids)
      ELSE cc.dre_linha_id
    END AS dre_linha_id,
    CASE
      WHEN cct.tipo::text='socios' THEN COALESCE((SELECT sub_codigo FROM socio_sub ss WHERE ss.cc_id=cct.id), '12S.9')
      WHEN cct.tipo::text='adm' AND cc.classificacao LIKE '04.1.3.02.021%' THEN '8.15'
      WHEN cct.tipo::text='adm' AND cc.classificacao LIKE '04.1.3.02.022%' THEN '8.15'
      WHEN cct.tipo::text='adm' AND cc.classificacao LIKE '04.1.1%' THEN '8.3'
      ELSE lbl.sub_codigo
    END AS sub_codigo,
    EXTRACT(MONTH FROM COALESCE(lc.competencia, lc.data_lancamento))::int AS mes,
    CASE WHEN cc.natureza::text IN ('receita','passivo','patrimonio_liquido')
         THEN CASE WHEN p.dc='C' THEN p.valor ELSE -p.valor END
         ELSE CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END
    END AS valor
  FROM public.lancamento_partida p
  JOIN public.lancamento_contabil lc ON lc.id=p.lancamento_id
  JOIN public.conta_contabil cc ON cc.id=p.conta_contabil_id
  LEFT JOIN public.centros_custo cct ON cct.id=p.centro_custo_id
  LEFT JOIN LATERAL public.dre_sublinha_label(cc.classificacao, cc.descricao) lbl ON true
  WHERE lc.empresa_id=_empresa_id AND lc.status='efetivado'
    AND cc.dre_linha_id IS NOT NULL
    AND EXTRACT(YEAR FROM COALESCE(lc.competencia, lc.data_lancamento))=_ano
),
realizado_ms AS (
  SELECT dre_linha_id, sub_codigo, mes, SUM(valor) valor
  FROM partidas WHERE dre_linha_id IS NOT NULL GROUP BY dre_linha_id, sub_codigo, mes
),
orcado_partidas AS (
  SELECT
    CASE
      WHEN cct.tipo::text='socios' THEN (SELECT l12s FROM ids)
      ELSE v.dre_linha_id
    END AS dre_linha_id,
    CASE
      WHEN cct.tipo::text='socios' THEN COALESCE((SELECT sub_codigo FROM socio_sub ss WHERE ss.cc_id=cct.id), '12S.9')
      ELSE v.sub_codigo
    END AS sub_codigo,
    EXTRACT(MONTH FROM v.competencia)::int AS mes,
    v.valor_previsto AS valor
  FROM public.orcamento_contrato_linha v
  JOIN public.orcamento_contrato oc ON oc.id=v.orcamento_contrato_id
  JOIN public.orcamento_ciclo cic ON cic.id=oc.ciclo_id
  LEFT JOIN public.centros_custo cct ON cct.id=v.centro_custo_id
  WHERE v.empresa_id=_empresa_id AND cic.ano=_ano
),
orcado_ms AS (
  SELECT dre_linha_id, sub_codigo, mes, SUM(valor) valor
  FROM orcado_partidas WHERE dre_linha_id IS NOT NULL GROUP BY dre_linha_id, sub_codigo, mes
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
$function$;
