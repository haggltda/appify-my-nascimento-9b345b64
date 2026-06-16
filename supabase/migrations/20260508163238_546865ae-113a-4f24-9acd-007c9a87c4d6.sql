DROP INDEX IF EXISTS public.plano_acao_empresa_id_importacao_key;
ALTER TABLE public.plano_acao ADD CONSTRAINT plano_acao_empresa_id_importacao_key UNIQUE (empresa_id, id_importacao);