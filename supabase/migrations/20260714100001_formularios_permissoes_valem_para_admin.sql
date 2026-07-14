-- =========================================================================
-- NASCIMENTO FORMULARIOS - as capacidades valem TAMBEM para admin
--
-- Antes, admin (user_roles.role='admin') fazia tudo nos formularios por
-- bypass. Agora o modulo e governado 100% pelos grants POR USUARIO em
-- CS_FORM_ACESSOS - inclusive para admin. Um admin SEM grant so pode
-- 'responder' (Abrir). Para gerenciar, o admin concede as capacidades a si
-- mesmo no painel (as policies de escrita de CS_FORM_ACESSOS continuam
-- abertas a admin, entao ele sempre consegue se conceder).
--
-- Mantido: admin ainda ENXERGA a lista de formularios (cs_forms_select) e
-- ainda pode ATRIBUIR grants (cs_form_acessos_*). O que muda e o poder de
-- criar/editar/publicar/excluir e de ver respostas - agora exige grant.
--
-- Idempotente.
-- =========================================================================

-- has-capability: SEM bypass de admin. 'responder' e o default de todos.
CREATE OR REPLACE FUNCTION public.cs_form_cap(_cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _cap = 'responder'
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = _cap AND a.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap(text) TO authenticated;

-- Respostas: ver depende de grant (ver_tudo / ver_proprias), sem admin.
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid()));

NOTIFY pgrst, 'reload schema';
