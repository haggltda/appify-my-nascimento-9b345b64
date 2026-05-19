
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
VALUES ('808617a8-2d1e-41fb-b393-fdb57834fb88', 'acessos-permissoes', 'Acessos & Permissões', '/app/admin/permissoes', 99, true);

INSERT INTO public.screen_permission_profile (role, menu_codigo, acao, allow) VALUES
  ('controladoria', 'acessos-permissoes', 'visualizar', true),
  ('presidencia',   'acessos-permissoes', 'visualizar', true),
  ('controladoria', 'acessos-permissoes', 'incluir',    true),
  ('presidencia',   'acessos-permissoes', 'incluir',    true),
  ('controladoria', 'acessos-permissoes', 'alterar',    true),
  ('presidencia',   'acessos-permissoes', 'alterar',    true),
  ('controladoria', 'acessos-permissoes', 'excluir',    true),
  ('presidencia',   'acessos-permissoes', 'excluir',    true);
