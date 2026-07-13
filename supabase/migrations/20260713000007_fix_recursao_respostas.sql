-- =========================================================================
-- NASCIMENTO FORMULARIOS - corrige "infinite recursion" em CS_FORM_RESPOSTAS
--
-- A policy de INSERT tinha um "SELECT count(*) FROM CS_FORM_RESPOSTAS" DENTRO
-- da propria policy da tabela -> o Postgres trata como recursao infinita.
-- Move a checagem (publicado + janela + limite) p/ uma funcao SECURITY
-- DEFINER, que roda como owner e ignora a RLS (sem recursao).
--
-- Idempotente.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.cs_form_aberto(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
     WHERE f.id = _form_id
       AND f.status = 'publicado'
       AND (f.inicia_em  IS NULL OR now() >= f.inicia_em)
       AND (f.encerra_em IS NULL OR now() <= f.encerra_em)
       AND (f.max_respostas IS NULL OR
            (SELECT count(*) FROM public."CS_FORM_RESPOSTAS" r WHERE r.formulario_id = f.id) < f.max_respostas));
$$;
REVOKE EXECUTE ON FUNCTION public.cs_form_aberto(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cs_form_aberto(uuid) TO anon, authenticated;

-- INSERT autenticado: 'responder' e default de todos; editar_criar (import) e
-- formulario aberto tambem valem. Sem subquery na propria tabela.
DROP POLICY IF EXISTS cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_ins_auth ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO authenticated WITH CHECK (
    public.cs_form_cap('responder')
    OR public.cs_form_cap('editar_criar')
    OR public.cs_form_aberto(formulario_id));

-- INSERT anonimo (URL publica): via funcao SECURITY DEFINER (sem recursao).
DROP POLICY IF EXISTS cs_form_resp_public_insert ON public."CS_FORM_RESPOSTAS";
CREATE POLICY cs_form_resp_public_insert ON public."CS_FORM_RESPOSTAS"
  FOR INSERT TO anon WITH CHECK (public.cs_form_aberto(formulario_id));

NOTIFY pgrst, 'reload schema';
