-- FASE 1 (redesenho de acessos) — Backfill de perfis a partir do estado atual
--
-- Depois desta migration, a próxima (rewrite das funções de gate) vai parar
-- de olhar has_role(admin)/role_permissions/screen_permission_profile
-- diretamente. Este passo garante que ninguém perde acesso nesse instante:
-- tudo que hoje concede algo vira um perfil explícito, atribuído a quem já
-- tinha aquele cargo.
--
-- 1) Administrador Geral — concede_tudo=true, atribuído a todo mundo com
--    role 'admin' hoje. Substitui o antigo has_role(admin) bypass.
INSERT INTO public.perfil_acesso (nome, descricao, concede_tudo)
VALUES ('Administrador Geral', 'Acesso completo a todas as telas do ERP — equivalente ao antigo bypass de admin.', true)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.usuario_perfil_acesso (user_id, perfil_id)
SELECT ur.user_id, pa.id
FROM public.user_roles ur
JOIN public.perfil_acesso pa ON pa.nome = 'Administrador Geral'
WHERE ur.role = 'admin'::app_role
ON CONFLICT (user_id, perfil_id) DO NOTHING;

-- 2) Um perfil "Legado: <role>" por cargo que aparece em screen_permission_profile
--    ou role_permissions (exceto admin, já coberto acima com concede_tudo).
INSERT INTO public.perfil_acesso (nome, descricao)
SELECT DISTINCT 'Legado: ' || role::text, 'Gerado automaticamente a partir das permissões que o cargo "' || role::text || '" já tinha.'
FROM (
  SELECT role FROM public.screen_permission_profile WHERE role <> 'admin'::app_role
  UNION
  SELECT role FROM public.role_permissions WHERE role <> 'admin'::app_role
) roles
ON CONFLICT (nome) DO NOTHING;

-- 2a) Popula a partir de screen_permission_profile (allow=true apenas).
INSERT INTO public.perfil_acesso_permissao (perfil_id, menu_codigo, acao, allow)
SELECT pa.id, spp.menu_codigo, spp.acao, true
FROM public.screen_permission_profile spp
JOIN public.perfil_acesso pa ON pa.nome = 'Legado: ' || spp.role::text
WHERE spp.role <> 'admin'::app_role AND spp.allow = true
ON CONFLICT (perfil_id, menu_codigo, acao) DO NOTHING;

-- 2b) Popula a partir de role_permissions, expandindo modulo='*' e
--     modulo=<x> para os app_menu.codigo ativos correspondentes (rp.menu_codigo
--     específico, quando presente, é usado direto, sem expandir).
INSERT INTO public.perfil_acesso_permissao (perfil_id, menu_codigo, acao, allow)
SELECT DISTINCT pa.id, am.codigo, rp.acao, true
FROM public.role_permissions rp
JOIN public.perfil_acesso pa ON pa.nome = 'Legado: ' || rp.role::text
JOIN public.app_menu am ON am.ativo = true
JOIN public.app_modulo mo ON mo.id = am.modulo_id
WHERE rp.role <> 'admin'::app_role
  AND rp.menu_codigo IS NULL
  AND (rp.modulo = '*' OR rp.modulo = mo.codigo)
ON CONFLICT (perfil_id, menu_codigo, acao) DO NOTHING;

INSERT INTO public.perfil_acesso_permissao (perfil_id, menu_codigo, acao, allow)
SELECT DISTINCT pa.id, rp.menu_codigo, rp.acao, true
FROM public.role_permissions rp
JOIN public.perfil_acesso pa ON pa.nome = 'Legado: ' || rp.role::text
WHERE rp.role <> 'admin'::app_role AND rp.menu_codigo IS NOT NULL
ON CONFLICT (perfil_id, menu_codigo, acao) DO NOTHING;

-- 3) Atribui cada perfil "Legado: <role>" a todo user_id que tem aquele role hoje.
INSERT INTO public.usuario_perfil_acesso (user_id, perfil_id)
SELECT DISTINCT ur.user_id, pa.id
FROM public.user_roles ur
JOIN public.perfil_acesso pa ON pa.nome = 'Legado: ' || ur.role::text
WHERE ur.role <> 'admin'::app_role
ON CONFLICT (user_id, perfil_id) DO NOTHING;

-- Rollback: DELETE FROM usuario_perfil_acesso; DELETE FROM perfil_acesso_permissao;
-- DELETE FROM perfil_acesso; (a próxima migration, que passa a depender destes
-- dados, precisa ser revertida junto).
