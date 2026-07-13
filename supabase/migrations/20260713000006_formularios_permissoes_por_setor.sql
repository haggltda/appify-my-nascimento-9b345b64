-- =========================================================================
-- NASCIMENTO FORMULARIOS - permissoes por SETOR + default "responder"
--
-- CS_FORM_ACESSOS.papel agora pode ser concedido a um USUARIO (user_id) OU a
-- um SETOR (setor = Setor_ERP). A capacidade efetiva de alguem = admin, OU
-- 'responder' (default de todo mundo), OU grant do proprio usuario, OU grant
-- do setor dele (via EMPREGADOS.auth_user_id -> Setor_ERP).
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."CS_FORM_ACESSOS"
  ADD COLUMN IF NOT EXISTS setor text;
ALTER TABLE public."CS_FORM_ACESSOS" ALTER COLUMN user_id DROP NOT NULL;

-- Cada linha aponta p/ UM alvo: usuario OU setor. dashboard e sempre usuario.
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_alvo;
ALTER TABLE public."CS_FORM_ACESSOS" ADD CONSTRAINT cs_form_acessos_alvo CHECK (
  (papel = 'dashboard' AND user_id IS NOT NULL AND setor IS NULL)
  OR (papel <> 'dashboard' AND ((user_id IS NOT NULL) <> (setor IS NOT NULL)))
);
CREATE UNIQUE INDEX IF NOT EXISTS cs_form_acessos_unq_setor
  ON public."CS_FORM_ACESSOS"(papel, setor) WHERE setor IS NOT NULL;

-- has-capability: admin faz tudo; 'responder' e o default de todos; senao
-- precisa de grant do usuario OU do setor dele.
CREATE OR REPLACE FUNCTION public.cs_form_cap(_cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR _cap = 'responder'
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = _cap AND a.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = _cap AND a.setor IS NOT NULL
                    AND a.setor = (SELECT e."Setor_ERP" FROM public."EMPREGADOS" e
                                    WHERE e.auth_user_id = auth.uid() LIMIT 1));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
