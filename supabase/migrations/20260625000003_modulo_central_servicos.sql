-- Módulo "Central de Serviços": placeholder pra futuro desenvolvimento.
-- Por enquanto só cadastra o módulo + a tela em app_modulo/app_menu, com o
-- mesmo modelo de permissão por usuário de todo o resto do ERP (sem bypass de
-- role) — controlado em /app/administracao?tab=modulos. A rota em si
-- (/app/central-servicos) por ora só mostra uma página "em construção".

INSERT INTO public.app_modulo (codigo, nome, ordem, icone)
SELECT 'central_servicos', 'Central de Serviços',
       COALESCE((SELECT ordem FROM public.app_modulo WHERE codigo = 'sistemas'), 200) + 5,
       'Headset'
WHERE NOT EXISTS (SELECT 1 FROM public.app_modulo WHERE codigo = 'central_servicos');

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem
  FROM (VALUES
    ('central_servicos_dashboard', 'Central de Serviços', '/app/central-servicos', 10)
  ) AS x(codigo, nome, rota, ordem)
  JOIN public.app_modulo m ON m.codigo = 'central_servicos'
ON CONFLICT (modulo_id, codigo) DO NOTHING;
