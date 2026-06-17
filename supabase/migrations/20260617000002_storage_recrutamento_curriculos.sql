-- =========================================================================
-- STORAGE: bucket "Recrutamento" para currículos
--
-- Estrutura de pastas:  Recrutamento / curriculos / <arquivo>
-- Bucket PRIVADO (currículo tem dado pessoal — LGPD). Leitura via signed URL
-- para usuários autenticados. A integração do WhatsApp grava com service_role
-- (que ignora RLS).
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('Recrutamento', 'Recrutamento', false, 10485760)  -- 10 MB
ON CONFLICT (id) DO NOTHING;

-- Leitura (authenticated) ------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "recrutamento curriculos select"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'Recrutamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Upload (authenticated) -------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "recrutamento curriculos insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'Recrutamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update (authenticated) -------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "recrutamento curriculos update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'Recrutamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Delete (authenticated) -------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "recrutamento curriculos delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'Recrutamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
