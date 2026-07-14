ALTER TABLE sistema_solicitacao
  ADD COLUMN IF NOT EXISTS an_criterios          TEXT[],
  ADD COLUMN IF NOT EXISTS an_pessoas_impactadas TEXT;
