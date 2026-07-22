-- FASE 0 (hotfix emergencial) — regra_contabilizacao
--
-- Achado: regra_contab_select/regra_contab_mod (20260430023651) checam só
-- has_role(...) — a coluna empresa_id existe na tabela (NOT NULL) mas nunca
-- foi usada na policy. Qualquer usuário com role financeiro/fiscal/
-- controladoria/diretor_adm vê as regras de contabilização (mapeamento
-- débito/crédito por evento) de TODAS as empresas do grupo, não só da sua.
--
-- A tela que consome esta tabela (src/pages/contabil/RegrasContabilizacao.tsx)
-- não está roteada em src/App.tsx hoje — ninguém acessa via UI ainda, então
-- não há risco de quebrar uso corrente ao restringir. Em vez de só
-- readicionar empresa_id (o que seria regressivo frente à decisão de tirar
-- empresa do controle de acesso), já aplicamos o padrão final: gate por
-- menu_codigo via can_access(), igual ao resto do sistema. Cadastramos o
-- menu como "fantasma" (rota=NULL) porque a tela ainda não existe navegável;
-- se um dia for roteada, basta dar UPDATE em app_menu.rota.
--
-- Seed de continuidade: concede o novo menu, via screen_permission_profile,
-- às mesmas roles que a policy antiga já autorizava — ninguém que tinha
-- acesso por cargo perde acesso quando a tela for roteada no futuro.

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, 'contabil_regras_contabilizacao', 'Regras de Contabilização', NULL, 90, true
FROM public.app_modulo m
WHERE m.codigo = 'contabil'
ON CONFLICT (modulo_id, codigo) DO NOTHING;

INSERT INTO public.screen_permission_profile (role, menu_codigo, acao, allow)
SELECT r.role, 'contabil_regras_contabilizacao', a.acao::app_acao, true
FROM (VALUES ('controladoria'::app_role), ('financeiro'::app_role), ('fiscal'::app_role), ('diretor_adm'::app_role)) AS r(role)
CROSS JOIN (VALUES ('visualizar'), ('incluir'), ('alterar'), ('excluir')) AS a(acao)
ON CONFLICT (role, menu_codigo, acao) DO NOTHING;

DROP POLICY IF EXISTS regra_contab_select ON public.regra_contabilizacao;
CREATE POLICY regra_contab_select ON public.regra_contabilizacao FOR SELECT TO authenticated
USING (public.can_access(auth.uid(), 'contabil_regras_contabilizacao', 'visualizar'::app_acao));

DROP POLICY IF EXISTS regra_contab_mod ON public.regra_contabilizacao;
CREATE POLICY regra_contab_mod ON public.regra_contabilizacao FOR ALL TO authenticated
USING (public.can_access(auth.uid(), 'contabil_regras_contabilizacao', 'alterar'::app_acao))
WITH CHECK (public.can_access(auth.uid(), 'contabil_regras_contabilizacao', 'alterar'::app_acao));

-- Rollback: reverter para as policies antigas (reabre o vazamento cross-empresa
-- — só usar em emergência):
--
-- DROP POLICY IF EXISTS regra_contab_select ON public.regra_contabilizacao;
-- CREATE POLICY regra_contab_select ON public.regra_contabilizacao FOR SELECT TO authenticated
-- USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'fiscal') OR has_role(auth.uid(),'diretor_adm'));
-- DROP POLICY IF EXISTS regra_contab_mod ON public.regra_contabilizacao;
-- CREATE POLICY regra_contab_mod ON public.regra_contabilizacao FOR ALL TO authenticated
-- USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
-- WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'));

NOTIFY pgrst, 'reload schema';
