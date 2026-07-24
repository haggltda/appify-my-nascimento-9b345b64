-- =========================================================================
-- FORMULÁRIOS — pergunta que identifica o respondente
-- + EMPREGADOS — privilégio de UPDATE que faltava (trocar líder)
--
-- 1) Respostas importadas ficam com respondente_nome nulo (aparecem como
--    "Anônimo" e o filtro de Respondente fica vazio). O formulário passa a
--    apontar QUAL pergunta identifica quem respondeu — irmã de
--    pergunta_setor_id. A tela de Respostas usa esse valor como nome.
--
-- 2) A migration 20260622000025 criou a POLICY de UPDATE na EMPREGADOS mas
--    nunca deu o GRANT de tabela (só existe GRANT INSERT). Sem o privilégio,
--    "Trocar líder" não grava. Policy sozinha não basta: no Postgres o GRANT
--    e a RLS são checagens separadas.
-- Idempotente.
-- =========================================================================

ALTER TABLE public."CS_FORMULARIOS"
  ADD COLUMN IF NOT EXISTS pergunta_nome_id text;

ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;
GRANT UPDATE ON public."EMPREGADOS" TO authenticated;

DROP POLICY IF EXISTS empregados_update_rh ON public."EMPREGADOS";
CREATE POLICY empregados_update_rh ON public."EMPREGADOS"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
