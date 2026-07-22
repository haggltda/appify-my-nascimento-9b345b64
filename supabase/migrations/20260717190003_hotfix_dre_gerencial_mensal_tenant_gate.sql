-- FASE 0 (hotfix emergencial) — dre_gerencial_mensal
--
-- Achado: a RPC é SECURITY DEFINER e nunca checava nada antes de rodar —
-- ela lê dre_linhas/centros_custo/orcamento_contrato_linha (que exigem
-- has_role(admin) OR empresa_id=get_user_empresa(...) quando consultadas
-- direto) mas, como SECURITY DEFINER roda com o privilégio de quem criou a
-- função, ela contornava essa RLS por completo. Qualquer usuário
-- autenticado que soubesse/adivinhasse o UUID de outra empresa conseguia
-- puxar o DRE Gerencial completo dela.
--
-- Esta tela (DREGerencial.tsx, /app/controladoria/dre-gerencial) é usada
-- ativamente hoje. Em vez de já trocar para o gate por menu (que exigiria
-- ter certeza de que todo mundo que usa a tela já tem o código de menu
-- concedido, o que não dá pra garantir sem acesso ao banco em produção),
-- aplicamos aqui o mesmo critério de empresa que as tabelas de origem já
-- exigem — fecha o vazamento sem mudar quem hoje consegue ver o quê. Isso
-- é consistente com as decisões já tomadas: este ajuste é temporário e
-- será substituído pelo gate unificado (can_access) na Fase 3, quando o
-- módulo Controladoria inteiro passar pelo mesmo tratamento.

