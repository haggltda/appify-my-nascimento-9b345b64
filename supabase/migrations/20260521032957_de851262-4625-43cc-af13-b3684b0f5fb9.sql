-- Backfill centro_custo_id em orcamento_contrato_linha a partir do contrato vinculado
UPDATE public.orcamento_contrato_linha l
SET centro_custo_id = c.centro_custo_id,
    updated_at = now()
FROM public.orcamento_contrato oc
JOIN public.contrato c ON c.id = oc.contrato_id
WHERE l.orcamento_contrato_id = oc.id
  AND l.centro_custo_id IS NULL
  AND c.centro_custo_id IS NOT NULL;