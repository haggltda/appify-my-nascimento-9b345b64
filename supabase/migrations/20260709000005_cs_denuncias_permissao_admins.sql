-- =========================================================================
-- CENTRAL DE SERVIÇOS — Denúncias: libera a tela para os admins atuais
--
-- A versão vigente de list_accessible_menus no banco exige allow=true
-- EXPLÍCITO por usuário em screen_permission_user para todo mundo —
-- inclusive admins (sem bypass de role). Este seed libera 'visualizar'
-- da tela de Denúncias para todos os usuários com papel admin.
--
-- Novos admins no futuro: liberar em Administração → Módulos & Menus.
-- A RLS de CS_DENUNCIAS segue sendo a autoridade final (só admin lê).
--
-- NOT EXISTS em vez de ON CONFLICT: a UNIQUE (user_id, menu_codigo, acao,
-- empresa_id) trata NULLs de empresa_id como distintos, então ON CONFLICT
-- não deduplicaria as linhas globais. Idempotente.
-- =========================================================================

INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id, motivo)
SELECT ur.user_id, 'central_servicos_denuncias', 'visualizar'::public.app_acao, true, NULL,
       'Canal de Ética: liberado para todos os admins (módulo restrito por RLS a admin)'
  FROM public.user_roles ur
 WHERE ur.role = 'admin'::public.app_role
   AND NOT EXISTS (
         SELECT 1 FROM public.screen_permission_user s
          WHERE s.user_id     = ur.user_id
            AND s.menu_codigo = 'central_servicos_denuncias'
            AND s.acao        = 'visualizar'::public.app_acao
            AND s.empresa_id IS NULL
       );
