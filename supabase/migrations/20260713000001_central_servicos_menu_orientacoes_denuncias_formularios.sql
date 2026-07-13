-- Central de Serviços: cadastra em app_menu as 3 telas trazidas da branch
-- central-servicos-formularios (Orientações Jurídicas, Denúncias e Nascimento
-- Formulários), pra elas aparecerem na sidebar e passarem pelo RouteGuard.
-- Mesmo modelo de permissão por usuário do resto do ERP (sem bypass de role,
-- sem seed de acesso pra ninguém) — ver 20260706000001_modulo_central_servicos_reunioes.sql
-- pro padrão original. Liberação por usuário fica em /app/administracao?tab=modulos.
--
-- Sub-rotas de formulários (dashboard/config/:id/:id/respostas) são cobertas
-- por prefixo pelo RouteGuard a partir de central_servicos_formularios, igual
-- já acontece com reunioes/:id a partir de central_servicos_reunioes.

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem
  FROM (VALUES
    ('central_servicos_orientacoes', 'Orientações Jurídicas', '/app/central-servicos/orientacoes-juridicas', 40),
    ('central_servicos_denuncias', 'Denúncias (Canal de Ética)', '/app/central-servicos/denuncias', 50),
    ('central_servicos_formularios', 'Nascimento Formulários', '/app/central-servicos/formularios', 60)
  ) AS x(codigo, nome, rota, ordem)
  JOIN public.app_modulo m ON m.codigo = 'central_servicos'
ON CONFLICT (modulo_id, codigo) DO NOTHING;