CREATE OR REPLACE FUNCTION public.dre_gerencial_mensal(_empresa_id uuid, _ano integer, _versao_obz uuid DEFAULT NULL::uuid)
 RETURNS TABLE(dre_linha_id uuid, codigo text, descricao text, natureza text, ordem integer, mes integer, realizado numeric, orcado numeric, variacao numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH auth_gate AS (
  SELECT public.user_can_see_empresa(_empresa_id) AS ok
),
emp AS (SELECT id, codigo FROM public.empresas WHERE id = _empresa_id),
meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas WHERE ativo = true AND codigo LIKE 'L%'
    AND (empresa_id = _empresa_id OR empresa_id IS NULL)
),
cc_tipo AS (
  -- mapa nome -> tipo (pega o primeiro tipo encontrado por nome para a empresa)
  SELECT DISTINCT ON (UPPER(TRIM(nome)))
         UPPER(TRIM(nome)) AS nome_norm, tipo::text AS tipo
  FROM public.centros_custo
  WHERE empresa_id = _empresa_id OR empresa_id IS NULL
  ORDER BY UPPER(TRIM(nome)),
           CASE tipo::text WHEN 'socios' THEN 1 WHEN 'adm' THEN 2 ELSE 3 END
),
partidas AS (
  SELECT EXTRACT(MONTH FROM NULLIF(p.data_competencia,'')::date)::int AS mes,
    CASE
      -- Override por tipo de CC: Sócios sempre vão para L12S
      WHEN ct.tipo = 'socios' THEN 'L12S'
      -- Override por tipo de CC: CC Administrativo com contas de EPI/uniforme/material → L08
      WHEN ct.tipo = 'adm' AND (
           COALESCE(p.conta_debito_codigo,'') LIKE '04.1.3.02.021%'
        OR COALESCE(p.conta_debito_codigo,'') LIKE '04.1.3.02.022%'
        OR COALESCE(p.conta_debito_codigo,'') LIKE '04.1.1%'
      ) THEN 'L08'
      WHEN p.classificacao_gerencial='RECEITA' AND COALESCE(p.conta_credito_codigo,'') LIKE '03%' THEN 'L01'
      WHEN p.classificacao_gerencial='RECEITA' AND COALESCE(p.conta_debito_codigo,'') LIKE '03%' THEN 'L02'
      WHEN p.classificacao_gerencial='CUSTO' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.1.3.02%' THEN 'L04'
      WHEN p.classificacao_gerencial='CUSTO' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.1.3.03%' THEN 'L05'
      WHEN p.classificacao_gerencial='DESPESA' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.1.02%' THEN 'L07'
      WHEN p.classificacao_gerencial='DESPESA' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.1.03%' THEN 'L08'
      WHEN p.classificacao_gerencial='DESPESA' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.2%' THEN 'L09'
      WHEN p.classificacao_gerencial='DESPESA' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.3%' THEN 'L10'
      WHEN COALESCE(p.conta_credito_codigo,'') LIKE '04.2.3%' OR COALESCE(p.conta_credito_codigo,'') LIKE '04.3%' THEN 'L11'
      WHEN p.classificacao_gerencial='DESPESA' AND COALESCE(p.conta_debito_codigo,'') LIKE '04.2.4%' THEN 'L12'
      ELSE NULL END AS linha_codigo,
    CASE
      WHEN p.classificacao_gerencial='RECEITA' AND COALESCE(p.conta_credito_codigo,'') LIKE '03%'
        THEN COALESCE(NULLIF(p.valor_credito,'')::numeric, 0)
      WHEN COALESCE(p.conta_credito_codigo,'') LIKE '04.2.3%' OR COALESCE(p.conta_credito_codigo,'') LIKE '04.3%'
        THEN COALESCE(NULLIF(p.valor_credito,'')::numeric, 0)
      ELSE -COALESCE(NULLIF(p.valor_debito,'')::numeric, 0)
    END AS valor
  FROM public.mz_31_fato_partidas_dobradas p
  JOIN emp e ON e.codigo = p.empresa
  LEFT JOIN cc_tipo ct ON ct.nome_norm = UPPER(TRIM(COALESCE(p.centro_custo,'')))
  WHERE NULLIF(p.data_competencia,'') IS NOT NULL
    AND EXTRACT(YEAR FROM NULLIF(p.data_competencia,'')::date) = _ano
    AND UPPER(COALESCE(p.impacta_dre,'')) IN ('SIM','S','TRUE','1','T')
),
realizado_base AS (SELECT linha_codigo, mes, SUM(valor) AS valor FROM partidas WHERE linha_codigo IS NOT NULL GROUP BY linha_codigo, mes),
realizado_calc AS (
  SELECT linha_codigo, mes, valor FROM realizado_base
  UNION ALL SELECT 'L03', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02') GROUP BY mes
  UNION ALL SELECT 'L06', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02','L04','L05') GROUP BY mes
  UNION ALL SELECT 'L13', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12','L12S') GROUP BY mes
  UNION ALL SELECT 'L14', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12','L12S') GROUP BY mes
),
realizado_m AS (SELECT l.id AS dre_linha_id, rc.mes, SUM(rc.valor) AS valor FROM realizado_calc rc JOIN linhas l ON l.codigo=rc.linha_codigo GROUP BY l.id, rc.mes),
orcado_base AS (
  SELECT dl.codigo AS linha_codigo, EXTRACT(MONTH FROM ocl.competencia)::int AS mes,
         CASE WHEN dl.natureza::text='receita' THEN SUM(ocl.valor_previsto) ELSE -SUM(ocl.valor_previsto) END AS valor
  FROM public.orcamento_contrato_linha ocl
  JOIN public.dre_linhas dl ON dl.id = ocl.dre_linha_id
  WHERE ocl.empresa_id = _empresa_id AND EXTRACT(YEAR FROM ocl.competencia) = _ano
  GROUP BY dl.codigo, dl.natureza, EXTRACT(MONTH FROM ocl.competencia)
),
orcado_calc AS (
  SELECT linha_codigo, mes, valor FROM orcado_base
  UNION ALL SELECT 'L03', mes, SUM(valor) FROM orcado_base WHERE linha_codigo IN ('L01','L02') GROUP BY mes
  UNION ALL SELECT 'L06', mes, SUM(valor) FROM orcado_base WHERE linha_codigo IN ('L01','L02','L04','L05') GROUP BY mes
  UNION ALL SELECT 'L13', mes, SUM(valor) FROM orcado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12','L12S') GROUP BY mes
  UNION ALL SELECT 'L14', mes, SUM(valor) FROM orcado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12','L12S') GROUP BY mes
),
orcado_m AS (SELECT l.id AS dre_linha_id, oc.mes, SUM(oc.valor) AS valor FROM orcado_calc oc JOIN linhas l ON l.codigo=oc.linha_codigo GROUP BY l.id, oc.mes)
SELECT l.id, l.codigo, l.descricao, l.natureza, l.ordem, m.mes,
       COALESCE(r.valor,0)::numeric,
       COALESCE(o.valor,0)::numeric,
       (COALESCE(r.valor,0) - COALESCE(o.valor,0))::numeric
FROM linhas l CROSS JOIN meses m
LEFT JOIN realizado_m r ON r.dre_linha_id=l.id AND r.mes=m.mes
LEFT JOIN orcado_m o ON o.dre_linha_id=l.id AND o.mes=m.mes
WHERE (SELECT ok FROM auth_gate)
ORDER BY l.ordem, l.codigo, m.mes;
$function$;

-- Rollback: reaplicar a versão de 20260521024256_9b047f5a-e92f-45a8-a8cd-bfa2aee76978.sql
-- (idêntica a esta, só sem o CTE auth_gate e o WHERE final) — reabre o
-- bypass entre empresas, só usar em emergência.

NOTIFY pgrst, 'reload schema';
