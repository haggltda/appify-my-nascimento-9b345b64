-- Local da reunião passa a ser um dropdown de salas fixas no front (mais
-- "Outro" com texto livre) — no banco continua sendo texto livre em
-- local_ou_link, só ganha uma trava de conflito real.
--
-- duracao_minutos: necessário pra checar SOBREPOSIÇÃO de horário (não só
-- horário exato igual) — sem duração não dá pra saber se duas reuniões na
-- mesma sala colidem.
--
-- A trava em si é uma EXCLUDE constraint (o jeito padrão do Postgres pra
-- "duas reservas não podem se sobrepor") — à prova de condição de corrida,
-- diferente de um SELECT-antes-de-INSERT no cliente. Só vale pra reunião
-- presencial (tipo_local='presencial') e ignora reuniões canceladas.

ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS duracao_minutos int NOT NULL DEFAULT 60;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- O operador timestamptz + interval é STABLE (não IMMUTABLE) porque um
-- interval pode carregar meses/dias, cujo resultado depende do fuso da
-- sessão. Aqui só somamos minutos — sempre determinístico, independente de
-- fuso — então é seguro envelopar numa função IMMUTABLE pra poder usar num
-- índice de EXCLUDE constraint (Postgres exige IMMUTABLE em expressão de
-- índice).
CREATE OR REPLACE FUNCTION public.reuniao_faixa_horario(p_data_hora timestamptz, p_duracao_minutos int)
RETURNS tstzrange
LANGUAGE sql IMMUTABLE
AS $$
  SELECT tstzrange(p_data_hora, p_data_hora + (p_duracao_minutos * interval '1 minute'));
$$;

ALTER TABLE public.reuniao DROP CONSTRAINT IF EXISTS reuniao_local_sem_sobreposicao;
ALTER TABLE public.reuniao
  ADD CONSTRAINT reuniao_local_sem_sobreposicao
  EXCLUDE USING gist (
    local_ou_link WITH =,
    public.reuniao_faixa_horario(data_hora, duracao_minutos) WITH &&
  )
  WHERE (etapa <> 'cancelada' AND tipo_local = 'presencial');
