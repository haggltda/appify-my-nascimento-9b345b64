-- =========================================================================
-- JURÍDICO — Advertências: exceção de prazo (ocorrido > 3 dias)
--
--  excecao               — true quando a advertência foi solicitada fora do
--                          prazo de 3 dias e confirmada como exceção.
--  justificativa_excecao — justificativa obrigatória dada nesse caso.
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."SISTEMA_SOLICITACOES_ADVERTENCIA" ADD COLUMN IF NOT EXISTS excecao               boolean NOT NULL DEFAULT false;
ALTER TABLE public."SISTEMA_SOLICITACOES_ADVERTENCIA" ADD COLUMN IF NOT EXISTS justificativa_excecao text;

NOTIFY pgrst, 'reload schema';
