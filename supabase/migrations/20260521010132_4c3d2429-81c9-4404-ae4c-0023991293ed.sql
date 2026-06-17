
CREATE TABLE IF NOT EXISTS public.orcamento_contrato_linha_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linha_id uuid, orcamento_contrato_id uuid, empresa_id uuid,
  competencia date, dre_linha_id uuid,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  valor_anterior numeric, valor_novo numeric,
  alterado_por uuid, alterado_em timestamptz NOT NULL DEFAULT now(),
  memoria_calculo text
);
CREATE INDEX IF NOT EXISTS ix_ocla_linha ON public.orcamento_contrato_linha_audit(linha_id);
CREATE INDEX IF NOT EXISTS ix_ocla_emp ON public.orcamento_contrato_linha_audit(empresa_id, alterado_em DESC);
ALTER TABLE public.orcamento_contrato_linha_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ocla_select ON public.orcamento_contrato_linha_audit;
CREATE POLICY ocla_select ON public.orcamento_contrato_linha_audit FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS ocla_insert ON public.orcamento_contrato_linha_audit;
CREATE POLICY ocla_insert ON public.orcamento_contrato_linha_audit FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_orcamento_contrato_linha_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (TG_OP='INSERT') THEN
    INSERT INTO public.orcamento_contrato_linha_audit (linha_id,orcamento_contrato_id,empresa_id,competencia,dre_linha_id,operation,valor_anterior,valor_novo,alterado_por,memoria_calculo)
    VALUES (NEW.id,NEW.orcamento_contrato_id,NEW.empresa_id,NEW.competencia,NEW.dre_linha_id,'INSERT',NULL,NEW.valor_previsto,auth.uid(),NEW.memoria_calculo);
    RETURN NEW;
  ELSIF (TG_OP='UPDATE') THEN
    IF (OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto OR OLD.locked IS DISTINCT FROM NEW.locked) THEN
      INSERT INTO public.orcamento_contrato_linha_audit (linha_id,orcamento_contrato_id,empresa_id,competencia,dre_linha_id,operation,valor_anterior,valor_novo,alterado_por,memoria_calculo)
      VALUES (NEW.id,NEW.orcamento_contrato_id,NEW.empresa_id,NEW.competencia,NEW.dre_linha_id,'UPDATE',OLD.valor_previsto,NEW.valor_previsto,auth.uid(),NEW.memoria_calculo);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP='DELETE') THEN
    INSERT INTO public.orcamento_contrato_linha_audit (linha_id,orcamento_contrato_id,empresa_id,competencia,dre_linha_id,operation,valor_anterior,valor_novo,alterado_por,memoria_calculo)
    VALUES (OLD.id,OLD.orcamento_contrato_id,OLD.empresa_id,OLD.competencia,OLD.dre_linha_id,'DELETE',OLD.valor_previsto,NULL,auth.uid(),OLD.memoria_calculo);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_orcamento_contrato_linha_audit ON public.orcamento_contrato_linha;
CREATE TRIGGER trg_orcamento_contrato_linha_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_contrato_linha
  FOR EACH ROW EXECUTE FUNCTION public.tg_orcamento_contrato_linha_audit();

ALTER TABLE public.orcamento_contrato_linha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_ciclo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oc_ciclo_select ON public.orcamento_ciclo;
CREATE POLICY oc_ciclo_select ON public.orcamento_ciclo FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS oc_ciclo_insert ON public.orcamento_ciclo;
CREATE POLICY oc_ciclo_insert ON public.orcamento_ciclo FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS oc_ciclo_update ON public.orcamento_ciclo;
CREATE POLICY oc_ciclo_update ON public.orcamento_ciclo FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'controladoria'::app_role) OR has_role(auth.uid(),'diretor_adm'::app_role));

DROP POLICY IF EXISTS oc_contrato_select ON public.orcamento_contrato;
CREATE POLICY oc_contrato_select ON public.orcamento_contrato FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS oc_contrato_insert ON public.orcamento_contrato;
CREATE POLICY oc_contrato_insert ON public.orcamento_contrato FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS oc_contrato_update ON public.orcamento_contrato;
CREATE POLICY oc_contrato_update ON public.orcamento_contrato FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));

DROP POLICY IF EXISTS ocl_select ON public.orcamento_contrato_linha;
CREATE POLICY ocl_select ON public.orcamento_contrato_linha FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS ocl_insert ON public.orcamento_contrato_linha;
CREATE POLICY ocl_insert ON public.orcamento_contrato_linha FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS ocl_update ON public.orcamento_contrato_linha;
CREATE POLICY ocl_update ON public.orcamento_contrato_linha FOR UPDATE
  USING ((has_role(auth.uid(),'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), empresa_id)) AND locked = false);
DROP POLICY IF EXISTS ocl_delete ON public.orcamento_contrato_linha;
CREATE POLICY ocl_delete ON public.orcamento_contrato_linha FOR DELETE
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'controladoria'::app_role)) AND locked = false);

