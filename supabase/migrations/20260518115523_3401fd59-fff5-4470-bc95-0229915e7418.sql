-- Copy user_roles visitante -> usuario
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'usuario'::public.app_role
FROM public.user_roles
WHERE role = 'visitante'
ON CONFLICT (user_id, role) DO NOTHING;

-- Copy role_permissions visitante -> usuario
INSERT INTO public.role_permissions (role, modulo, acao, menu_codigo)
SELECT 'usuario'::public.app_role, modulo, acao, menu_codigo
FROM public.role_permissions
WHERE role = 'visitante'
ON CONFLICT DO NOTHING;
