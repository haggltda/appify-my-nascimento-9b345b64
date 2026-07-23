-- Paridade com o protótipo Figma na tela de agendamento: tempo previsto por
-- item de pauta já na criação, e justificativa quando o líder altera a
-- duração padrão sugerida pelo tipo de reunião.

ALTER TABLE public.reuniao_pauta
  ADD COLUMN IF NOT EXISTS tempo_previsto_minutos int;

ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS justificativa_alteracao_duracao text;
