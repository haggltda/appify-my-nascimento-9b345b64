-- Inserir perfil 'usuario' em perfil_metadata
INSERT INTO public.perfil_metadata (role, descricao, icone, cor)
VALUES ('usuario', 'Usuário padrão do sistema (acesso liberado por permissão)', 'User', '#3b6fa0')
ON CONFLICT (role) DO NOTHING;

-- Copiar permissões base de visitante -> usuario
INSERT INTO public.role_permissions (role, modulo, menu_codigo, acao)
SELECT 'usuario'::public.app_role, modulo, menu_codigo, acao
FROM public.role_permissions
WHERE role = 'visitante'
ON CONFLICT DO NOTHING;

-- Migrar usuários remanescentes de visitante -> usuario
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'usuario'::public.app_role
FROM public.user_roles
WHERE role = 'visitante'
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles WHERE role = 'visitante';

-- Marcar visitante como depreciado
UPDATE public.perfil_metadata
SET descricao = '(Depreciado — use "Usuário")', cor = '#cbd5e1'
WHERE role = 'visitante';