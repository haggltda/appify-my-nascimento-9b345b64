-- Renomeia "Comitê Diretório"/"Diretório" para "Diretivo" — cobre tanto o
-- nome original quanto o rename anterior (20260710000006), caso já exista
-- alguma ação usando qualquer uma das duas grafias.
UPDATE public.comite
   SET nome = 'Diretivo'
 WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'
   AND nome IN ('Comitê Diretório', 'Diretório');

-- Backfill: o filtro de Comitê na Lista lê direto do texto salvo em
-- plano_acao.comite (fonte independente da tabela comite), então sem isso
-- o filtro continuaria mostrando o nome antigo pras ações já criadas.
UPDATE public.plano_acao
   SET comite = 'Diretivo'
 WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'
   AND comite IN ('Comitê Diretório', 'Diretório');
