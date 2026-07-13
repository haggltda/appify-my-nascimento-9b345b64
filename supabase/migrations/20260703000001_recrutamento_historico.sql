-- =========================================================================
-- RECRUTAMENTO_HISTORICO — trilha (append-only) de movimentações
--
-- Registra QUALQUER movimento de uma solicitação e de seus candidatos:
-- criação, aprovação do Operacional, confirmação do Recrutamento, seleção de
-- candidato, liberação do Jurídico, ASO do SST, conclusão e reprovações.
-- Cada linha guarda o evento, de/para status, o papel e QUEM fez.
--
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_HISTORICO" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  solicitacao_id  bigint REFERENCES public."SISTEMA_RECRUTAMENTO"(id) ON DELETE CASCADE,
  candidato_id    bigint,
  candidato_nome  text,
  evento          text,        -- ex.: 'Aprovada pelo Operacional', 'Candidato selecionado'
  de_status       text,
  para_status     text,
  papel           text,        -- 'Solicitante','Operacional','Recrutamento','Jurídico','SST'
  usuario_nome    text,
  usuario_email   text,
  detalhe         text         -- motivo/observação
);

CREATE INDEX IF NOT EXISTS rec_hist_sol_idx
  ON public."RECRUTAMENTO_HISTORICO"(solicitacao_id, created_at);

ALTER TABLE public."RECRUTAMENTO_HISTORICO" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public."RECRUTAMENTO_HISTORICO" TO authenticated;

DROP POLICY IF EXISTS rec_hist_all ON public."RECRUTAMENTO_HISTORICO";
CREATE POLICY rec_hist_all ON public."RECRUTAMENTO_HISTORICO"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
