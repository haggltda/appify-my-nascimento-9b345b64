-- Atas de Reunião: simplifica o fluxo de etapas conforme o protótipo do
-- cliente — "agendada" → "em_andamento" → "concluida" (+ "cancelada"), sem
-- a etapa própria de "aguardando_ata"/"aguardando_assinaturas". A assinatura
-- continua opcional/livre (não bloqueia nada) e "Encerrar Reunião" fecha
-- direto de em_andamento pra concluida.

ALTER TABLE public.reuniao DROP CONSTRAINT IF EXISTS reuniao_etapa_check;
ALTER TABLE public.reuniao ADD CONSTRAINT reuniao_etapa_check CHECK (etapa IN (
  'agendada', 'em_andamento', 'concluida', 'cancelada'
));

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
