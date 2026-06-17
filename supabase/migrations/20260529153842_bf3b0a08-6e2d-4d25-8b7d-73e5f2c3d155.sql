-- L6-FIX-3 REV. A.1 — notificacoes
CREATE OR REPLACE FUNCTION public.notificacoes_block_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_eff text := COALESCE(
    auth.role(),
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true)
  );
BEGIN
  IF v_uid IS NULL THEN
    IF v_eff IN ('service_role', 'supabase_admin', 'postgres') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'sessão ausente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF v_uid <> OLD.user_id THEN
    RAISE EXCEPTION 'alteração restrita'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.titulo IS DISTINCT FROM OLD.titulo
     OR NEW.mensagem IS DISTINCT FROM OLD.mensagem
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'campo restrito ao fluxo administrativo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_trg_notificacoes_block_self_escalation ON public.notificacoes;

CREATE TRIGGER a_trg_notificacoes_block_self_escalation
BEFORE UPDATE ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.notificacoes_block_self_escalation();

DROP POLICY IF EXISTS "marcar minhas notificacoes" ON public.notificacoes;

CREATE POLICY "marcar minhas notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );