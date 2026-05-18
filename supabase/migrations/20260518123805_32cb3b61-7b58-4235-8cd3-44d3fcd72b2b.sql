INSERT INTO public.user_roles (user_id, role)
VALUES ('03f387e8-9d22-4ac4-985d-c787c562e610', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = '03f387e8-9d22-4ac4-985d-c787c562e610'
  AND role <> 'admin';