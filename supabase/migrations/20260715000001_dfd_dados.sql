ALTER TABLE sistema_solicitacao
  ADD COLUMN IF NOT EXISTS dfd_dados JSONB;
