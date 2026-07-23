-- FASE 3 (lote 7a — varredura de complemento) — Controladoria/Orçamento e
-- tabelas de configuração do painel admin que ficaram de fora do lote 1
-- porque não estavam no mesmo arquivo/lote de "tabelas principais da tela".
--
-- fluxo_caixa_projetado/cronograma_faturamento/aprov_etapa/aprov_instancia/
-- solicitacao_desbloqueio são sub-tabelas do fluxo de Orçamento de Contrato
-- (referenciam orcamento_contrato/orcamento_contrato_linha, já corrigidas no
-- lote 1) — usam o mesmo menu 'orcamento'.
--
-- alcada_aprovacao/parametro_geral/ocorrencia_operacional/identidade_visual
-- são as 4 abas de configuração dentro de /app/administracao
-- (AlcadasTab/ParametrosTab/OcorrenciasTab/IdentidadeTab) — menu
-- 'administracao', confirmado em app_menu (20260513192434).
--
-- Nenhuma das 9 tabelas teve policy redefinida depois da criação original
-- (20260429194546 / 20260513192434) — confirmado via grep, sem risco de
-- policy órfã aqui.

-- ── fluxo_caixa_projetado ────────────────────────────────────────────────
DROP POLICY IF EXISTS "fcp_select" ON public.fluxo_caixa_projetado;
CREATE POLICY fcp_select ON public.fluxo_caixa_projetado FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "fcp_write" ON public.fluxo_caixa_projetado;
CREATE POLICY fcp_write ON public.fluxo_caixa_projetado FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

-- ── cronograma_faturamento ───────────────────────────────────────────────
DROP POLICY IF EXISTS "cf_select" ON public.cronograma_faturamento;
CREATE POLICY cf_select ON public.cronograma_faturamento FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "cf_write" ON public.cronograma_faturamento;
CREATE POLICY cf_write ON public.cronograma_faturamento FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

-- ── aprov_etapa ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ae_select" ON public.aprov_etapa;
CREATE POLICY ae_select ON public.aprov_etapa FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "ae_write" ON public.aprov_etapa;
CREATE POLICY ae_write ON public.aprov_etapa FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

-- ── aprov_instancia ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ai_select" ON public.aprov_instancia;
CREATE POLICY ai_select ON public.aprov_instancia FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "ai_write" ON public.aprov_instancia;
CREATE POLICY ai_write ON public.aprov_instancia FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

-- ── solicitacao_desbloqueio ──────────────────────────────────────────────
DROP POLICY IF EXISTS "sd_select" ON public.solicitacao_desbloqueio;
CREATE POLICY sd_select ON public.solicitacao_desbloqueio FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "sd_insert" ON public.solicitacao_desbloqueio;
CREATE POLICY sd_insert ON public.solicitacao_desbloqueio FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'orcamento', 'incluir'::app_acao) AND solicitado_por = auth.uid());
DROP POLICY IF EXISTS "sd_update" ON public.solicitacao_desbloqueio;
CREATE POLICY sd_update ON public.solicitacao_desbloqueio FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'orcamento', 'alterar'::app_acao));

-- ── alcada_aprovacao ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS alcada_select ON public.alcada_aprovacao;
CREATE POLICY alcada_select ON public.alcada_aprovacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS alcada_admin_ins ON public.alcada_aprovacao;
CREATE POLICY alcada_admin_ins ON public.alcada_aprovacao FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'incluir'::app_acao));
DROP POLICY IF EXISTS alcada_admin_upd ON public.alcada_aprovacao;
CREATE POLICY alcada_admin_upd ON public.alcada_aprovacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS alcada_admin_del ON public.alcada_aprovacao;
CREATE POLICY alcada_admin_del ON public.alcada_aprovacao FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'excluir'::app_acao));

-- ── parametro_geral ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS parametro_geral_select ON public.parametro_geral;
CREATE POLICY parametro_geral_select ON public.parametro_geral FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS parametro_geral_admin_ins ON public.parametro_geral;
CREATE POLICY parametro_geral_admin_ins ON public.parametro_geral FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'incluir'::app_acao));
DROP POLICY IF EXISTS parametro_geral_admin_upd ON public.parametro_geral;
CREATE POLICY parametro_geral_admin_upd ON public.parametro_geral FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS parametro_geral_admin_del ON public.parametro_geral;
CREATE POLICY parametro_geral_admin_del ON public.parametro_geral FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'excluir'::app_acao));

-- ── ocorrencia_operacional ───────────────────────────────────────────────
DROP POLICY IF EXISTS ocorrencia_select ON public.ocorrencia_operacional;
CREATE POLICY ocorrencia_select ON public.ocorrencia_operacional FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS ocorrencia_admin_ins ON public.ocorrencia_operacional;
CREATE POLICY ocorrencia_admin_ins ON public.ocorrencia_operacional FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'incluir'::app_acao));
DROP POLICY IF EXISTS ocorrencia_admin_upd ON public.ocorrencia_operacional;
CREATE POLICY ocorrencia_admin_upd ON public.ocorrencia_operacional FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS ocorrencia_admin_del ON public.ocorrencia_operacional;
CREATE POLICY ocorrencia_admin_del ON public.ocorrencia_operacional FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'excluir'::app_acao));

-- ── identidade_visual ────────────────────────────────────────────────────
DROP POLICY IF EXISTS identidade_visual_select ON public.identidade_visual;
CREATE POLICY identidade_visual_select ON public.identidade_visual FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS identidade_visual_admin_ins ON public.identidade_visual;
CREATE POLICY identidade_visual_admin_ins ON public.identidade_visual FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'incluir'::app_acao));
DROP POLICY IF EXISTS identidade_visual_admin_upd ON public.identidade_visual;
CREATE POLICY identidade_visual_admin_upd ON public.identidade_visual FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));

-- ── storage bucket "identidade-visual" (read: qualquer autenticado, hoje
--    tem OR auth.uid() IS NOT NULL redundante ao lado do has_role; write:
--    admin-only puro) ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "identidade_visual_admin_read" ON storage.objects;
CREATE POLICY "identidade_visual_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'identidade-visual' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "identidade_visual_admin_write" ON storage.objects;
CREATE POLICY "identidade_visual_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'identidade-visual' AND public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS "identidade_visual_admin_update" ON storage.objects;
CREATE POLICY "identidade_visual_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'identidade-visual' AND public.can_access(auth.uid(), 'administracao', 'alterar'::app_acao));
DROP POLICY IF EXISTS "identidade_visual_admin_delete" ON storage.objects;
CREATE POLICY "identidade_visual_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'identidade-visual' AND public.can_access(auth.uid(), 'administracao', 'excluir'::app_acao));

NOTIFY pgrst, 'reload schema';
