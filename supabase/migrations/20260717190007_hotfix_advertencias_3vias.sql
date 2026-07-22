-- FASE 0 (hotfix emergencial) — SISTEMA_SOLICITACOES_ADVERTENCIA
--
-- Depende da migration 20260717190006 (cria o menu 'advertencias').
--
-- Diferente das outras tabelas do Jurídico, esta é consumida por 2 módulos:
-- o Jurídico conclui (src/pages/juridico/Advertencias.tsx) e o Encarregado
-- que abriu a solicitação acompanha a própria (src/pages/MinhasSolicitacoes.tsx).
-- Existe ainda um 3º papel, hoje resolvido só no client (Advertencias.tsx,
-- função souAnalista): o analista do contrato do colaborador advertido
-- aprova antes de ir para o Jurídico. Replicamos os 3 critérios na RLS.

CREATE OR REPLACE FUNCTION public.eh_analista_advertencia(_contrato_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _analista_id bigint;
  _meu_id bigint;
BEGIN
  IF _contrato_id IS NULL THEN RETURN false; END IF;

  SELECT "ID" INTO _meu_id FROM public."EMPREGADOS" WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _meu_id IS NULL THEN RETURN false; END IF;

  BEGIN
    EXECUTE 'SELECT analista FROM public."CONTRATOS" WHERE id = $1' INTO _analista_id USING _contrato_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    -- Mesmo fallback do client (Advertencias.tsx): se a coluna/tabela não
    -- existir como esperado, ninguém vira analista por essa via — o gate
    -- fica só para quem tem acesso ao menu 'advertencias' (Jurídico).
    RETURN false;
  END;

  RETURN _analista_id IS NOT NULL AND _analista_id = _meu_id;
END;
$$;
REVOKE ALL ON FUNCTION public.eh_analista_advertencia(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_analista_advertencia(bigint) TO authenticated;

DROP POLICY IF EXISTS "SISTEMA_SOLICITACOES_ADVERTENCIA_all_auth" ON public."SISTEMA_SOLICITACOES_ADVERTENCIA";

CREATE POLICY adv_select ON public."SISTEMA_SOLICITACOES_ADVERTENCIA" FOR SELECT TO authenticated
USING (
  public.has_screen_access(auth.uid(), 'advertencias', 'visualizar'::app_acao)
  OR solicitante_email = auth.email()
  OR public.eh_analista_advertencia(contrato_id)
);

CREATE POLICY adv_insert ON public."SISTEMA_SOLICITACOES_ADVERTENCIA" FOR INSERT TO authenticated
WITH CHECK (
  solicitante_email = auth.email()
  OR public.has_screen_access(auth.uid(), 'advertencias', 'incluir'::app_acao)
);

CREATE POLICY adv_update ON public."SISTEMA_SOLICITACOES_ADVERTENCIA" FOR UPDATE TO authenticated
USING (
  public.has_screen_access(auth.uid(), 'advertencias', 'alterar'::app_acao)
  OR public.eh_analista_advertencia(contrato_id)
)
WITH CHECK (
  public.has_screen_access(auth.uid(), 'advertencias', 'alterar'::app_acao)
  OR public.eh_analista_advertencia(contrato_id)
);

CREATE POLICY adv_delete ON public."SISTEMA_SOLICITACOES_ADVERTENCIA" FOR DELETE TO authenticated
USING (public.has_screen_access(auth.uid(), 'advertencias', 'excluir'::app_acao));

-- Rollback: DROP POLICY IF EXISTS adv_select/adv_insert/adv_update/adv_delete
-- ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"; e recriar
-- "SISTEMA_SOLICITACOES_ADVERTENCIA_all_auth" FOR ALL USING(true) WITH CHECK(true).

NOTIFY pgrst, 'reload schema';
