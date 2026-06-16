
-- K/O-1B REV. C.1 — Substituir 3 policies de storage.objects do bucket pre-titulos-fiscal
DROP POLICY "auth read pretit fiscal bucket" ON storage.objects;
DROP POLICY "auth upload pretit fiscal bucket" ON storage.objects;
DROP POLICY "auth delete pretit fiscal bucket" ON storage.objects;

CREATE POLICY pretit_fiscal_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pre-titulos-fiscal'
  AND EXISTS (
    SELECT 1
    FROM public.pre_titulo_anexo a
    JOIN public.pre_titulo_pagar p ON p.id = a.pre_titulo_id
    WHERE a.storage_path = storage.objects.name
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND (
            public.has_role(auth.uid(), 'financeiro'::public.app_role)
            OR public.has_role(auth.uid(), 'controladoria'::public.app_role)
            OR public.has_role(auth.uid(), 'diretor_adm'::public.app_role)
            OR public.has_role(auth.uid(), 'gestor_cc'::public.app_role)
          )
        )
      )
  )
);

CREATE POLICY pretit_fiscal_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pre-titulos-fiscal'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND (
            public.has_role(auth.uid(), 'financeiro'::public.app_role)
            OR public.has_role(auth.uid(), 'controladoria'::public.app_role)
            OR public.has_role(auth.uid(), 'diretor_adm'::public.app_role)
            OR public.has_role(auth.uid(), 'gestor_cc'::public.app_role)
          )
        )
      )
  )
);

CREATE POLICY pretit_fiscal_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pre-titulos-fiscal'
  AND EXISTS (
    SELECT 1
    FROM public.pre_titulo_anexo a
    JOIN public.pre_titulo_pagar p ON p.id = a.pre_titulo_id
    WHERE a.storage_path = storage.objects.name
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND public.has_role(auth.uid(), 'financeiro'::public.app_role)
        )
      )
  )
);
