-- Split garantia into garantia_proposta + garantia_contratual
ALTER TABLE public.capa_edital
  ADD COLUMN IF NOT EXISTS garantia_proposta  text,
  ADD COLUMN IF NOT EXISTS garantia_contratual text;

-- Migra o valor existente de garantia → garantia_contratual como fallback
UPDATE public.capa_edital
  SET garantia_contratual = garantia
  WHERE garantia IS NOT NULL AND garantia_contratual IS NULL;
