-- FASE 0 (hotfix emergencial) — JUR_DUVIDAS
--
-- JUR_DUVIDAS é, por design (ver comentário original em
-- 20260622000014_jur_duvidas.sql), uma base de conhecimento Q&A que
-- QUALQUER colaborador autenticado deve poder pesquisar/ler — isso não é
-- um bug e não deve ser fechado atrás de um menu/role. O problema real é
-- mais estreito: a policy de SELECT (USING (true)) nunca checava a coluna
-- "publicada" (default true, "aparece na biblioteca de pesquisa"), então
-- uma dúvida marcada como não-publicada (ex: ainda não revisada/aprovada
-- pelo Jurídico) também ficava visível pra qualquer um via API direta.
--
-- Fix: mantém leitura ampla para o que é público (publicada = true), e
-- restringe o que não é público ao próprio autor da pergunta ou a quem é
-- do Jurídico ativo (mesma função is_juridico_ativo() já usada nas
-- policies de UPDATE/DELETE desta tabela — quem responde precisa poder ver
-- tudo, inclusive o que ainda não foi publicado).

DROP POLICY IF EXISTS jur_duvidas_select ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_select ON public."JUR_DUVIDAS"
  FOR SELECT TO authenticated
  USING (
    publicada = true
    OR autor_id = auth.uid()
    OR public.is_juridico_ativo()
  );

-- Rollback: reverter para USING (true) (reabre a visibilidade de dúvidas
-- não publicadas para qualquer autenticado — só usar em emergência):
--
-- DROP POLICY IF EXISTS jur_duvidas_select ON public."JUR_DUVIDAS";
-- CREATE POLICY jur_duvidas_select ON public."JUR_DUVIDAS" FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
