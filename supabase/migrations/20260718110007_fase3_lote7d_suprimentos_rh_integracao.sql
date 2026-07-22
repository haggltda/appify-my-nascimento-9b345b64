-- FASE 3 (lote 7d) — tabelas-filhas de Suprimentos que ficaram de fora dos
-- lotes 4/5, mais colaborador/alocacao_colaborador (RH, tabela legada
-- anterior ao EMPREGADOS mas ainda escrita pela Migração Zero via
-- integration_promote_batch) e o storage bucket integration-uploads
-- (Integração, ficou de fora do lote 6 por estar num arquivo diferente do
-- DO-loop das tabelas).

-- ── pedido_compra_item (child de pedido_compra, já fixado no lote 4 com
--    menu 'pedidos') ────────────────────────────────────────────────────
DROP POLICY IF EXISTS pci_select ON public.pedido_compra_item;
CREATE POLICY pci_select ON public.pedido_compra_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'pedidos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS pci_write ON public.pedido_compra_item;
CREATE POLICY pci_write ON public.pedido_compra_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'pedidos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'pedidos', 'alterar'::app_acao));

-- ── requisicao_compra_item / _status_hist / _log (children de
--    requisicao_compra, já fixado no lote 4 com menu 'requisicoes') ──────
DROP POLICY IF EXISTS rci_select ON public.requisicao_compra_item;
CREATE POLICY rci_select ON public.requisicao_compra_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS rci_write ON public.requisicao_compra_item;
CREATE POLICY rci_write ON public.requisicao_compra_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'requisicoes', 'alterar'::app_acao));

DROP POLICY IF EXISTS rch_select ON public.requisicao_compra_status_hist;
CREATE POLICY rch_select ON public.requisicao_compra_status_hist FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'visualizar'::app_acao));

DROP POLICY IF EXISTS rcl_select ON public.requisicao_compra_log;
CREATE POLICY rcl_select ON public.requisicao_compra_log FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS rcl_insert ON public.requisicao_compra_log;
CREATE POLICY rcl_insert ON public.requisicao_compra_log FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'requisicoes', 'incluir'::app_acao));

-- ── colaborador / alocacao_colaborador (RH — tabela anterior ao
--    EMPREGADOS, ainda alimentada pela Migração Zero; menu 'colaboradores',
--    mesmo já usado por colaborador_conta_bancaria) ───────────────────────
DROP POLICY IF EXISTS col_select ON public.colaborador;
CREATE POLICY col_select ON public.colaborador FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'colaboradores', 'visualizar'::app_acao));
DROP POLICY IF EXISTS col_write ON public.colaborador;
CREATE POLICY col_write ON public.colaborador FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'colaboradores', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'colaboradores', 'alterar'::app_acao));

DROP POLICY IF EXISTS ac_select ON public.alocacao_colaborador;
CREATE POLICY ac_select ON public.alocacao_colaborador FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'colaboradores', 'visualizar'::app_acao));
DROP POLICY IF EXISTS ac_write ON public.alocacao_colaborador;
CREATE POLICY ac_write ON public.alocacao_colaborador FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'colaboradores', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'colaboradores', 'alterar'::app_acao));

-- ── storage bucket "integration-uploads" (Integração — planilhas cruas
--    enviadas para a Migração Zero, menu 'integracao') ──────────────────
DROP POLICY IF EXISTS "integ_uploads_read" ON storage.objects;
CREATE POLICY "integ_uploads_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='integration-uploads' AND public.can_access(auth.uid(), 'integracao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "integ_uploads_insert" ON storage.objects;
CREATE POLICY "integ_uploads_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='integration-uploads' AND public.can_access(auth.uid(), 'integracao', 'incluir'::app_acao));
DROP POLICY IF EXISTS "integ_uploads_delete" ON storage.objects;
CREATE POLICY "integ_uploads_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='integration-uploads' AND public.can_access(auth.uid(), 'integracao', 'excluir'::app_acao));

NOTIFY pgrst, 'reload schema';
