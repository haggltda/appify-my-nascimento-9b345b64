-- FASE 3 (lote 7f — RH/Folha) — folha_periodo/folha_evento já usavam
-- can_access(...) (perfil_acesso), mas ainda envolviam a checagem com
-- has_role(admin) OR (user_pode_atuar_empresa(...) AND can_access(...)) —
-- ou seja, mesmo alguém com o perfil certo era barrado se não tivesse
-- vínculo de empresa (user_empresa). Confirmado via grep: can_access já
-- ignora os parâmetros extra (_empresa/_modulo) desde a Fase 1
-- (20260717200003), então essa camada extra era só o bypass antigo
-- sobrevivendo por fora da função de gate.

DROP POLICY IF EXISTS fp_select ON public.folha_periodo;
CREATE POLICY fp_select ON public.folha_periodo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'folha', 'visualizar'::app_acao));
DROP POLICY IF EXISTS fp_insert ON public.folha_periodo;
CREATE POLICY fp_insert ON public.folha_periodo FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'folha', 'incluir'::app_acao));
DROP POLICY IF EXISTS fp_update ON public.folha_periodo;
CREATE POLICY fp_update ON public.folha_periodo FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'folha', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'folha', 'alterar'::app_acao));
DROP POLICY IF EXISTS fp_delete ON public.folha_periodo;
CREATE POLICY fp_delete ON public.folha_periodo FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'folha', 'excluir'::app_acao));

DROP POLICY IF EXISTS fe_select ON public.folha_evento;
CREATE POLICY fe_select ON public.folha_evento FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'folha', 'visualizar'::app_acao));
DROP POLICY IF EXISTS fe_insert ON public.folha_evento;
CREATE POLICY fe_insert ON public.folha_evento FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'folha', 'incluir'::app_acao));
DROP POLICY IF EXISTS fe_update ON public.folha_evento;
CREATE POLICY fe_update ON public.folha_evento FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'folha', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'folha', 'alterar'::app_acao));
DROP POLICY IF EXISTS fe_delete ON public.folha_evento;
CREATE POLICY fe_delete ON public.folha_evento FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'folha', 'excluir'::app_acao));

NOTIFY pgrst, 'reload schema';
