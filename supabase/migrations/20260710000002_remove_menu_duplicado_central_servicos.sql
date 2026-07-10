-- =========================================================================
-- CENTRAL DE SERVIÇOS — remove o menu duplicado do hub
--
-- A migration 20260625000003 cadastrou em app_menu a tela
-- 'central_servicos_dashboard' com rota /app/central-servicos, duplicando
-- uma rota que já existia no sistema. O código não referencia esse codigo
-- em lugar nenhum. A tela canônica do hub (única, gerenciada pelo painel
-- Módulos & Menus) é garantida em 20260710000003, com seed de acesso geral.
--
-- O módulo app_modulo 'central_servicos' permanece (é o pai do menu de
-- Denúncias). Idempotente.
-- =========================================================================

DELETE FROM public.screen_permission_user
 WHERE menu_codigo = 'central_servicos_dashboard';

DELETE FROM public.app_menu
 WHERE codigo = 'central_servicos_dashboard'
   AND rota = '/app/central-servicos';

NOTIFY pgrst, 'reload schema';
