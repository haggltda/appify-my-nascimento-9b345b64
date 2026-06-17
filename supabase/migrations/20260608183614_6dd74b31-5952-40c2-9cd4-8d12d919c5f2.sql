ALTER TABLE public.perfil_metadata ADD COLUMN IF NOT EXISTS nome text;
UPDATE public.perfil_metadata
SET nome = initcap(replace(role::text, '_', ' '))
WHERE nome IS NULL;