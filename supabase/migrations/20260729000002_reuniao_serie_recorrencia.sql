-- Reuniões recorrentes (semanais) hoje nascem como linhas totalmente
-- independentes, sem nenhum vínculo entre si — impossível editar a série
-- inteira de uma vez. Essa coluna é só uma tag compartilhada entre as
-- reuniões nascidas da mesma criação recorrente (sem FK, não é uma
-- tabela de "série" — cada reuniao continua sendo uma linha completa e
-- independente, só ganha um identificador em comum).

ALTER TABLE public.reuniao ADD COLUMN IF NOT EXISTS serie_recorrencia_id uuid;
CREATE INDEX IF NOT EXISTS idx_reuniao_serie_recorrencia ON public.reuniao(serie_recorrencia_id) WHERE serie_recorrencia_id IS NOT NULL;
