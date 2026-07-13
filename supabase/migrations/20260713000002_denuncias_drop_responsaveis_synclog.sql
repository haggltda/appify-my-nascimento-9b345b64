-- =========================================================================
-- DENÚNCIAS — remove tabelas auxiliares inúteis
--
-- Quem acessa o módulo de Denúncias é definido no painel Módulos & Menus
-- (/app/administracao?tab=modulos) + RLS admin em CS_DENUNCIAS. As duas
-- tabelas abaixo não agregam:
--   CS_DENUNCIAS_RESPONSAVEIS — atribuição de "responsável" por denúncia
--                               (feature removida da tela)
--   CS_DENUNCIAS_SYNC_LOG     — log de execuções do sync (o resultado já
--                               volta na resposta da edge function)
--
-- CS_DENUNCIAS permanece. As colunas responsavel_* de CS_DENUNCIAS ficam
-- (sem uso) — dropá-las é opcional e não é feito aqui. Idempotente.
-- =========================================================================

DROP TABLE IF EXISTS public."CS_DENUNCIAS_RESPONSAVEIS";
DROP TABLE IF EXISTS public."CS_DENUNCIAS_SYNC_LOG";

NOTIFY pgrst, 'reload schema';
