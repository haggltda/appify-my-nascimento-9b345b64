-- =========================================================================
-- ORIENTAÇÕES JURÍDICAS — aprovação antes do Jurídico responder
--
-- Fluxo: colaborador pergunta (Central de Serviços → Orientações Jurídicas) →
--   status 'Aberta' → Diretor Administrativo (ou aprovador configurado)
--   APROVA ('Aprovada') ou REPROVA ('Reprovada' + motivo) → o Jurídico só
--   responde as 'Aprovada' → 'Respondida' (aí entra na biblioteca pública,
--   sem o nome de quem perguntou).
--
-- Aprovador: Setor_ERP = 'DIRETOR ADMINISTRATIVO' (Trabalhando) OU constar em
-- JUR_DUVIDAS_APROVADORES (gerida pelo admin). Idempotente.
-- =========================================================================

ALTER TABLE public."JUR_DUVIDAS" ADD COLUMN IF NOT EXISTS aprovado_por      text;
ALTER TABLE public."JUR_DUVIDAS" ADD COLUMN IF NOT EXISTS aprovado_em       timestamptz;
ALTER TABLE public."JUR_DUVIDAS" ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

-- Aprovadores configuráveis (além do setor Diretor Administrativo).
CREATE TABLE IF NOT EXISTS public."JUR_DUVIDAS_APROVADORES" (
  empregado_id bigint PRIMARY KEY,
  nome         text,
  criado_por   text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."JUR_DUVIDAS_APROVADORES" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_DUVIDAS_APROVADORES" TO authenticated;
DROP POLICY IF EXISTS jur_duvidas_aprov_all ON public."JUR_DUVIDAS_APROVADORES";
CREATE POLICY jur_duvidas_aprov_all ON public."JUR_DUVIDAS_APROVADORES"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quem pode aprovar/reprovar uma dúvida.
CREATE OR REPLACE FUNCTION public.pode_aprovar_duvida()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
    WHERE e.auth_user_id = auth.uid()
      AND e."Situação" = 'Trabalhando'
      AND ( e."Setor_ERP" = 'DIRETOR ADMINISTRATIVO'
            OR EXISTS (SELECT 1 FROM public."JUR_DUVIDAS_APROVADORES" a WHERE a.empregado_id = e."ID") )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_aprovar_duvida() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_aprovar_duvida() TO authenticated;

-- UPDATE: Jurídico responde OU aprovador aprova/reprova.
DROP POLICY IF EXISTS jur_duvidas_update ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_update ON public."JUR_DUVIDAS" FOR UPDATE TO authenticated
  USING (public.is_juridico_ativo() OR public.pode_aprovar_duvida())
  WITH CHECK (public.is_juridico_ativo() OR public.pode_aprovar_duvida());

NOTIFY pgrst, 'reload schema';
