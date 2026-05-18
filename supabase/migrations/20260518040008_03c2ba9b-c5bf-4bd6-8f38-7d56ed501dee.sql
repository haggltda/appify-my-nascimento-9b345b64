
-- PR-2 REV 3: Storage bucket privado + policies SELECT + índice file_sha256

-- 1) Bucket privado fcr-uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('fcr-uploads', 'fcr-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Policies SELECT em storage.objects (sem INSERT/UPDATE/DELETE para authenticated)

DROP POLICY IF EXISTS "fcr_uploads_select_global" ON storage.objects;
CREATE POLICY "fcr_uploads_select_global"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fcr-uploads'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'presidencia'::app_role)
    OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  )
);

DROP POLICY IF EXISTS "fcr_uploads_select_empresa" ON storage.objects;
CREATE POLICY "fcr_uploads_select_empresa"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fcr-uploads'
  AND (storage.foldername(name))[1] <> 'consolidado'
  AND (storage.foldername(name))[1] = public.get_user_empresa(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'controladoria'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  )
);

-- 3) Índice para detecção de duplicidade por file_sha256
CREATE INDEX IF NOT EXISTS idx_fcr_batch_file_sha256
ON public.fcr_batch ((totais_excel->>'file_sha256'));
