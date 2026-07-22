-- FASE 0 (hotfix emergencial) — CONTRATOS (maiúsculas)
--
-- Confirmado via Supabase Studio: RLS ligada, mas com UMA única policy —
-- "erp_auth_read_contratos", SELECT, USING(true) — qualquer usuário
-- autenticado lê a tabela inteira (não só as poucas colunas que a UI pede).
-- Não existe policy de INSERT/UPDATE/DELETE (escrita já fica bloqueada por
-- padrão do Postgres quando RLS está ligada e nenhuma policy cobre o
-- comando).
--
-- Mapeei os 4 consumidores reais no front (grep literal por
-- .from("CONTRATOS") em todo src/**):
--   - src/pages/rh/Recrutamento.tsx        → menu 'recrutamento_gestao'
--   - src/pages/rh/Colaboradores.tsx       → menu 'colaboradores'
--   - src/pages/MinhasSolicitacoes.tsx     → menu 'encarregados_minhas_solicitacoes'
--   - src/pages/juridico/Advertencias.tsx  → menu 'advertencias'
-- Todos os 4 códigos já existem (criados nas migrations 006/008). Gateamos
-- com OR entre eles — sem inventar um 5º menu pra uma tabela que não tem
-- tela própria.

DROP POLICY IF EXISTS erp_auth_read_contratos ON public."CONTRATOS";
CREATE POLICY contratos_gate ON public."CONTRATOS" FOR SELECT TO authenticated
USING (
  public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'colaboradores', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'encarregados_minhas_solicitacoes', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'advertencias', 'visualizar'::app_acao)
);

-- Rollback: DROP POLICY IF EXISTS contratos_gate ON public."CONTRATOS"; e recriar
-- erp_auth_read_contratos FOR SELECT TO authenticated USING(true).

NOTIFY pgrst, 'reload schema';
