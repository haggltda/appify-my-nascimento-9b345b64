-- =========================================================================
-- NASCIMENTO FORMULARIOS - permissoes SOMENTE POR USUARIO
--
-- Remove por completo o modelo "por setor" que estava por cima do por-usuario:
--   * cs_form_cap deixa de considerar grants por Setor_ERP (era isso que
--     fazia o usuario continuar podendo tudo mesmo com os toggles zerados -
--     o setor dele, ex.: SISTEMAS, tinha os grants).
--   * some a classificacao Administrativo/Operacional (CS_FORM_SETOR_GRUPO)
--     e as capacidades ver_admin / ver_op que dependiam dela.
--
-- Capacidade efetiva agora = admin, OU 'responder' (default de todo logado),
-- OU grant do proprio usuario em CS_FORM_ACESSOS.
--
-- Idempotente.
-- =========================================================================

-- ── 1) has-capability: admin + responder(default) + grant do USUARIO ─────
CREATE OR REPLACE FUNCTION public.cs_form_cap(_cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR _cap = 'responder'
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = _cap AND a.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cs_form_cap(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cs_form_cap(text) TO authenticated;

-- ── 2) RLS respostas: escopo de visualizacao sem Admin/Operacional ───────
-- (as duas linhas ver_admin/ver_op referenciavam CS_FORM_SETOR_GRUPO, que
-- vai ser removida abaixo - recriar a policy ANTES do DROP TABLE.)
DROP POLICY IF EXISTS cs_form_resp_select ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_select ON public."CS_FORM_RESPOSTAS"
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.cs_form_cap('ver_tudo')
    OR (public.cs_form_cap('ver_proprias') AND criado_por = auth.uid()));

-- ── 3) Limpa os grants por setor e as capacidades sem uso ────────────────
DELETE FROM public."CS_FORM_ACESSOS" WHERE setor IS NOT NULL;
DELETE FROM public."CS_FORM_ACESSOS" WHERE papel IN ('ver_admin', 'ver_op');

-- ── 4) Remove a classificacao Administrativo/Operacional ─────────────────
DROP TABLE IF EXISTS public."CS_FORM_SETOR_GRUPO";

-- ── 5) Coluna setor sai (dropa junto a constraint de alvo e o indice de
--        setor que dependem dela) e o check de papel volta ao conjunto atual
ALTER TABLE public."CS_FORM_ACESSOS" DROP COLUMN IF EXISTS setor;

ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_papel_check;
ALTER TABLE public."CS_FORM_ACESSOS" ADD CONSTRAINT cs_form_acessos_papel_check CHECK (papel IN (
  'editar_criar', 'responder', 'encerrar_excluir', 'ver_tudo', 'ver_proprias', 'dashboard'));

NOTIFY pgrst, 'reload schema';
