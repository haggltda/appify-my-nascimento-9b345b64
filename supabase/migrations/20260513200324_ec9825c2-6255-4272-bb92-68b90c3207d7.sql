
INSERT INTO public.app_modulo (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('plano_acoes', 'Plano de Ações', 'Planos de ação, kanban e aprovações', 'ListChecks', 75, true)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, ativo = true;

WITH m AS (SELECT id FROM public.app_modulo WHERE codigo = 'plano_acoes')
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem, true
FROM m, (VALUES
  ('plano_acoes_lista',         'Lista de planos',  '/app/plano-acoes',                10),
  ('plano_acoes_dashboard',     'Dashboard',        '/app/plano-acoes/dashboard',      20),
  ('plano_acoes_kanban',        'Kanban',           '/app/plano-acoes/kanban',         30),
  ('plano_acoes_importar',      'Importar',         '/app/plano-acoes/importar',       40),
  ('plano_acoes_aprovacoes',    'Aprovações',       '/app/plano-acoes/aprovacoes',     50),
  ('plano_acoes_configuracoes', 'Configurações',    '/app/plano-acoes/configuracoes',  60)
) AS x(codigo, nome, rota, ordem)
ON CONFLICT (modulo_id, codigo) DO UPDATE SET nome = EXCLUDED.nome, rota = EXCLUDED.rota, ordem = EXCLUDED.ordem, ativo = true;
