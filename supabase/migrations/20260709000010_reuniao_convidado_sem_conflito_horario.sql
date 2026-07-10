-- Mesma pessoa não pode ser convidada pra duas reuniões que se sobrepõem no
-- horário (mesmo espírito da trava de sala em 20260709000002, só que aqui é
-- por pessoa em vez de por local, e via trigger em vez de EXCLUDE porque a
-- faixa de horário está na tabela reuniao, não na própria reuniao_convidado
-- — precisa de um join pra checar).

CREATE OR REPLACE FUNCTION public.checar_conflito_convidado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_data_hora timestamptz;
  v_duracao   int;
  v_etapa     text;
  v_conflito_titulo text;
BEGIN
  SELECT data_hora, duracao_minutos, etapa INTO v_data_hora, v_duracao, v_etapa
    FROM public.reuniao WHERE id = NEW.reuniao_id;

  IF v_etapa = 'cancelada' THEN
    RETURN NEW;
  END IF;

  SELECT r.titulo INTO v_conflito_titulo
    FROM public.reuniao_convidado rc
    JOIN public.reuniao r ON r.id = rc.reuniao_id
   WHERE rc.user_id = NEW.user_id
     AND rc.reuniao_id <> NEW.reuniao_id
     AND r.etapa <> 'cancelada'
     AND tstzrange(r.data_hora, r.data_hora + (r.duracao_minutos || ' minutes')::interval)
         && tstzrange(v_data_hora, v_data_hora + (v_duracao || ' minutes')::interval)
   LIMIT 1;

  IF v_conflito_titulo IS NOT NULL THEN
    RAISE EXCEPTION 'Este participante já está convidado para outra reunião no mesmo horário: "%".', v_conflito_titulo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checar_conflito_convidado ON public.reuniao_convidado;
CREATE TRIGGER trg_checar_conflito_convidado
  BEFORE INSERT ON public.reuniao_convidado
  FOR EACH ROW EXECUTE FUNCTION public.checar_conflito_convidado();
