-- RouteGuard / Sidebar — distinção entre "nunca configurado no gerenciamento
-- de acesso" (deixa aberto) e "configurado, mas este usuário não tem" (nega).
--
-- Alguns módulos (Recrutamento, SST, Encarregados, BI) foram cadastrados em
-- app_menu sem NENHUMA linha de permissão em perfil_acesso_permissao —
-- por decisão explícita (ver 20260717190008_hotfix_recrutamento_sst_
-- encarregados_catalogo.sql: "a atribuição de quem acessa cada tela fica
-- 100% a cargo do painel, configurada manualmente depois"). Enquanto
-- ninguém configura nada lá, list_accessible_menus nega geral (correto pro
-- banco/RLS, mas ruim pro front: esconderia/bloquearia sem ninguém ter
-- decidido isso ainda).
--
-- Já o módulo Sistemas (Solicitações ERP) usa só screen_permission_user
-- (exceção por pessoa, sem perfil) — por isso "configurado" precisa olhar
-- as DUAS tabelas, não só perfil_acesso_permissao, senão o front trataria
-- Sistemas como "nunca configurado" e abriria pra todo mundo, quebrando a
-- regra "100% por usuário, sem regra de role" da migration 20260619000002.
--
-- Por que uma função SECURITY DEFINER: screen_permission_user só permite
-- SELECT da própria linha (ou admin) via RLS — um usuário comum não
-- consegue enxergar se ALGUÉM (não necessariamente ele) já foi configurado
-- pra um menu. Esta função só devolve o CÓDIGO do menu (não quem, não o
-- valor de allow), então não vaza nada sensível — só "isto já foi
-- configurado por alguém, para alguém, alguma vez".

CREATE OR REPLACE FUNCTION public.list_configured_menu_codes()
RETURNS TABLE(menu_codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT menu_codigo FROM public.perfil_acesso_permissao
  UNION
  SELECT DISTINCT menu_codigo FROM public.screen_permission_user
$$;
