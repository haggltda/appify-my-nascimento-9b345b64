-- =========================================================================
-- EMPREGADOS — coluna "Nome do Cargo"
--
-- A EMPREGADOS traz o cargo em "Título do Cargo", que em vários registros
-- veio da folha só com o CÓDIGO do cargo (ex.: "0182"), não o nome legível.
-- Esta coluna guarda o nome do cargo já traduzido (ex.: "ADVOGADO"), obtido
-- ao integrar uma planilha de referência (Cargo → Nome do Cargo) na tela
-- RH → Colaboradores ("Integrar Cargos").
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."EMPREGADOS"
  ADD COLUMN IF NOT EXISTS "Nome do Cargo" text;

NOTIFY pgrst, 'reload schema';
