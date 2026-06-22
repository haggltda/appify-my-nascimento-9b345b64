-- Separa Suspenso/Revogado em dois valores distintos no enum
ALTER TYPE public.grade_fase ADD VALUE IF NOT EXISTS 'Suspenso';
ALTER TYPE public.grade_fase ADD VALUE IF NOT EXISTS 'Revogado';

-- Migra registros existentes de 'Suspenso/Revogado' para 'Suspenso'
UPDATE public.grade SET fase = 'Suspenso' WHERE fase = 'Suspenso/Revogado';

-- Novos campos na capa_edital
ALTER TABLE public.capa_edital
  ADD COLUMN IF NOT EXISTS responsavel       text,
  ADD COLUMN IF NOT EXISTS emergencial       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diluicao_meses    integer NOT NULL DEFAULT 12;

-- Converte trabalho_escolar de text para boolean (se ainda for text)
ALTER TABLE public.capa_edital
  ALTER COLUMN trabalho_escolar TYPE boolean
  USING CASE WHEN trabalho_escolar ILIKE 'sim' OR trabalho_escolar = 'true' THEN true ELSE false END;

ALTER TABLE public.capa_edital
  ALTER COLUMN trabalho_escolar SET DEFAULT false;
