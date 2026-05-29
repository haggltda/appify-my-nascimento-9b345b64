-- L6-FIX-1 REV. B.2
-- Escopo: somente public.profiles
-- Impede auto-promoção e edição de campos sensíveis/auditoria em self-update não-admin.
-- Mantém edges com service_role e admin autenticado funcionais.

CREATE OR REPLACE FUNCTION public.profiles_block_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_effective_role text := COALESCE(
    auth.role(),
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true)
  );
BEGIN
  -- 1) Chamadas server-side privilegiadas (edges service_role, migrations, jobs).
  --    Sem auth.uid(): só liberamos se o papel efetivo for explicitamente privilegiado.
  IF v_uid IS NULL THEN
    IF v_effective_role IN ('service_role','supabase_admin','postgres') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'sessão ausente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2) Admin autenticado: liberado (auditado por trg_audit_profiles).
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- 3) Não-admin não pode editar profile de outra pessoa.
  IF v_uid <> OLD.id THEN
    RAISE EXCEPTION 'alteração restrita ao fluxo administrativo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 4) Self-update: id é imutável.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'campo restrito ao fluxo administrativo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 5) Campos sempre bloqueados em self-update não-admin
  --    (sensíveis + metadados de auditoria).
  IF NEW.acessa_todas_empresas IS DISTINCT FROM OLD.acessa_todas_empresas
     OR NEW.empresa_id          IS DISTINCT FROM OLD.empresa_id
     OR NEW.ativo               IS DISTINCT FROM OLD.ativo
     OR NEW.email               IS DISTINCT FROM OLD.email
     OR NEW.created_at          IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at          IS DISTINCT FROM OLD.updated_at
  THEN
    RAISE EXCEPTION 'campo restrito ao fluxo administrativo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 6) must_change_password: somente transição true -> false
  --    (fechamento do fluxo TrocarSenha). Qualquer outra mudança é bloqueada.
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    IF NOT (OLD.must_change_password = true AND NEW.must_change_password = false) THEN
      RAISE EXCEPTION 'campo restrito ao fluxo administrativo'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- empresa_atual_id segue coberto por trg_profiles_valida_empresa_atual (intacto).
  -- display_name e avatar_url: permitidos.
  RETURN NEW;
END;
$$;

-- Trigger BEFORE UPDATE — prefixo 'a_' garante ordem alfabética antes dos demais
-- (em particular, antes do set_updated_at, que continua gerenciando updated_at).
DROP TRIGGER IF EXISTS a_trg_profiles_block_self_escalation ON public.profiles;
CREATE TRIGGER a_trg_profiles_block_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_block_self_escalation();

-- Policy com WITH CHECK simétrico (defesa em profundidade contra reassinatura de id).
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING      ((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK ((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));