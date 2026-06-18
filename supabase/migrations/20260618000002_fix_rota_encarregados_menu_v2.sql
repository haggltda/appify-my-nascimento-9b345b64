-- =========================================================================
-- FIX v2: a migration 20260618000001 filtrava por codigo = 'minhas_solicitacoes'
-- (sem acento), mas o formulário de criação de menu só faz lowercase + troca
-- espaço por "_" — NÃO remove acentos. O código real salvo ficou
-- 'minhas_solicitações' (com acento), então o UPDATE anterior não encontrou
-- nenhuma linha e a rota continuou errada ("app/encarregados", sem barra).
--
-- Aqui filtramos pela ROTA (que sabemos com certeza estar errada, visível no
-- painel), não pelo código — evita qualquer problema de acentuação.
-- =========================================================================

UPDATE public.app_menu
SET rota = '/app/encarregados'
WHERE TRIM(rota) = 'app/encarregados';
