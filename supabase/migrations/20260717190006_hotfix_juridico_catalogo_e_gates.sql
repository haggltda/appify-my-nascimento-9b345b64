-- FASE 0 (hotfix emergencial) — módulo Jurídico
--
-- O módulo "Jurídico" (Processos, Patrimônios, Central de Dúvidas,
-- Advertências, Verificação de Candidatos) nunca foi cadastrado em
-- app_modulo/app_menu — por isso o painel "Acesso por Usuário" nunca teve
-- como controlar nada aqui. Cadastramos o catálogo e gateamos as tabelas
-- cujo consumo é 100% interno ao Jurídico (confirmado por mapeamento de
-- todo o front-end: JUR_PROCESSOS/JUR_PROCESSOS_DORT só são lidas por
-- Processos.tsx; JUR_PATRIMONIOS e as 2 tabelas relacionadas só por
-- Patrimonios.tsx; JUR_DUVIDAS_APROVADORES/RESPONSAVEIS só por
-- CentralDuvidas.tsx — nenhuma delas é usada fora do módulo). A tabela
-- JUR_DUVIDAS (pergunta/resposta) e SISTEMA_SOLICITACOES_ADVERTENCIA são
-- tratadas em migrations separadas porque têm consumidores fora do
-- Jurídico e não podem usar um gate simples de menu.
--
-- Seed de continuidade: concede os menus novos, via screen_permission_profile,
-- pra role 'juridico' (e 'diretor_adm', que já era usado como co-admin em
-- outras tabelas do sistema) — ninguém que já trabalha com isso hoje perde
-- acesso quando isso for aplicado.

INSERT INTO public.app_modulo (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('juridico', 'Jurídico', 'Processos, patrimônios, dúvidas e advertências', 'Scale', 110, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem, true
FROM public.app_modulo m, (VALUES
  ('processos',   'Processos',               '/app/juridico/processos',    10),
  ('patrimonios', 'Patrimônios',              '/app/juridico/patrimonios',  20),
  ('duvidas',     'Parecer Jurídico',         '/app/juridico/duvidas',      30),
  ('advertencias','Advertências',             '/app/juridico/advertencias', 40),
  ('candidatos',  'Verificação de Candidatos','/app/juridico/candidatos',   50)
) AS x(codigo, nome, rota, ordem)
WHERE m.codigo = 'juridico'
ON CONFLICT (modulo_id, codigo) DO NOTHING;

INSERT INTO public.screen_permission_profile (role, menu_codigo, acao, allow)
SELECT r.role, x.codigo, a.acao::app_acao, true
FROM (VALUES ('juridico'::app_role), ('diretor_adm'::app_role)) AS r(role)
CROSS JOIN (VALUES ('processos'), ('patrimonios'), ('duvidas'), ('advertencias'), ('candidatos')) AS x(codigo)
CROSS JOIN (VALUES ('visualizar'), ('incluir'), ('alterar'), ('excluir')) AS a(acao)
ON CONFLICT (role, menu_codigo, acao) DO NOTHING;

-- JUR_PROCESSOS + JUR_PROCESSOS_DORT (Processos.tsx, todas as 3 abas/rotas)
DROP POLICY IF EXISTS "JUR_PROCESSOS_all_auth" ON public."JUR_PROCESSOS";
CREATE POLICY jur_processos_gate ON public."JUR_PROCESSOS" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'processos', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'processos', 'incluir'::app_acao) OR public.has_screen_access(auth.uid(), 'processos', 'alterar'::app_acao));

DROP POLICY IF EXISTS "JUR_PROCESSOS_DORT_all_auth" ON public."JUR_PROCESSOS_DORT";
CREATE POLICY jur_processos_dort_gate ON public."JUR_PROCESSOS_DORT" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'processos', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'processos', 'incluir'::app_acao) OR public.has_screen_access(auth.uid(), 'processos', 'alterar'::app_acao));

-- JUR_PATRIMONIOS + JUR_PATRIMONIO_OBRIGACOES + JUR_PATRIMONIO_ITENS (Patrimonios.tsx)
DROP POLICY IF EXISTS "JUR_PATRIMONIOS_all_auth" ON public."JUR_PATRIMONIOS";
CREATE POLICY jur_patrimonios_gate ON public."JUR_PATRIMONIOS" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'patrimonios', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'patrimonios', 'incluir'::app_acao) OR public.has_screen_access(auth.uid(), 'patrimonios', 'alterar'::app_acao));

DROP POLICY IF EXISTS "JUR_PATRIMONIO_OBRIGACOES_all_auth" ON public."JUR_PATRIMONIO_OBRIGACOES";
CREATE POLICY jur_patrimonio_obrigacoes_gate ON public."JUR_PATRIMONIO_OBRIGACOES" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'patrimonios', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'patrimonios', 'incluir'::app_acao) OR public.has_screen_access(auth.uid(), 'patrimonios', 'alterar'::app_acao));

DROP POLICY IF EXISTS "JUR_PATRIMONIO_ITENS_all_auth" ON public."JUR_PATRIMONIO_ITENS";
CREATE POLICY jur_patrimonio_itens_gate ON public."JUR_PATRIMONIO_ITENS" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'patrimonios', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'patrimonios', 'incluir'::app_acao) OR public.has_screen_access(auth.uid(), 'patrimonios', 'alterar'::app_acao));

-- JUR_DUVIDAS_APROVADORES + JUR_DUVIDAS_RESPONSAVEIS (config interna de CentralDuvidas.tsx —
-- diferente de JUR_DUVIDAS em si, que continua com leitura ampla, ver migration 20260717190004)
DROP POLICY IF EXISTS jur_duvidas_aprov_all ON public."JUR_DUVIDAS_APROVADORES";
CREATE POLICY jur_duvidas_aprovadores_gate ON public."JUR_DUVIDAS_APROVADORES" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'duvidas', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'duvidas', 'alterar'::app_acao));

DROP POLICY IF EXISTS jur_duvidas_resp_all ON public."JUR_DUVIDAS_RESPONSAVEIS";
CREATE POLICY jur_duvidas_responsaveis_gate ON public."JUR_DUVIDAS_RESPONSAVEIS" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'duvidas', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'duvidas', 'alterar'::app_acao));

-- Nomes de policy confirmados por leitura direta das migrations de origem
-- (20260622000016_consolidar_e_renomear_tabelas.sql recria "<TABELA>_all_auth"
-- com o nome NOVO da tabela após o rename; 20260622000021/20260629000003
-- usam os nomes abreviados jur_duvidas_aprov_all/jur_duvidas_resp_all).
-- Ainda assim, antes de aplicar em produção, confirme no SQL Editor:
--   select tablename, policyname from pg_policies where tablename in
--   ('JUR_PROCESSOS','JUR_PROCESSOS_DORT','JUR_PATRIMONIOS','JUR_PATRIMONIO_OBRIGACOES',
--    'JUR_PATRIMONIO_ITENS','JUR_DUVIDAS_APROVADORES','JUR_DUVIDAS_RESPONSAVEIS');
-- Se algum nome não bater, o DROP POLICY IF EXISTS correspondente vira no-op
-- silencioso (não erro) e a policy antiga permissiva continua ativa em paralelo.

NOTIFY pgrst, 'reload schema';
