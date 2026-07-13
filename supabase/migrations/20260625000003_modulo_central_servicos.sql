-- Módulo "Central de Serviços": cadastra só o módulo em app_modulo, com o
-- mesmo modelo de permissão por usuário de todo o resto do ERP (sem bypass de
-- role) — controlado em /app/administracao?tab=modulos.
-- A tela do hub (/app/central-servicos) é cadastrada UMA única vez em
-- 20260710000003 (guardada por rota) — a linha duplicada que esta migration
-- criava foi removida em 20260710000002.

INSERT INTO public.app_modulo (codigo, nome, ordem, icone)
SELECT 'central_servicos', 'Central de Serviços',
       COALESCE((SELECT ordem FROM public.app_modulo WHERE codigo = 'sistemas'), 200) + 5,
       'Headset'
WHERE NOT EXISTS (SELECT 1 FROM public.app_modulo WHERE codigo = 'central_servicos');
