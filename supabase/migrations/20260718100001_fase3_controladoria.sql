-- FASE 3 (lote 1/6 — Controladoria) — remove has_role(admin)/empresa da RLS
--
-- Padrão: troca a cláusula inteira (empresa_id=get_user_empresa(...) OR
-- has_role(admin) / user_pode_atuar_empresa(...) / user_can_see_empresa(...))
-- por can_access(auth.uid(), '<menu_codigo>', '<acao>') — sem bypass de
-- cargo nenhum, nem para admin. Admin passa a precisar do perfil de módulo
-- (ou individual) igual qualquer um, exatamente como o dono do produto pediu.
--
-- Mapeamento de ação: SELECT→visualizar, INSERT→incluir, UPDATE→alterar,
-- DELETE→excluir. Nomes de policy confirmados por grep nas migrations de
-- origem (não adivinhados) antes de escrever este arquivo.
--
-- Fora deste lote, de propósito: `conta_contabil` (é do módulo Contábil,
-- entra no lote 3) e `comite`/`area`/`setor` (Estrutura Organizacional) —
-- essas 3 ficam para uma migration própria, porque Plano de Ações lê elas
-- direto do client (useComitesMap/useMembrosComite) e travar o SELECT
-- quebraria os dropdowns de comitê/área/setor de quem não tiver o menu de
-- Controladoria. Avisar o usuário antes de fechar essa também.

-- ── empresas ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS empresas_select_scoped ON public.empresas;
CREATE POLICY empresas_select_scoped ON public.empresas FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'empresas', 'visualizar'::app_acao));

DROP POLICY IF EXISTS empresas_admin_ins ON public.empresas;
CREATE POLICY empresas_admin_ins ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'empresas', 'incluir'::app_acao));

DROP POLICY IF EXISTS empresas_admin_upd ON public.empresas;
CREATE POLICY empresas_admin_upd ON public.empresas FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'empresas', 'alterar'::app_acao));

DROP POLICY IF EXISTS empresas_admin_del ON public.empresas;
CREATE POLICY empresas_admin_del ON public.empresas FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'empresas', 'excluir'::app_acao));

-- ── centros_custo ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cc_select ON public.centros_custo;
CREATE POLICY cc_select ON public.centros_custo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cc', 'visualizar'::app_acao));
DROP POLICY IF EXISTS cc_insert ON public.centros_custo;
CREATE POLICY cc_insert ON public.centros_custo FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'cc', 'incluir'::app_acao));
DROP POLICY IF EXISTS cc_update ON public.centros_custo;
CREATE POLICY cc_update ON public.centros_custo FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'cc', 'alterar'::app_acao));
DROP POLICY IF EXISTS cc_delete ON public.centros_custo;
CREATE POLICY cc_delete ON public.centros_custo FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'cc', 'excluir'::app_acao));

-- ── dre_linhas ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS dre_select ON public.dre_linhas;
CREATE POLICY dre_select ON public.dre_linhas FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'dre', 'visualizar'::app_acao));
DROP POLICY IF EXISTS dre_insert ON public.dre_linhas;
CREATE POLICY dre_insert ON public.dre_linhas FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'dre', 'incluir'::app_acao));
DROP POLICY IF EXISTS dre_update ON public.dre_linhas;
CREATE POLICY dre_update ON public.dre_linhas FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'dre', 'alterar'::app_acao));
DROP POLICY IF EXISTS dre_delete ON public.dre_linhas;
CREATE POLICY dre_delete ON public.dre_linhas FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'dre', 'excluir'::app_acao));

-- ── classificadores / classificador_valores ─────────────────────────────
-- (confirmado sem consumidor real no front — Classificadores.tsx usa dado
-- estático — mas gateado igual pra consistência, já que o custo é zero)
DROP POLICY IF EXISTS clas_select ON public.classificadores;
CREATE POLICY clas_select ON public.classificadores FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'classificadores', 'visualizar'::app_acao));
DROP POLICY IF EXISTS clas_insert ON public.classificadores;
CREATE POLICY clas_insert ON public.classificadores FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'classificadores', 'incluir'::app_acao));
DROP POLICY IF EXISTS clas_update ON public.classificadores;
CREATE POLICY clas_update ON public.classificadores FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'classificadores', 'alterar'::app_acao));
DROP POLICY IF EXISTS clas_delete ON public.classificadores;
CREATE POLICY clas_delete ON public.classificadores FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'classificadores', 'excluir'::app_acao));

DROP POLICY IF EXISTS clasval_select ON public.classificador_valores;
CREATE POLICY clasval_select ON public.classificador_valores FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'classificadores', 'visualizar'::app_acao));
DROP POLICY IF EXISTS clasval_insert ON public.classificador_valores;
CREATE POLICY clasval_insert ON public.classificador_valores FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'classificadores', 'incluir'::app_acao));
DROP POLICY IF EXISTS clasval_update ON public.classificador_valores;
CREATE POLICY clasval_update ON public.classificador_valores FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'classificadores', 'alterar'::app_acao));
DROP POLICY IF EXISTS clasval_delete ON public.classificador_valores;
CREATE POLICY clasval_delete ON public.classificador_valores FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'classificadores', 'excluir'::app_acao));

