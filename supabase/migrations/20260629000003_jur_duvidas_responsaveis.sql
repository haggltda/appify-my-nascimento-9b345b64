-- =========================================================================
-- ORIENTAÇÕES JURÍDICAS — respondedores configuráveis
--
-- Hoje responde quem é do setor JURIDICO (Trabalhando). Esta migration permite
-- ao admin (Parecer Jurídico → "Quem aprova/responde") adicionar pessoas
-- específicas como respondedoras, ALÉM do setor Jurídico.
--
-- Espelha JUR_DUVIDAS_APROVADORES. Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_DUVIDAS_RESPONSAVEIS" (
  empregado_id bigint PRIMARY KEY,
  nome         text,
  criado_por   text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."JUR_DUVIDAS_RESPONSAVEIS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_DUVIDAS_RESPONSAVEIS" TO authenticated;
DROP POLICY IF EXISTS jur_duvidas_resp_all ON public."JUR_DUVIDAS_RESPONSAVEIS";
CREATE POLICY jur_duvidas_resp_all ON public."JUR_DUVIDAS_RESPONSAVEIS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quem pode responder uma dúvida: setor Jurídico Trabalhando OU lista configurável.
CREATE OR REPLACE FUNCTION public.pode_responder_duvida()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
    WHERE e.auth_user_id = auth.uid()
      AND e."Situação" = 'Trabalhando'
      AND ( e."Setor_ERP" = 'JURIDICO'
            OR EXISTS (SELECT 1 FROM public."JUR_DUVIDAS_RESPONSAVEIS" r WHERE r.empregado_id = e."ID") )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_responder_duvida() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_responder_duvida() TO authenticated;

-- UPDATE: responder (setor/lista) OU aprovador aprova/reprova.
DROP POLICY IF EXISTS jur_duvidas_update ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_update ON public."JUR_DUVIDAS" FOR UPDATE TO authenticated
  USING (public.pode_responder_duvida() OR public.pode_aprovar_duvida())
  WITH CHECK (public.pode_responder_duvida() OR public.pode_aprovar_duvida());

-- DELETE: quem pode responder.
DROP POLICY IF EXISTS jur_duvidas_delete ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_delete ON public."JUR_DUVIDAS" FOR DELETE TO authenticated
  USING (public.pode_responder_duvida());

NOTIFY pgrst, 'reload schema';
