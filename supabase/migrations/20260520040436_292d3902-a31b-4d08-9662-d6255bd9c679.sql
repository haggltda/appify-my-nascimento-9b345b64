
-- 1. Adicionar valor ao enum
ALTER TYPE public.pedido_compra_status ADD VALUE IF NOT EXISTS 'aguardando_aprovacao' BEFORE 'aprovado';

-- 2. Trigger: ao mudar status para aguardando_aprovacao, abrir instância
CREATE OR REPLACE FUNCTION public.tg_pedido_compra_abrir_aprov()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fluxo_id uuid;
  v_solicitante uuid;
BEGIN
  -- só dispara na transição rascunho -> aguardando_aprovacao (ou insert direto)
  IF NEW.status <> 'aguardando_aprovacao' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aguardando_aprovacao' THEN RETURN NEW; END IF;

  -- evita duplicar instância
  IF EXISTS (
    SELECT 1 FROM public.sup_aprov_instancia
    WHERE alvo = 'pedido_compra' AND referencia_id = NEW.id AND status = 'pendente'
  ) THEN
    RETURN NEW;
  END IF;

  v_fluxo_id := public.sup_aprov_fluxo_padrao(NEW.empresa_id, 'pedido_compra'::public.sup_aprov_alvo);
  v_solicitante := COALESCE(auth.uid(), NEW.empresa_id); -- fallback inofensivo

  PERFORM public.sup_aprov_abrir_instancia(
    v_fluxo_id,
    NEW.id,
    NEW.numero,
    NEW.valor_total,
    NEW.centro_custo_id,
    COALESCE(auth.uid(), v_solicitante)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pedido_compra_abrir_aprov ON public.pedido_compra;
CREATE TRIGGER trg_pedido_compra_abrir_aprov
AFTER INSERT OR UPDATE OF status ON public.pedido_compra
FOR EACH ROW
EXECUTE FUNCTION public.tg_pedido_compra_abrir_aprov();
