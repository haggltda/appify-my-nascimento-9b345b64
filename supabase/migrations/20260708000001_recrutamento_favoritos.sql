-- =========================================================================
-- RECRUTAMENTO — Banco de Talentos: favoritos
-- Marca candidatos como favoritos (estrela). Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS favorito boolean;

CREATE INDEX IF NOT EXISTS wac_favorito_idx ON public."WA_CURRICULOS"(favorito) WHERE favorito;

NOTIFY pgrst, 'reload schema';
