INSERT INTO public.role_permissions (role, modulo, menu_codigo, acao) VALUES
('admin'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('admin'::app_role,'financeiro','conta_bancaria','incluir'::app_acao),
('admin'::app_role,'financeiro','conta_bancaria','alterar'::app_acao),
('admin'::app_role,'financeiro','conta_bancaria','excluir'::app_acao),
('admin'::app_role,'financeiro','conta_bancaria','exportar'::app_acao),
('diretor_adm'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('diretor_adm'::app_role,'financeiro','conta_bancaria','incluir'::app_acao),
('diretor_adm'::app_role,'financeiro','conta_bancaria','alterar'::app_acao),
('diretor_adm'::app_role,'financeiro','conta_bancaria','excluir'::app_acao),
('diretor_adm'::app_role,'financeiro','conta_bancaria','exportar'::app_acao),
('controladoria'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('controladoria'::app_role,'financeiro','conta_bancaria','incluir'::app_acao),
('controladoria'::app_role,'financeiro','conta_bancaria','alterar'::app_acao),
('controladoria'::app_role,'financeiro','conta_bancaria','excluir'::app_acao),
('controladoria'::app_role,'financeiro','conta_bancaria','exportar'::app_acao),
('presidencia'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('diretor_op'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('juridico'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('comercial'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('operacional'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('sst'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao),
('usuario'::app_role,'financeiro','conta_bancaria','visualizar'::app_acao)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('392cd6af-41c7-4730-a100-69bdd81b5d96','admin'::app_role)
ON CONFLICT DO NOTHING;