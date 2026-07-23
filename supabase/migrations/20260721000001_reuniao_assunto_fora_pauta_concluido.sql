-- Agenda de Reunião — Fase 4 (Painel Gerencial): precisa saber se um
-- assunto estacionado já foi resolvido, pro indicador "Assuntos
-- estacionados pendentes" fazer sentido (hoje não tinha nenhum jeito de
-- marcar isso).
ALTER TABLE public.reuniao_assunto_fora_pauta
  ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false;
