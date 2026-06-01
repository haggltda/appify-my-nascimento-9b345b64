ALTER TABLE public.licitacao DROP CONSTRAINT IF EXISTS licitacao_empresa_id_numero_key;

ALTER TABLE public.licitacao
  ADD CONSTRAINT licitacao_empresa_orgao_numero_abertura_key
  UNIQUE (empresa_id, orgao, numero, abertura);