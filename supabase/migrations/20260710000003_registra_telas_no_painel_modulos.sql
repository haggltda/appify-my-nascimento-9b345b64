-- =========================================================================
-- GOVERNANÇA DE ACESSO — cadastra as telas novas no painel Módulos & Menus
--
-- REGRA DO PROJETO: todo acesso é gerenciado em /app/administracao?tab=modulos
-- (app_modulo/app_menu + screen_permission_user). Rota nova = tela cadastrada
-- em app_menu; liberação por usuário no painel. Nada de allowlist no código.
--
-- Esta migration formaliza as telas criadas na branch (RH/Recrutamento, SST,
-- Jurídico e Central de Serviços). Os INSERTs são guardados por ROTA
-- (NOT EXISTS em app_menu.rota): se a tela já foi cadastrada manualmente pelo
-- painel, nada é duplicado — evita repetir o caso da rota duplicada do hub.
--
-- Central de Serviços: o hub e as Orientações Jurídicas são de acesso geral,
-- então além do cadastro há seed de 'visualizar' para TODOS os usuários
-- atuais (a RPC list_accessible_menus exige allow=true explícito por usuário,
-- sem bypass de role). Usuários novos: liberar no painel, como o resto.
-- Denúncias segue restrita (seed só de admins em 20260709000005 + RLS).
-- =========================================================================

-- 1. Módulos que ainda não existem por migration (podem já existir se
--    criados pelo painel — guardado por codigo).
INSERT INTO public.app_modulo (codigo, nome, ordem, icone)
SELECT x.codigo, x.nome, x.ordem, x.icone
  FROM (VALUES
    ('juridico', 'Jurídico', 72, 'Scale'),
    ('sst',      'SST',      74, 'HardHat')
  ) AS x(codigo, nome, ordem, icone)
 WHERE NOT EXISTS (SELECT 1 FROM public.app_modulo m WHERE m.codigo = x.codigo);

-- 2. Telas novas da branch, guardadas por rota (não duplica cadastro manual).
--    Sub-rotas (ex.: /app/juridico/processos/dashboard) são cobertas pela
--    tela-pai via match por prefixo do RouteGuard.
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem
  FROM (VALUES
    ('central_servicos', 'central_servicos_hub',         'Central de Serviços (hub)',      '/app/central-servicos',                       10),
    ('central_servicos', 'central_servicos_orientacoes', 'Orientações Jurídicas',          '/app/central-servicos/orientacoes-juridicas', 15),
    ('rh',               'rh_recrutamento',              'Recrutamento & Seleção',         '/app/rh/recrutamento',                        40),
    ('rh',               'rh_recrutamento_dashboard',    'Dashboard de Recrutamento',      '/app/rh/recrutamento-dashboard',              41),
    ('rh',               'rh_banco_talentos',            'Banco de Talentos',              '/app/rh/banco-talentos',                      42),
    ('rh',               'rh_novas_admissoes',           'Novas Admissões',                '/app/rh/novas-admissoes',                     43),
    ('rh',               'rh_ferias',                    'Férias',                         '/app/rh/ferias',                              44),
    ('sst',              'sst_aso',                      'ASO / Admissão (Exame Médico)',  '/app/sst/aso',                                10),
    ('juridico',         'juridico_patrimonios',         'Gestão Patrimonial',             '/app/juridico/patrimonios',                   10),
    ('juridico',         'juridico_processos',           'Processos Jurídicos',            '/app/juridico/processos',                     20),
    ('juridico',         'juridico_advertencias',        'Advertências',                   '/app/juridico/advertencias',                  30),
    ('juridico',         'juridico_candidatos',          'Verificação de Candidatos',      '/app/juridico/candidatos',                    40),
    ('juridico',         'juridico_duvidas',             'Central de Dúvidas Jurídicas',   '/app/juridico/duvidas',                       50)
  ) AS x(modulo, codigo, nome, rota, ordem)
  JOIN public.app_modulo m ON m.codigo = x.modulo
 WHERE NOT EXISTS (SELECT 1 FROM public.app_menu am WHERE am.rota = x.rota);

-- 3. Central de Serviços aberta a todos: seed de 'visualizar' para todos os
--    usuários atuais nas telas do hub e das Orientações (pega qualquer codigo
--    cadastrado nessas rotas, inclusive linhas criadas manualmente).
--    NOT EXISTS em vez de ON CONFLICT: a UNIQUE trata empresa_id NULL como
--    distinto e não deduplicaria as linhas globais.
INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id, motivo)
SELECT u.id, am.codigo, 'visualizar'::public.app_acao, true, NULL,
       'Central de Serviços: acesso geral (hub e Orientações Jurídicas)'
  FROM auth.users u
 CROSS JOIN public.app_menu am
 WHERE am.rota IN ('/app/central-servicos', '/app/central-servicos/orientacoes-juridicas')
   AND NOT EXISTS (
         SELECT 1 FROM public.screen_permission_user s
          WHERE s.user_id     = u.id
            AND s.menu_codigo = am.codigo
            AND s.acao        = 'visualizar'::public.app_acao
            AND s.empresa_id IS NULL
       );

NOTIFY pgrst, 'reload schema';
