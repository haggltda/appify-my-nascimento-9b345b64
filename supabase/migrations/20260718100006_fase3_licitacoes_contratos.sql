-- FASE 3 (lote 5/6 — Licitações/Contratos) — remove has_role(admin)/empresa
-- da RLS.
--
-- Achado à parte (fora do escopo desta migration, por decisão do usuário):
-- existe uma 3ª função de gate, has_permissao(user,modulo,acao,menu), nunca
-- reescrita nas Fases 1/3 — ainda faz EXISTS(...role='admin') OR
-- role_permissions diretamente. Ela governa o bloco BDI/Composição
-- (bdi_versao/posto/verba_folha/item/aprovacao/snapshot), fornecedor_conta_
-- bancaria (Suprimentos) e colaborador_conta_bancaria (RH), além de estar
-- embutida via has_role(admin) direto no corpo de várias RPCs (
-- licitacao_assumir, licitacao_transferir, licitacao_importacao_*). Fica
-- para uma migration de complemento dedicada.
--
-- Também fora do escopo: licitacao_importacao_lote (sua única porta de
-- escrita são as RPCs acima, já sinalizadas para o complemento).
--
-- Mapeamento tabela → menu_codigo (confirmado via grep de hooks/páginas
-- que consomem cada tabela, não assumido):
--   licitacao, licitacao_responsavel_historico, grade  → 'pipeline'
--     (tela "Grade de Licitações" /app/licitacoes/grade, usa useGrade
--      sobre a tabela grade; licitacao é o registro mestre pós-decisão,
--      licitacao_responsavel_historico é o log de assumir/transferir)
--   capa_edital                                        → 'editais'
--     (tela "Capa de Edital" /app/editais — o app_menu.rota antigo
--      '/app/pipeline' e '/app/editais' já batem com as rotas atuais)
--   implantacao_contrato, checklist_items*, respostas  → 'implantacao'
--     (*checklist_items continua com USING(true) — tabela estática de
--      referência, mesmo tratamento dado a cfop/plano_contas_master)
--   contrato                                           → 'ativos'
--   contrato_posto                                     → 'postos'
--   contrato_dissidio, base_dissidio_categoria          → 'reajustes'
--   contrato_comprovacao                                → 'empenhos'

-- Corrige a rota desatualizada do menu 'pipeline' (era '/app/pipeline',
-- rota real hoje é '/app/licitacoes/grade') — só higiene, não afeta o gate.
UPDATE public.app_menu SET rota = '/app/licitacoes/grade'
 WHERE codigo = 'pipeline'
   AND modulo_id = (SELECT id FROM public.app_modulo WHERE codigo = 'licitacoes');

-- ── licitacao ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS lic_select ON public.licitacao;
CREATE POLICY lic_select ON public.licitacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'visualizar'::app_acao));
DROP POLICY IF EXISTS lic_insert ON public.licitacao;
CREATE POLICY lic_insert ON public.licitacao FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'pipeline', 'incluir'::app_acao));
DROP POLICY IF EXISTS lic_update ON public.licitacao;
CREATE POLICY lic_update ON public.licitacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'alterar'::app_acao));
DROP POLICY IF EXISTS lic_delete ON public.licitacao;
CREATE POLICY lic_delete ON public.licitacao FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'excluir'::app_acao));

-- ── licitacao_responsavel_historico (só tinha SELECT; escrita é via RPC,
--    fora do escopo desta migration) ─────────────────────────────────────
DROP POLICY IF EXISTS lic_resp_hist_select ON public.licitacao_responsavel_historico;
CREATE POLICY lic_resp_hist_select ON public.licitacao_responsavel_historico FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'visualizar'::app_acao));

-- ── base_dissidio_categoria ──────────────────────────────────────────────
DROP POLICY IF EXISTS bdc_select ON public.base_dissidio_categoria;
CREATE POLICY bdc_select ON public.base_dissidio_categoria FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.can_access(auth.uid(), 'reajustes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS bdc_insert ON public.base_dissidio_categoria;
CREATE POLICY bdc_insert ON public.base_dissidio_categoria FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'reajustes', 'incluir'::app_acao));
DROP POLICY IF EXISTS bdc_update ON public.base_dissidio_categoria;
CREATE POLICY bdc_update ON public.base_dissidio_categoria FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'reajustes', 'alterar'::app_acao));
DROP POLICY IF EXISTS bdc_delete ON public.base_dissidio_categoria;
CREATE POLICY bdc_delete ON public.base_dissidio_categoria FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'reajustes', 'excluir'::app_acao));

