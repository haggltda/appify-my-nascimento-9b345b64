-- =========================================================================
-- CENTRAL DE SERVIÇOS — remove o menu duplicado do hub
--
-- A migration 20260625000003 cadastrou em app_menu a tela
-- 'central_servicos_dashboard' com rota /app/central-servicos, mas essa
-- rota já existe no sistema como o próprio módulo (o Sidebar abre o hub
-- pelo headerLink do módulo, sem submódulos). O código não referencia esse
-- menu em lugar nenhum — era só uma entrada duplicada na matriz de menus.
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
