
-- 1) Permissions per menu/screen: add nullable menu_codigo
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS menu_codigo text;

-- Replace unique constraint to include menu_codigo (treat NULL as distinct via expression index)
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_modulo_acao_key;
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_role_modulo_menu_acao_uniq
  ON public.role_permissions (role, modulo, COALESCE(menu_codigo, ''), acao);

-- 3) Avatar URL on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create public 'avatars' storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
CREATE POLICY "Avatars publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins manage any avatar" ON storage.objects;
CREATE POLICY "Admins manage any avatar"
  ON storage.objects FOR ALL
  USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'));
