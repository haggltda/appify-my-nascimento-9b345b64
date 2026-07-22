-- FASE 0 (hotfix emergencial) — Recrutamento, SST, Encarregados
--
-- Cadastra o catálogo (módulos + menus) que faltava pra essas telas — igual
-- ao Jurídico na migration 006, nenhuma delas tinha entrada em app_modulo/
-- app_menu. Diferente de todas as migrations anteriores desta Fase 0,
-- ESTA NÃO SEMEIA NENHUM screen_permission_profile: por decisão do dono do
-- produto, a atribuição de quem acessa cada tela fica 100% a cargo do
-- painel "Acesso por Usuário" (/app/administracao?tab=modulos), configurada
-- manualmente depois. Isso significa que, assim que esta migration rodar,
-- QUALQUER usuário não-admin perde acesso a estas 4 telas até alguém
-- liberar explicitamente no painel — é o comportamento pretendido, não um
-- bug, mas precisa de ação imediata no painel pra não travar o uso diário.
--
-- Limitação conhecida (documentada, não resolvida aqui): RLS não faz
-- distinção por COLUNA. WA_CURRICULOS tem campos de SST (sst_ok, sst_obs)
-- e de Jurídico (juridico_ok/possui_restricao) na mesma linha — o gate
-- abaixo controla quem pode dar UPDATE na LINHA inteira, não impede um
-- usuário de SST de editar um campo jurídico se ele tiver o menu 'sst_aso'.
-- Separar por coluna exigiria views próprias por módulo — fica para uma
-- fase futura, fora deste hotfix.
--
-- VW_RECRUTAMENTO_CANDIDATOS: aplicamos security_invoker=true independente
-- do resultado do diagnóstico pedido — é seguro fazer isso sempre (é a
-- prática recomendada pra views sobre tabelas com RLS) e, se a view já
-- estava correta, este ALTER não muda nada; se estava ignorando a RLS da
-- base, corrige.

INSERT INTO public.app_modulo (codigo, nome, descricao, icone, ordem, ativo) VALUES
  ('recrutamento', 'Recrutamento e Seleção', 'Vagas, candidatos e contratações', 'UserCog', 120, true),
  ('sst', 'SST', 'Saúde e Segurança do Trabalho', 'HardHat', 130, true),
  ('encarregados', 'Encarregados', 'Solicitações e históricos', 'HardHat', 140, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem, true
FROM public.app_modulo m, (VALUES
  ('recrutamento', 'recrutamento_gestao', 'Recrutamento e Seleção', '/app/rh/recrutamento', 10),
  ('sst',          'sst_aso',             'ASO / Admissão',         '/app/sst/aso',         10),
  ('encarregados', 'encarregados_minhas_solicitacoes', 'Minhas Solicitações', '/app/encarregados/minhas-solicitacoes', 10)
) AS x(modulo_codigo, codigo, nome, rota, ordem)
WHERE m.codigo = x.modulo_codigo
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- Corrige a view para respeitar a RLS das tabelas base (ver nota acima).
ALTER VIEW public."VW_RECRUTAMENTO_CANDIDATOS" SET (security_invoker = true);

-- SISTEMA_RECRUTAMENTO (vaga) — RH gerencia; Encarregado cria/acompanha a própria
-- (sem coluna de identidade confiável — solicitante_nome/cpf são texto solto,
-- então "a própria" continua sendo filtrado no client, como já era; o gate
-- aqui só controla o módulo).
DROP POLICY IF EXISTS sr_all_auth ON public."SISTEMA_RECRUTAMENTO";
CREATE POLICY sistema_recrutamento_gate ON public."SISTEMA_RECRUTAMENTO" FOR ALL TO authenticated
  USING (
    public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'encarregados_minhas_solicitacoes', 'visualizar'::app_acao)
  )
  WITH CHECK (
    public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'incluir'::app_acao)
    OR public.has_screen_access(auth.uid(), 'encarregados_minhas_solicitacoes', 'incluir'::app_acao)
  );

-- WA_MENSAGENS_RECRUTAMENTO — só usado por Recrutamento.tsx (RH)
DROP POLICY IF EXISTS wamr_all_auth ON public."WA_MENSAGENS_RECRUTAMENTO";
CREATE POLICY wa_mensagens_recrutamento_gate ON public."WA_MENSAGENS_RECRUTAMENTO" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'incluir'::app_acao));

