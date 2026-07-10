-- Atas de Reunião: bucket de storage pros anexos (arquivo de ata preenchida
-- à parte das respostas estruturadas). Path é "<reuniao_id>/<timestamp>-
-- <nome-sanitizado>" (mesmo padrão de uploadAnexo em SolicitacoesErp.tsx).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reunioes', 'reunioes', false, 26214400) -- 25 MB
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "reunioes anexo select" ON storage.objects;
CREATE POLICY "reunioes anexo select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reunioes' AND public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS "reunioes anexo insert" ON storage.objects;
CREATE POLICY "reunioes anexo insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reunioes' AND public.tem_acesso_menu('central_servicos_reunioes'));