-- ── obz_versoes (lido por OBZVersoes.tsx E DREGerencial.tsx) ────────────
DROP POLICY IF EXISTS obzv_select ON public.obz_versoes;
CREATE POLICY obzv_select ON public.obz_versoes FOR SELECT TO authenticated
  USING (
    public.can_access(auth.uid(), 'obz-versoes', 'visualizar'::app_acao)
    OR public.can_access(auth.uid(), 'dre-gerencial', 'visualizar'::app_acao)
  );
DROP POLICY IF EXISTS obzv_insert ON public.obz_versoes;
CREATE POLICY obzv_insert ON public.obz_versoes FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'obz-versoes', 'incluir'::app_acao));
DROP POLICY IF EXISTS obzv_update ON public.obz_versoes;
CREATE POLICY obzv_update ON public.obz_versoes FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'obz-versoes', 'alterar'::app_acao));
DROP POLICY IF EXISTS obzv_delete ON public.obz_versoes;
CREATE POLICY obzv_delete ON public.obz_versoes FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'obz-versoes', 'excluir'::app_acao));

-- ── obz_periodos / obz_valores (só OBZVersoes.tsx) ──────────────────────
DROP POLICY IF EXISTS obzp_select ON public.obz_periodos;
CREATE POLICY obzp_select ON public.obz_periodos FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'obz-versoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS obzp_write ON public.obz_periodos;
CREATE POLICY obzp_write ON public.obz_periodos FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'obz-versoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'obz-versoes', 'alterar'::app_acao));

DROP POLICY IF EXISTS obzval_select ON public.obz_valores;
CREATE POLICY obzval_select ON public.obz_valores FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'obz-versoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS obzval_write ON public.obz_valores;
CREATE POLICY obzval_write ON public.obz_valores FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'obz-versoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'obz-versoes', 'alterar'::app_acao));

-- ── parametro_orcamento / orcamento_ciclo / orcamento_contrato /
--    orcamento_contrato_linha / orcamento_contrato_linha_audit ──────────
DROP POLICY IF EXISTS po_select ON public.parametro_orcamento;
CREATE POLICY po_select ON public.parametro_orcamento FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS po_write ON public.parametro_orcamento;
CREATE POLICY po_write ON public.parametro_orcamento FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

DROP POLICY IF EXISTS oc_ciclo_select ON public.orcamento_ciclo;
CREATE POLICY oc_ciclo_select ON public.orcamento_ciclo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS oc_ciclo_insert ON public.orcamento_ciclo;
CREATE POLICY oc_ciclo_insert ON public.orcamento_ciclo FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao));
DROP POLICY IF EXISTS oc_ciclo_update ON public.orcamento_ciclo;
CREATE POLICY oc_ciclo_update ON public.orcamento_ciclo FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

DROP POLICY IF EXISTS oc_contrato_select ON public.orcamento_contrato;
CREATE POLICY oc_contrato_select ON public.orcamento_contrato FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS oc_contrato_insert ON public.orcamento_contrato;
CREATE POLICY oc_contrato_insert ON public.orcamento_contrato FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao));
DROP POLICY IF EXISTS oc_contrato_update ON public.orcamento_contrato;
CREATE POLICY oc_contrato_update ON public.orcamento_contrato FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

DROP POLICY IF EXISTS ocl_select ON public.orcamento_contrato_linha;
CREATE POLICY ocl_select ON public.orcamento_contrato_linha FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS ocl_insert ON public.orcamento_contrato_linha;
CREATE POLICY ocl_insert ON public.orcamento_contrato_linha FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao));
DROP POLICY IF EXISTS ocl_update ON public.orcamento_contrato_linha;
CREATE POLICY ocl_update ON public.orcamento_contrato_linha FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));
DROP POLICY IF EXISTS ocl_delete ON public.orcamento_contrato_linha;
CREATE POLICY ocl_delete ON public.orcamento_contrato_linha FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'excluir'::app_acao));

DROP POLICY IF EXISTS ocla_select ON public.orcamento_contrato_linha_audit;
CREATE POLICY ocla_select ON public.orcamento_contrato_linha_audit FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
-- ocla_insert (WITH CHECK true) não é tocada — é log de auditoria gravado
-- automaticamente por trigger/RPC, não é ação de usuário navegando a tela.

-- ── dre_gerencial_mensal: troca o patch provisório de Fase 0
--    (user_can_see_empresa) pelo gate unificado, igual o resto do módulo.
CREATE OR REPLACE FUNCTION public.dre_gerencial_mensal(_empresa_id uuid, _ano integer, _versao_obz uuid DEFAULT NULL::uuid)
 RETURNS TABLE(dre_linha_id uuid, codigo text, descricao text, natureza text, ordem integer, mes integer, realizado numeric, orcado numeric, variacao numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH auth_gate AS (
  SELECT public.can_access(auth.uid(), 'dre-gerencial', 'visualizar'::public.app_acao) AS ok
),
emp AS (SELECT id, codigo FROM public.empresas WHERE id = _empresa_id),
meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas WHERE ativo = true AND codigo LIKE 'L%'
    AND (empresa_id = _empresa_id OR empresa_id IS NULL)
),
cc_tipo AS (
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
      WHEN ct.tipo = 'socios' THEN 'L12S'
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

-- Rollback: reaplicar as policies/versão de dre_gerencial_mensal das
-- migrations de origem citadas nos comentários acima (uma por uma) — todas
-- são DROP POLICY + CREATE POLICY / CREATE OR REPLACE FUNCTION, reversíveis
-- reaplicando o texto anterior.

NOTIFY pgrst, 'reload schema';
