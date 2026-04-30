-- Adiciona o campo "local de prestação de serviço" na tabela de licitação (oportunidade)
-- e também na tabela de staging de importação, para preservar a informação em todo o fluxo.

ALTER TABLE public.licitacao
  ADD COLUMN IF NOT EXISTS local_prestacao text;

COMMENT ON COLUMN public.licitacao.local_prestacao IS
  'Local real e detalhado onde o colaborador prestará o serviço (texto livre).';

ALTER TABLE public.stg_licitacoes
  ADD COLUMN IF NOT EXISTS local_prestacao text;

COMMENT ON COLUMN public.stg_licitacoes.local_prestacao IS
  'Local real e detalhado da prestação de serviço, vindo da carga de importação.';