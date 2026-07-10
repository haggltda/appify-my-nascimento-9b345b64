-- Atas de Reunião: além do push (enviar-notificacao-push-reuniao), também
-- alimenta o sininho de notificações in-app que já existe no Topbar
-- (tabela public.notificacoes) via triggers — sem precisar de UI nova,
-- reaproveitando a central de notificações do resto do ERP.

CREATE OR REPLACE FUNCTION public.reuniao_notificar(_user_id uuid, _reuniao_id uuid, _titulo text, _mensagem text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, link)
  VALUES (_user_id, _titulo, _mensagem, 'reuniao', '/app/central-servicos/reunioes/' || _reuniao_id::text);
END;
$$;
REVOKE ALL ON FUNCTION public.reuniao_notificar(uuid, uuid, text, text) FROM PUBLIC;

-- Convidado adicionado -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reuniao_convidado_notificar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_titulo text;
BEGIN
  SELECT titulo INTO v_titulo FROM public.reuniao WHERE id = NEW.reuniao_id;
  PERFORM public.reuniao_notificar(
    NEW.user_id, NEW.reuniao_id,
    'Você foi convidado para uma reunião',
    format('Você foi convidado para "%s".', v_titulo)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reuniao_convidado_notificar ON public.reuniao_convidado;
CREATE TRIGGER trg_reuniao_convidado_notificar
  AFTER INSERT ON public.reuniao_convidado
  FOR EACH ROW EXECUTE FUNCTION public.reuniao_convidado_notificar();

-- Responsável atribuído a um tópico de pauta ---------------------------------
CREATE OR REPLACE FUNCTION public.reuniao_pauta_notificar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_titulo text;
BEGIN
  IF NEW.responsavel_user_id IS NOT NULL
     AND NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    SELECT titulo INTO v_titulo FROM public.reuniao WHERE id = NEW.reuniao_id;
    PERFORM public.reuniao_notificar(
      NEW.responsavel_user_id, NEW.reuniao_id,
      'Você é responsável por uma pauta',
      format('Tópico "%s" da reunião "%s".', NEW.titulo_topico, v_titulo)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reuniao_pauta_notificar ON public.reuniao_pauta;
CREATE TRIGGER trg_reuniao_pauta_notificar
  AFTER INSERT OR UPDATE ON public.reuniao_pauta
  FOR EACH ROW EXECUTE FUNCTION public.reuniao_pauta_notificar();

-- Reunião muda de etapa -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reuniao_etapa_notificar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_msg text;
  v_user_id uuid;
BEGIN
  IF NEW.etapa = OLD.etapa THEN
    RETURN NEW;
  END IF;

  v_msg := CASE NEW.etapa
    WHEN 'em_andamento' THEN format('A reunião "%s" foi iniciada.', NEW.titulo)
    WHEN 'concluida' THEN format('A reunião "%s" foi encerrada.', NEW.titulo)
    WHEN 'cancelada' THEN format('A reunião "%s" foi cancelada.', NEW.titulo)
    ELSE format('A reunião "%s" mudou de status.', NEW.titulo)
  END;

  FOR v_user_id IN (
    SELECT DISTINCT uid FROM (
      SELECT NEW.criado_por AS uid
      UNION SELECT NEW.responsavel_preenchimento_user_id
      UNION SELECT user_id FROM public.reuniao_convidado WHERE reuniao_id = NEW.id
    ) t WHERE uid IS NOT NULL
  ) LOOP
    PERFORM public.reuniao_notificar(v_user_id, NEW.id, 'Atualização de reunião', v_msg);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reuniao_etapa_notificar ON public.reuniao;
CREATE TRIGGER trg_reuniao_etapa_notificar
  AFTER UPDATE ON public.reuniao
  FOR EACH ROW EXECUTE FUNCTION public.reuniao_etapa_notificar();
