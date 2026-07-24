-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — anexo de arquivo pelo respondente
--
-- Perguntas passam a poder pedir/aceitar um arquivo do respondente (config
-- `anexo_resp` na pergunta; a URL vai em CS_FORM_RESPOSTAS.itens sob a chave
-- `${pergunta_id}__anexo`). O upload usa o bucket `cs-formularios` que já
-- existe (público p/ leitura). Faltava deixar o respondente ANÔNIMO subir
-- arquivo (a policy de INSERT só valia p/ authenticated) e um teto de tamanho.
-- Idempotente.
-- =========================================================================

-- Respondente anônimo (formulário público sem login) pode subir arquivo.
DROP POLICY IF EXISTS cs_form_files_insert_anon ON storage.objects;
CREATE POLICY cs_form_files_insert_anon ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'cs-formularios');

-- Teto de 25MB no próprio bucket (trava server-side, além da checagem no client).
UPDATE storage.buckets SET file_size_limit = 26214400 WHERE id = 'cs-formularios';