-- WA_CURRICULOS (candidato) — lido/editado por RH, SST e Jurídico (ver limitação de coluna acima)
DROP POLICY IF EXISTS wac_all_auth ON public."WA_CURRICULOS";
CREATE POLICY wa_curriculos_gate ON public."WA_CURRICULOS" FOR ALL TO authenticated
  USING (
    public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'sst_aso', 'visualizar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'candidatos', 'visualizar'::app_acao)
  )
  WITH CHECK (
    public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'alterar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'sst_aso', 'alterar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'candidatos', 'alterar'::app_acao)
  );

-- RECRUTAMENTO_CPF_BLACKLIST — leitura para os 3 módulos; ESCRITA só Jurídico
-- (é o que o comentário original do código já dizia ser a intenção: "só
-- Jurídico decide restrição" — RH deixa de conseguir upsert/delete aqui,
-- por design, mesmo que a tela de Recrutamento ainda tenha o botão).
-- Duas policies antigas se acumularam aqui (a segunda, 20260705000001, só
-- dropava "rec_cpf_bl_all" e esqueceu de dropar "rcb_all_auth" da migration
-- original 20260619000002 — mesmo padrão de policy órfã já visto em
-- fornecedor_conta_bancaria). Removendo as duas.
DROP POLICY IF EXISTS rcb_all_auth ON public."RECRUTAMENTO_CPF_BLACKLIST";
DROP POLICY IF EXISTS rec_cpf_bl_all ON public."RECRUTAMENTO_CPF_BLACKLIST";
CREATE POLICY recrutamento_cpf_blacklist_select ON public."RECRUTAMENTO_CPF_BLACKLIST" FOR SELECT TO authenticated
  USING (
    public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'sst_aso', 'visualizar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'candidatos', 'visualizar'::app_acao)
  );
CREATE POLICY recrutamento_cpf_blacklist_write ON public."RECRUTAMENTO_CPF_BLACKLIST" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'candidatos', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'candidatos', 'alterar'::app_acao));

-- RECRUTAMENTO_ENTREVISTA — só RH (Recrutamento.tsx)
DROP POLICY IF EXISTS rec_entrev_all ON public."RECRUTAMENTO_ENTREVISTA";
CREATE POLICY recrutamento_entrevista_gate ON public."RECRUTAMENTO_ENTREVISTA" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'incluir'::app_acao));

-- RECRUTAMENTO_CANDIDATO_ARQUIVOS — só RH (BancoTalentos.tsx)
DROP POLICY IF EXISTS rec_cand_arq_all ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS";
CREATE POLICY recrutamento_candidato_arquivos_gate ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'incluir'::app_acao));

-- RECRUTAMENTO_HISTORICO — log compartilhado: os 4 módulos gravam, só RH lê o dashboard
DROP POLICY IF EXISTS rec_hist_all ON public."RECRUTAMENTO_HISTORICO";
CREATE POLICY recrutamento_historico_select ON public."RECRUTAMENTO_HISTORICO" FOR SELECT TO authenticated
  USING (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao));
CREATE POLICY recrutamento_historico_insert ON public."RECRUTAMENTO_HISTORICO" FOR INSERT TO authenticated
  WITH CHECK (
    public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'incluir'::app_acao)
    OR public.has_screen_access(auth.uid(), 'sst_aso', 'incluir'::app_acao)
    OR public.has_screen_access(auth.uid(), 'candidatos', 'incluir'::app_acao)
    OR public.has_screen_access(auth.uid(), 'encarregados_minhas_solicitacoes', 'incluir'::app_acao)
  );

-- SISTEMA_RECRUTAMENTO_STATUS_LOG — só o dashboard de RH lê
DROP POLICY IF EXISTS srsl_all_auth ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG";
CREATE POLICY sistema_recrutamento_status_log_gate ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG" FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao))
  WITH CHECK (public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'incluir'::app_acao));

-- RECRUTAMENTO_EPIS — zero consumidor confirmado no mapeamento (achado do audit
-- de tabelas sem uso); trava pra qualquer authenticated, só admin mexe.
DROP POLICY IF EXISTS rec_epis_all ON public."RECRUTAMENTO_EPIS";
CREATE POLICY recrutamento_epis_admin_only ON public."RECRUTAMENTO_EPIS" FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Rollback: recriar cada "<TABELA>_all_auth" FOR ALL TO authenticated USING(true)
-- WITH CHECK(true), e ALTER VIEW ... SET (security_invoker = false) se necessário.

NOTIFY pgrst, 'reload schema';
