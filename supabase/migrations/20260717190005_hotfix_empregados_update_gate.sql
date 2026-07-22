-- FASE 0 (hotfix emergencial) — EMPREGADOS (UPDATE)
--
-- empregados_update_rh (20260622000025) libera UPDATE pra qualquer
-- authenticated (USING(true) WITH CHECK(true)) — o comentário original já
-- avisava "se quiser restringir a escrita só ao RH, troque por
-- is_rh_ativo()". A tela que usa esse UPDATE (RH → Colaboradores,
-- /app/rh/colaboradores, menu_codigo 'colaboradores' já cadastrado em
-- app_menu) é hoje a única gravação de campos de RH (Setor_ERP, LIDER,
-- Perfil_ERP, Situação, email) na EMPREGADOS.
--
-- Restringimos só a ESCRITA aqui. A LEITURA da EMPREGADOS não é tocada
-- nesta migration — dezenas de telas fora do módulo RH fazem SELECT nela
-- pra montar listas/dropdowns de colaboradores (ex: FormPermsUsuario em
-- ModulosMenusTab.tsx lê EMPREGADOS."Setor_ERP"), e restringir o SELECT
-- sem mapear todos esses consumidores primeiro arrisca quebrar telas em
-- produção. Isso fica para uma migration própria, depois de mapear quem
-- lê a tabela hoje (provavelmente vai precisar de uma view pública com só
-- as colunas não-sensíveis para os usos de dropdown, e a tabela completa
-- restrita ao RH).
--
-- Seed de continuidade: concede o menu 'colaboradores' via
-- screen_permission_profile pra role 'rh' (e admin, redundante já que
-- has_screen_access hoje ainda dá bypass de admin) — quem tem esse cargo
-- continua editando normalmente.

INSERT INTO public.screen_permission_profile (role, menu_codigo, acao, allow)
SELECT 'rh'::app_role, 'colaboradores', a.acao::app_acao, true
FROM (VALUES ('visualizar'), ('alterar')) AS a(acao)
ON CONFLICT (role, menu_codigo, acao) DO NOTHING;

DROP POLICY IF EXISTS empregados_update_rh ON public."EMPREGADOS";
CREATE POLICY empregados_update_rh ON public."EMPREGADOS"
  FOR UPDATE TO authenticated
  USING (public.has_screen_access(auth.uid(), 'colaboradores', 'alterar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'colaboradores', 'alterar'::app_acao));

-- Rollback (reabre escrita irrestrita — só usar em emergência):
-- DROP POLICY IF EXISTS empregados_update_rh ON public."EMPREGADOS";
-- CREATE POLICY empregados_update_rh ON public."EMPREGADOS" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
