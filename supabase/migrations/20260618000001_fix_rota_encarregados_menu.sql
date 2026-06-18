-- =========================================================================
-- FIX: rota do menu "minhas_solicitacoes" (módulo Encarregados) estava salva
-- sem a barra inicial ("app/encarregados" em vez de "/app/encarregados"),
-- impedindo que matchMenuCode() reconhecesse a rota real do app e tornando
-- o switch de permissão no painel "Acesso por Usuário" inerte.
-- =========================================================================

UPDATE public.app_menu
SET rota = '/app/encarregados'
WHERE codigo = 'minhas_solicitacoes'
  AND rota = 'app/encarregados';
