UPDATE public.contrato SET status = status
WHERE centro_custo_id IS NULL AND status IN ('implantacao','ativo');