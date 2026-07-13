-- Renomeia "Comitê Diretório" para "Diretório" — o dropdown de Comitê no
-- Plano de Ações passa a mostrar só o nome curto, sem repetir a palavra
-- "Comitê" (já é o título do campo).
UPDATE public.comite
   SET nome = 'Diretório'
 WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'
   AND nome = 'Comitê Diretório';
