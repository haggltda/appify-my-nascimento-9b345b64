-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — acesso por setor + tempo de conclusão
--
--   CS_FORMULARIOS.setores_acesso  — setores (Setor_ERP) que podem ver/
--                                    responder o formulário. NULL/vazio = todos.
--   CS_FORM_RESPOSTAS.duracao_seg  — tempo (segundos) que o respondente levou
--                                    (abertura → envio).
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."CS_FORMULARIOS"
  ADD COLUMN IF NOT EXISTS setores_acesso text[];
ALTER TABLE public."CS_FORM_RESPOSTAS"
  ADD COLUMN IF NOT EXISTS duracao_seg integer;

NOTIFY pgrst, 'reload schema';
