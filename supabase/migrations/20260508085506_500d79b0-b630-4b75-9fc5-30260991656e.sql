TRUNCATE TABLE public.mz_32_fato_razao_contabil;

UPDATE public.mz_status
SET status = 'PENDENTE',
    linhas_carregadas = 0,
    linhas_esperadas = 0,
    migration_batch_id = NULL,
    ultimo_erro = NULL,
    iniciou_em = NULL,
    finalizou_em = NULL,
    storage_path = NULL,
    uploaded_at = NULL,
    uploaded_by = NULL,
    updated_at = now()
WHERE tabela = 'mz_32_fato_razao_contabil';