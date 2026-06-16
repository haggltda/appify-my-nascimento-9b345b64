CREATE OR REPLACE FUNCTION public.export_orcamento_completo_dump(p_limit int DEFAULT 1000, p_offset int DEFAULT 0)
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t) FROM (
    SELECT
      l.id, l.empresa_id,
      e.codigo AS empresa_codigo, e.razao_social AS empresa_razao_social, e.nome_fantasia AS empresa_nome_fantasia,
      l.orcamento_contrato_id, oc.contrato_id,
      oc.status AS orc_contrato_status, oc.valor_receita_total AS orc_valor_receita_total,
      oc.valor_custo_total AS orc_valor_custo_total, oc.margem_estimada AS orc_margem_estimada,
      oc.observacoes AS orc_observacoes,
      ctr.numero AS contrato_numero, ctr.objeto AS contrato_objeto, ctr.orgao AS contrato_orgao,
      ctr.gestor AS contrato_gestor, ctr.valor_total AS contrato_valor_total,
      ctr.faturamento_mensal AS contrato_faturamento_mensal,
      ctr.vigencia_inicio, ctr.vigencia_fim,
      l.dre_linha_id, dl.codigo AS dre_codigo, dl.descricao AS dre_descricao, dl.natureza AS dre_natureza,
      l.centro_custo_id, cc.codigo AS cc_codigo, cc.nome AS cc_nome, cc.tipo AS cc_tipo,
      l.conta_contabil_id, ct.conta_reduzida, ct.classificacao AS conta_classificacao,
      ct.descricao AS conta_descricao, ct.tipo AS conta_tipo, ct.natureza AS conta_natureza,
      l.ciclo_id, ci.ano AS ciclo_ano, ci.nome AS ciclo_nome, ci.status AS ciclo_status,
      l.competencia, l.valor_previsto, l.source, l.origem, l.locked, l.sub_codigo,
      l.memoria_calculo, l.created_at, l.updated_at
    FROM public.orcamento_contrato_linha l
    LEFT JOIN public.empresas e ON e.id = l.empresa_id
    LEFT JOIN public.orcamento_contrato oc ON oc.id = l.orcamento_contrato_id
    LEFT JOIN public.contrato ctr ON ctr.id = oc.contrato_id
    LEFT JOIN public.dre_linhas dl ON dl.id = l.dre_linha_id
    LEFT JOIN public.centros_custo cc ON cc.id = l.centro_custo_id
    LEFT JOIN public.conta_contabil ct ON ct.id = l.conta_contabil_id
    LEFT JOIN public.orcamento_ciclo ci ON ci.id = l.ciclo_id
    ORDER BY e.codigo NULLS LAST, ctr.numero NULLS LAST, l.competencia, l.id
    LIMIT p_limit OFFSET p_offset
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.export_orcamento_completo_dump(int,int) TO anon, authenticated, service_role;