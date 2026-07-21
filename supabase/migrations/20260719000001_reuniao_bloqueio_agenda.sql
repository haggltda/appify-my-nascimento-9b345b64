-- Agenda de Reunião — Fase 2: Bloquear Agenda. Cada usuário bloqueia
-- períodos da própria agenda (viagem, férias, compromisso pessoal etc.) —
-- não aparece pra ninguém mais (não expõe motivo pessoal), só barra na
-- hora de tentar marcar reunião com essa pessoa, igual conflito de
-- horário entre reuniões já faz hoje.

CREATE TABLE IF NOT EXISTS public.reuniao_bloqueio_agenda (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  tipo         text NOT NULL CHECK (tipo IN ('data_especifica', 'periodo')),
  data_inicio  date NOT NULL,
  data_fim     date NOT NULL,
  dia_inteiro  boolean NOT NULL DEFAULT true,
  hora_inicio  time,
  hora_fim     time,
  motivo       text NOT NULL CHECK (motivo IN ('viagem', 'compromisso_pessoal', 'ferias', 'treinamento_curso', 'trabalho_externo', 'outro')),
  motivo_outro text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio),
  CHECK (tipo = 'periodo' OR data_inicio = data_fim),
  CHECK (motivo <> 'outro' OR (motivo_outro IS NOT NULL AND btrim(motivo_outro) <> '')),
  CHECK (dia_inteiro OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_inicio < hora_fim))
);
CREATE INDEX IF NOT EXISTS idx_reuniao_bloqueio_agenda_user ON public.reuniao_bloqueio_agenda(user_id);

ALTER TABLE public.reuniao_bloqueio_agenda ENABLE ROW LEVEL SECURITY;

-- Só o dono vê/cria/apaga os próprios bloqueios — nem outros usuários com
-- acesso ao menu enxergam (o motivo pode ser pessoal). Sem UPDATE: errou,
-- apaga e cria de novo, é mais simples.
DROP POLICY IF EXISTS reuniao_bloqueio_agenda_select ON public.reuniao_bloqueio_agenda;
CREATE POLICY reuniao_bloqueio_agenda_select ON public.reuniao_bloqueio_agenda
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS reuniao_bloqueio_agenda_insert ON public.reuniao_bloqueio_agenda;
CREATE POLICY reuniao_bloqueio_agenda_insert ON public.reuniao_bloqueio_agenda
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reuniao_bloqueio_agenda_delete ON public.reuniao_bloqueio_agenda;
CREATE POLICY reuniao_bloqueio_agenda_delete ON public.reuniao_bloqueio_agenda
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Checa se a pessoa tem algum bloqueio que se sobrepõe ao horário informado.
-- SECURITY DEFINER: precisa enxergar bloqueios de QUALQUER usuário (não só
-- os do chamador) pra travar o agendamento — a RLS acima é só pra tela de
-- "meus bloqueios", essa função é a exceção deliberada de acesso amplo.
CREATE OR REPLACE FUNCTION public.pessoa_tem_bloqueio_agenda(
  p_user_id          uuid,
  p_data_hora        timestamptz,
  p_duracao_minutos  int
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.reuniao_bloqueio_agenda b
     WHERE b.user_id = p_user_id
       AND tstzrange(
             CASE WHEN b.dia_inteiro THEN b.data_inicio::timestamptz ELSE (b.data_inicio + b.hora_inicio)::timestamptz END,
             CASE WHEN b.dia_inteiro THEN (b.data_fim + 1)::timestamptz ELSE (b.data_inicio + b.hora_fim)::timestamptz END
           ) && tstzrange(p_data_hora, p_data_hora + (p_duracao_minutos || ' minutes')::interval)
  );
$$;

-- pessoa_tem_conflito_horario passa a considerar também bloqueio de
-- agenda — assim toda a trava que já existe (criar reunião, editar
-- horário, convidar alguém, recorrência semanal) já cobre bloqueio
-- automaticamente, sem precisar mexer em mais nenhuma trigger/policy.
-- Aproveito e corrijo: faltava checar organizador_user_id de OUTRAS
-- reuniões aqui dentro (só tinha sido adicionado como chamada separada em
-- checar_conflito_horario_reuniao, na Fase 1 — mas o convite de convidado
-- passa só por aqui, então organizador ficava sem essa proteção).
CREATE OR REPLACE FUNCTION public.pessoa_tem_conflito_horario(
  p_user_id             uuid,
  p_data_hora           timestamptz,
  p_duracao_minutos     int,
  p_reuniao_id_ignorar  uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.reuniao r
     WHERE r.id <> p_reuniao_id_ignorar
       AND r.etapa <> 'cancelada'
       AND (
         r.criado_por = p_user_id
         OR r.responsavel_preenchimento_user_id = p_user_id
         OR r.organizador_user_id = p_user_id
         OR EXISTS (SELECT 1 FROM public.reuniao_convidado c WHERE c.reuniao_id = r.id AND c.user_id = p_user_id)
       )
       AND tstzrange(r.data_hora, r.data_hora + (r.duracao_minutos || ' minutes')::interval)
           && tstzrange(p_data_hora, p_data_hora + (p_duracao_minutos || ' minutes')::interval)
  )
  OR public.pessoa_tem_bloqueio_agenda(p_user_id, p_data_hora, p_duracao_minutos);
$$;
