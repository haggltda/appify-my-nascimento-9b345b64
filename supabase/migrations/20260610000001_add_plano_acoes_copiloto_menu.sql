-- Adiciona rota do Copiloto IA ao app_menu para que apareça no painel
-- de "Acesso por Usuário" em /administracao → Módulos & Menus.
-- A rota ainda é bloqueada por feature flag (triagemIA) no RouteGuard.

WITH m AS (SELECT id FROM public.app_modulo WHERE codigo = 'plano_acoes')
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, 'plano_acoes_copiloto', 'Copiloto IA', '/app/plano-acoes/copiloto', 15, true
FROM m
ON CONFLICT (modulo_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome, rota = EXCLUDED.rota, ordem = EXCLUDED.ordem, ativo = true;
