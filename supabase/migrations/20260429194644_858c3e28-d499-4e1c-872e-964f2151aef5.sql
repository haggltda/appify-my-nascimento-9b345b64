DROP VIEW IF EXISTS public.vw_dre_contrato;
CREATE VIEW public.vw_dre_contrato
WITH (security_invoker = true)
AS
SELECT 
  octr.id AS orcamento_contrato_id,
  octr.contrato_id,
  octr.empresa_id,
  octr.ciclo_id,
  ocl.dre_linha_id,
  dl.codigo AS dre_codigo,
  dl.descricao AS dre_descricao,
  dl.natureza AS dre_natureza,
  ocl.competencia,
  SUM(ocl.valor_previsto) AS valor_previsto
FROM public.orcamento_contrato octr
JOIN public.orcamento_contrato_linha ocl ON ocl.orcamento_contrato_id = octr.id
JOIN public.dre_linhas dl ON dl.id = ocl.dre_linha_id
GROUP BY octr.id, octr.contrato_id, octr.empresa_id, octr.ciclo_id, ocl.dre_linha_id, dl.codigo, dl.descricao, dl.natureza, ocl.competencia;