SET lock_timeout = '5s';
SET statement_timeout = '120s';

CREATE INDEX IF NOT EXISTS idx_mz40_empresa_excluir
  ON public.mz_40_fato_fluxo_caixa_realizado (empresa)
  WHERE excluir_do_fluxo = false;

CREATE INDEX IF NOT EXISTS idx_alias_bancos_empresa_status
  ON public.integration_alias_bancos (empresa_id, status);