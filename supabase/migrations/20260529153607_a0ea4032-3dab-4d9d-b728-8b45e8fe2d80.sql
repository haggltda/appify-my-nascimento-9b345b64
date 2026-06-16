-- L6-FIX-2 REV. A.1 — sessoes_ativas
CREATE OR REPLACE FUNCTION public.sessoes_block_self_escalation()
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
     OR NEW.iniciada_em IS DISTINCT FROM OLD.iniciada_em
     OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
     OR NEW.ip IS DISTINCT FROM OLD.ip
  THEN
    RAISE EXCEPTION 'campo imutável'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.ativa IS DISTINCT FROM OLD.ativa THEN
    IF NOT (OLD.ativa IS TRUE AND NEW.ativa IS FALSE) THEN
      RAISE EXCEPTION 'reativação de sessão não permitida'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_trg_sessoes_block_self_escalation ON public.sessoes_ativas;

CREATE TRIGGER a_trg_sessoes_block_self_escalation
BEFORE UPDATE ON public.sessoes_ativas
FOR EACH ROW
EXECUTE FUNCTION public.sessoes_block_self_escalation();

DROP POLICY IF EXISTS "atualizar minhas sessoes" ON public.sessoes_ativas;

CREATE POLICY "atualizar minhas sessoes" ON public.sessoes_ativas
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );