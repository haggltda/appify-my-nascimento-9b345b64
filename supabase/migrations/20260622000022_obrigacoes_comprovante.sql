-- =========================================================================
-- JURÍDICO — Obrigações: caminho para pagar + comprovante de pagamento
--
--  onde_pagar       — link (URL) ou local no servidor para efetuar o pagamento.
--  comprovante_path — arquivo do comprovante no Storage (bucket juridico-docs).
--  comprovante_nome — nome original do arquivo.
--
-- Regra de negócio (na UI): conta marcada como Paga COM comprovante não pode
-- ser excluída; toda ação (pago/anexo/exclusão) é registrada no histórico.
-- Idempotente.
-- =========================================================================

ALTER TABLE public."JUR_PATRIMONIO_OBRIGACOES" ADD COLUMN IF NOT EXISTS onde_pagar       text;
ALTER TABLE public."JUR_PATRIMONIO_OBRIGACOES" ADD COLUMN IF NOT EXISTS comprovante_path text;
ALTER TABLE public."JUR_PATRIMONIO_OBRIGACOES" ADD COLUMN IF NOT EXISTS comprovante_nome text;

NOTIFY pgrst, 'reload schema';
