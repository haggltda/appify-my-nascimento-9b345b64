-- Adiciona campo data_captacao na tabela grade
-- Registra quando o edital foi captado/identificado pela equipe

ALTER TABLE public.grade
  ADD COLUMN IF NOT EXISTS data_captacao date;

COMMENT ON COLUMN public.grade.data_captacao IS
  'Data em que o edital foi captado/identificado pela equipe de licitações.';