CREATE INDEX IF NOT EXISTS ix_ocl_orc_comp ON public.orcamento_contrato_linha(orcamento_contrato_id, competencia);
CREATE INDEX IF NOT EXISTS ix_ocl_emp_comp_dre ON public.orcamento_contrato_linha(empresa_id, competencia, dre_linha_id);

CREATE OR REPLACE FUNCTION public.resolver_dre_linha(_conta_codigo text, _classif text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _classif='RECEITA'  AND _conta_codigo LIKE '03%'         THEN 'L01'
    WHEN _classif='CUSTO'    AND _conta_codigo LIKE '04.1.3.02%'  THEN 'L04'
    WHEN _classif='CUSTO'    AND _conta_codigo LIKE '04.1.3.03%'  THEN 'L05'
    WHEN _classif='CUSTO'    AND _conta_codigo LIKE '04.1%'       THEN 'L04'
    WHEN _classif='DESPESA'  AND _conta_codigo LIKE '04.2.1.02%'  THEN 'L07'
    WHEN _classif='DESPESA'  AND _conta_codigo LIKE '04.2.1.03%'  THEN 'L08'
    WHEN _classif='DESPESA'  AND _conta_codigo LIKE '04.2.2%'     THEN 'L09'
    WHEN _classif='DESPESA'  AND _conta_codigo LIKE '04.2.3%'     THEN 'L10'
    WHEN _classif='DESPESA'  AND _conta_codigo LIKE '04.2.4%'     THEN 'L12'
    WHEN _classif='DESPESA'  AND _conta_codigo LIKE '04.3%'       THEN 'L11'
    ELSE NULL
  END;
$$;

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
    ON CONFLICT ON CONSTRAINT uq_ocl DO UPDATE
      SET valor_previsto = EXCLUDED.valor_previsto,
          memoria_calculo = EXCLUDED.memoria_calculo
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_criadas_l FROM inseridas;

  RETURN QUERY SELECT v_criados_c, v_criadas_l;
END;$$;

CREATE OR REPLACE FUNCTION public.dre_gerencial_mensal(_empresa_id uuid, _ano integer, _versao_obz uuid DEFAULT NULL::uuid)
 RETURNS TABLE(dre_linha_id uuid, codigo text, descricao text, natureza text, ordem integer, mes integer, realizado numeric, orcado numeric, variacao numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH emp AS (SELECT id, codigo FROM public.empresas WHERE id = _empresa_id),
meses AS (SELECT generate_series(1,12) AS mes),
linhas AS (
  SELECT id, codigo, descricao, natureza::text AS natureza, ordem
  FROM public.dre_linhas WHERE ativo = true AND codigo LIKE 'L%'
    AND (empresa_id = _empresa_id OR empresa_id IS NULL)
),
partidas AS (
  SELECT EXTRACT(MONTH FROM NULLIF(p.data_competencia,'')::date)::int AS mes,
    CASE
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
  WHERE NULLIF(p.data_competencia,'') IS NOT NULL
    AND EXTRACT(YEAR FROM NULLIF(p.data_competencia,'')::date) = _ano
    AND UPPER(COALESCE(p.impacta_dre,'')) IN ('SIM','S','TRUE','1','T')
),
realizado_base AS (SELECT linha_codigo, mes, SUM(valor) AS valor FROM partidas WHERE linha_codigo IS NOT NULL GROUP BY linha_codigo, mes),
realizado_calc AS (
  SELECT linha_codigo, mes, valor FROM realizado_base
  UNION ALL SELECT 'L03', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02') GROUP BY mes
  UNION ALL SELECT 'L06', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02','L04','L05') GROUP BY mes
  UNION ALL SELECT 'L13', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12') GROUP BY mes
  UNION ALL SELECT 'L14', mes, SUM(valor) FROM realizado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12') GROUP BY mes
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
  UNION ALL SELECT 'L13', mes, SUM(valor) FROM orcado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12') GROUP BY mes
  UNION ALL SELECT 'L14', mes, SUM(valor) FROM orcado_base WHERE linha_codigo IN ('L01','L02','L04','L05','L07','L08','L09','L10','L11','L12') GROUP BY mes
),
orcado_m AS (SELECT l.id AS dre_linha_id, oc.mes, SUM(oc.valor) AS valor FROM orcado_calc oc JOIN linhas l ON l.codigo=oc.linha_codigo GROUP BY l.id, oc.mes)
SELECT l.id, l.codigo, l.descricao, l.natureza, l.ordem, m.mes,
       COALESCE(r.valor, 0)::numeric, COALESCE(o.valor, 0)::numeric,
       (COALESCE(r.valor, 0) - COALESCE(o.valor, 0))::numeric
FROM linhas l CROSS JOIN meses m
LEFT JOIN realizado_m r ON r.dre_linha_id=l.id AND r.mes=m.mes
LEFT JOIN orcado_m o ON o.dre_linha_id=l.id AND o.mes=m.mes
ORDER BY l.ordem, l.codigo, m.mes;
$function$;
