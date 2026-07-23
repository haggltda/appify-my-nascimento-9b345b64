-- Backfill: ações cujo responsável foi escolhido pelo dropdown (responsavel_profile_id
-- preenchido) nunca tiveram responsavel_nome_origem sincronizado, porque o onChange do
-- campo só atualizava o profile_id. Lista.tsx/Kanban.tsx exibem responsavel_nome_origem
-- (texto), então essas ações apareciam sem responsável visível mesmo com o vínculo certo.
-- Daqui pra frente o onChange já mantém os dois em sincronia (ver Detalhe.tsx); este
-- UPDATE só corrige o que já está salvo.
UPDATE public.plano_acao pa
   SET responsavel_nome_origem = p.display_name
  FROM public.profiles p
 WHERE pa.responsavel_profile_id = p.id
   AND p.display_name IS NOT NULL
   AND (pa.responsavel_nome_origem IS DISTINCT FROM p.display_name);
