-- Cancelamento de reunião passa a exigir motivo — reforçado no banco (o
-- front já desabilita o botão sem o campo preenchido, mas isso sozinho é
-- só cosmético: sem essa checagem aqui, uma chamada direta à API
-- conseguiria cancelar sem motivo).

CREATE OR REPLACE FUNCTION public.checar_transicao_reuniao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.etapa = OLD.etapa THEN
    RETURN NEW;
  END IF;

  IF auth.uid() NOT IN (OLD.criado_por, OLD.responsavel_preenchimento_user_id) THEN
    RAISE EXCEPTION 'Só o criador ou o responsável pelo preenchimento podem mudar a etapa da reunião.';
  END IF;

  IF NEW.etapa = 'cancelada' THEN
    IF OLD.etapa IN ('concluida', 'cancelada') THEN
      RAISE EXCEPTION 'Não é possível cancelar uma reunião %.', OLD.etapa;
    END IF;
    IF NEW.motivo_cancelamento IS NULL OR btrim(NEW.motivo_cancelamento) = '' THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório.';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.etapa = 'agendada' AND NEW.etapa = 'em_andamento')
    OR (OLD.etapa = 'em_andamento' AND NEW.etapa = 'concluida')
  ) THEN
    RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$;
