-- Corrige trava de conflito de horário incompleta: até aqui só existia
-- checagem quando a pessoa já era CONVIDADA de outra reunião no mesmo
-- horário (checar_conflito_convidado, de 20260709000010) — não existia
-- nenhuma checagem pra CRIADOR nem RESPONSÁVEL. Resultado: dava pra marcar
-- alguém que já estava ocupado como responsável/criador de outra reunião.
--
-- Unifica tudo numa função só: a mesma pessoa não pode estar em duas
-- reuniões não canceladas com horário sobreposto, não importa a combinação
-- de papéis (criador, responsável, convidado) em cada uma.

-- 1) Função auxiliar única -----------------------------------------------
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
         OR EXISTS (SELECT 1 FROM public.reuniao_convidado c WHERE c.reuniao_id = r.id AND c.user_id = p_user_id)
       )
       AND tstzrange(r.data_hora, r.data_hora + (r.duracao_minutos || ' minutes')::interval)
           && tstzrange(p_data_hora, p_data_hora + (p_duracao_minutos || ' minutes')::interval)
  );
$$;

-- 2) Trigger nova em reuniao (criador + responsável, e reavalia convidados
--    já existentes quando o horário muda) --------------------------------
CREATE OR REPLACE FUNCTION public.checar_conflito_horario_reuniao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_convidado_em_conflito uuid;
BEGIN
  IF NEW.etapa = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- Só reavalia quando algo que afeta a agenda de fato mudou (evita custo/
  -- ruído em updates de pauta/objetivo/etc, que não passam por essa trigger
  -- porque são outras tabelas — isso aqui é só defesa extra pra UPDATE
  -- direto em reuniao).
  IF TG_OP = 'UPDATE'
     AND NEW.data_hora = OLD.data_hora
     AND NEW.duracao_minutos = OLD.duracao_minutos
     AND NEW.responsavel_preenchimento_user_id = OLD.responsavel_preenchimento_user_id THEN
    RETURN NEW;
  END IF;

  IF public.pessoa_tem_conflito_horario(NEW.criado_por, NEW.data_hora, NEW.duracao_minutos, NEW.id) THEN
    RAISE EXCEPTION 'O criador desta reunião já está em outra reunião no mesmo horário.';
  END IF;

  IF public.pessoa_tem_conflito_horario(NEW.responsavel_preenchimento_user_id, NEW.data_hora, NEW.duracao_minutos, NEW.id) THEN
    RAISE EXCEPTION 'O responsável pelo preenchimento já está em outra reunião no mesmo horário.';
  END IF;

  -- Se o horário/duração mudou numa reunião que já tem convidados, reavalia
  -- a agenda deles pro novo horário.
  IF TG_OP = 'UPDATE' AND (NEW.data_hora <> OLD.data_hora OR NEW.duracao_minutos <> OLD.duracao_minutos) THEN
    SELECT c.user_id INTO v_convidado_em_conflito
      FROM public.reuniao_convidado c
     WHERE c.reuniao_id = NEW.id
       AND public.pessoa_tem_conflito_horario(c.user_id, NEW.data_hora, NEW.duracao_minutos, NEW.id)
     LIMIT 1;
    IF v_convidado_em_conflito IS NOT NULL THEN
      RAISE EXCEPTION 'Um dos convidados já está em outra reunião no novo horário.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checar_conflito_horario_reuniao ON public.reuniao;
CREATE TRIGGER trg_checar_conflito_horario_reuniao
  BEFORE INSERT OR UPDATE ON public.reuniao
  FOR EACH ROW EXECUTE FUNCTION public.checar_conflito_horario_reuniao();

-- 3) Trigger de convidado passa a usar a mesma função (cobre convidado vs
--    criador/responsável de outra reunião, não só convidado vs convidado) -
CREATE OR REPLACE FUNCTION public.checar_conflito_convidado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_data_hora timestamptz;
  v_duracao   int;
  v_etapa     text;
BEGIN
  SELECT data_hora, duracao_minutos, etapa INTO v_data_hora, v_duracao, v_etapa
    FROM public.reuniao WHERE id = NEW.reuniao_id;

  IF v_etapa = 'cancelada' THEN
    RETURN NEW;
  END IF;

  IF public.pessoa_tem_conflito_horario(NEW.user_id, v_data_hora, v_duracao, NEW.reuniao_id) THEN
    RAISE EXCEPTION 'Este participante já está em outra reunião no mesmo horário.';
  END IF;

  RETURN NEW;
END;
$$;
