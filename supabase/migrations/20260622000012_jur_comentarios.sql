-- =========================================================================
-- JURÍDICO — Comentários por patrimônio
--
-- JUR_COMENTARIOS — feed de comentários do setor Jurídico sobre o patrimônio
--                   e suas obrigações. Alimenta a aba "Comentários" (ao lado
--                   de Histórico) na Gestão Patrimonial e Obrigações.
-- RLS: authenticated (mesmo padrão das demais tabelas JUR_*). Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_COMENTARIOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  texto         text NOT NULL,
  autor         text
);

CREATE INDEX IF NOT EXISTS jur_coment_pat_idx ON public."JUR_COMENTARIOS"(patrimonio_id);

ALTER TABLE public."JUR_COMENTARIOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_COMENTARIOS" TO authenticated;
DROP POLICY IF EXISTS "JUR_COMENTARIOS_all_auth" ON public."JUR_COMENTARIOS";
CREATE POLICY "JUR_COMENTARIOS_all_auth" ON public."JUR_COMENTARIOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