-- ── contrato ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ctr_select ON public.contrato;
CREATE POLICY ctr_select ON public.contrato FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'ativos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS ctr_insert ON public.contrato;
CREATE POLICY ctr_insert ON public.contrato FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'ativos', 'incluir'::app_acao));
DROP POLICY IF EXISTS ctr_update ON public.contrato;
CREATE POLICY ctr_update ON public.contrato FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'ativos', 'alterar'::app_acao));
DROP POLICY IF EXISTS ctr_delete ON public.contrato;
CREATE POLICY ctr_delete ON public.contrato FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'ativos', 'excluir'::app_acao));

-- ── contrato_posto ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cposto_select ON public.contrato_posto;
CREATE POLICY cposto_select ON public.contrato_posto FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'postos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS cposto_write ON public.contrato_posto;
CREATE POLICY cposto_write ON public.contrato_posto FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'postos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'postos', 'alterar'::app_acao));

-- ── contrato_dissidio ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS cdis_select ON public.contrato_dissidio;
CREATE POLICY cdis_select ON public.contrato_dissidio FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'reajustes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS cdis_write ON public.contrato_dissidio;
CREATE POLICY cdis_write ON public.contrato_dissidio FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'reajustes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'reajustes', 'alterar'::app_acao));

-- ── contrato_comprovacao ──────────────────────────────────────────────────
DROP POLICY IF EXISTS ccomp_select ON public.contrato_comprovacao;
CREATE POLICY ccomp_select ON public.contrato_comprovacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'empenhos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS ccomp_write ON public.contrato_comprovacao;
CREATE POLICY ccomp_write ON public.contrato_comprovacao FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'empenhos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'empenhos', 'alterar'::app_acao));

-- ── grade ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "grade_select" ON public.grade;
CREATE POLICY grade_select ON public.grade FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "grade_insert" ON public.grade;
CREATE POLICY grade_insert ON public.grade FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'pipeline', 'incluir'::app_acao));
DROP POLICY IF EXISTS "grade_update" ON public.grade;
CREATE POLICY grade_update ON public.grade FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'alterar'::app_acao));
DROP POLICY IF EXISTS "grade_delete" ON public.grade;
CREATE POLICY grade_delete ON public.grade FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'pipeline', 'excluir'::app_acao));

-- ── capa_edital ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "capa_select" ON public.capa_edital;
CREATE POLICY capa_select ON public.capa_edital FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'editais', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "capa_insert" ON public.capa_edital;
CREATE POLICY capa_insert ON public.capa_edital FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'editais', 'incluir'::app_acao));
DROP POLICY IF EXISTS "capa_update" ON public.capa_edital;
CREATE POLICY capa_update ON public.capa_edital FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'editais', 'alterar'::app_acao));
DROP POLICY IF EXISTS "capa_delete" ON public.capa_edital;
CREATE POLICY capa_delete ON public.capa_edital FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'editais', 'excluir'::app_acao));

-- ── implantacao_contrato (sem delete na versão original) ────────────────
DROP POLICY IF EXISTS "implantacao_select" ON public.implantacao_contrato;
CREATE POLICY implantacao_select ON public.implantacao_contrato FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'implantacao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "implantacao_insert" ON public.implantacao_contrato;
CREATE POLICY implantacao_insert ON public.implantacao_contrato FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'implantacao', 'incluir'::app_acao));
DROP POLICY IF EXISTS "implantacao_update" ON public.implantacao_contrato;
CREATE POLICY implantacao_update ON public.implantacao_contrato FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'implantacao', 'alterar'::app_acao));

-- ── respostas ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "respostas_select" ON public.respostas;
CREATE POLICY respostas_select ON public.respostas FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'implantacao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "respostas_insert" ON public.respostas;
CREATE POLICY respostas_insert ON public.respostas FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'implantacao', 'incluir'::app_acao));
DROP POLICY IF EXISTS "respostas_update" ON public.respostas;
CREATE POLICY respostas_update ON public.respostas FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'implantacao', 'alterar'::app_acao));

-- checklist_items: mantido USING(true) — tabela estática de referência,
-- não sofre alteração (mesmo tratamento de cfop/plano_contas_master).

NOTIFY pgrst, 'reload schema';
