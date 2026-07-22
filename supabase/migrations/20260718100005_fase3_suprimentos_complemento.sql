-- FASE 3 (lote 4/6 — Suprimentos, complemento) — remove has_role(admin)/empresa
-- da RLS das tabelas FILHAS que ficaram de fora de 20260718100004 (cada uma
-- tinha sua própria cópia do critério antigo via EXISTS no registro pai, sem
-- herdar automaticamente o fix aplicado na tabela pai).
--
-- Confirmado por grep: nenhuma dessas 8 tabelas teve uma 2ª geração de
-- policies (diferente do achado em sup_aprov_*) — os nomes abaixo são os
-- únicos existentes hoje, criados na migration original de cada bloco.
--
-- menu_codigo espelha a tabela pai: cotacao_rc/item/fornecedor/proposta/
-- proposta_item → 'cotacoes' (mesma tela de Cotações); nf_entrada_item/_log →
-- 'nf-entrada'; recebimento_nf_item/recebimento_ocorrencia → 'recebimentos'.

-- ── cotacao_rc ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cot_rc_all" ON public.cotacao_rc;
CREATE POLICY cot_rc_select ON public.cotacao_rc FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
CREATE POLICY cot_rc_write ON public.cotacao_rc FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));

-- ── cotacao_item ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cot_item_all" ON public.cotacao_item;
CREATE POLICY cot_item_select ON public.cotacao_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
CREATE POLICY cot_item_write ON public.cotacao_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));

-- ── cotacao_fornecedor ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "cot_forn_all" ON public.cotacao_fornecedor;
CREATE POLICY cot_forn_select ON public.cotacao_fornecedor FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
CREATE POLICY cot_forn_write ON public.cotacao_fornecedor FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));

-- ── cotacao_proposta ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cot_prop_all" ON public.cotacao_proposta;
CREATE POLICY cot_prop_select ON public.cotacao_proposta FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
CREATE POLICY cot_prop_write ON public.cotacao_proposta FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));

-- ── cotacao_proposta_item ────────────────────────────────────────────────
DROP POLICY IF EXISTS "cot_prop_item_all" ON public.cotacao_proposta_item;
CREATE POLICY cot_prop_item_select ON public.cotacao_proposta_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
CREATE POLICY cot_prop_item_write ON public.cotacao_proposta_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));

-- ── nf_entrada_item ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "nfi_select" ON public.nf_entrada_item;
CREATE POLICY nfi_select ON public.nf_entrada_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'nf-entrada', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "nfi_write" ON public.nf_entrada_item;
CREATE POLICY nfi_write ON public.nf_entrada_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'nf-entrada', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'nf-entrada', 'alterar'::app_acao));

-- ── nf_entrada_log (append-only: sem update/delete na versão original) ──
DROP POLICY IF EXISTS "nfl_select" ON public.nf_entrada_log;
CREATE POLICY nfl_select ON public.nf_entrada_log FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'nf-entrada', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "nfl_insert" ON public.nf_entrada_log;
CREATE POLICY nfl_insert ON public.nf_entrada_log FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'nf-entrada', 'incluir'::app_acao));

-- ── recebimento_nf_item ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "receb_item_select" ON public.recebimento_nf_item;
CREATE POLICY receb_item_select ON public.recebimento_nf_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'recebimentos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "receb_item_all" ON public.recebimento_nf_item;
CREATE POLICY receb_item_write ON public.recebimento_nf_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'recebimentos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'recebimentos', 'alterar'::app_acao));

-- ── recebimento_ocorrencia (sem delete na versão original) ──────────────
DROP POLICY IF EXISTS "ocor_select" ON public.recebimento_ocorrencia;
CREATE POLICY ocor_select ON public.recebimento_ocorrencia FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'recebimentos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "ocor_insert" ON public.recebimento_ocorrencia;
CREATE POLICY ocor_insert ON public.recebimento_ocorrencia FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'recebimentos', 'incluir'::app_acao));
DROP POLICY IF EXISTS "ocor_update" ON public.recebimento_ocorrencia;
CREATE POLICY ocor_update ON public.recebimento_ocorrencia FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'recebimentos', 'alterar'::app_acao));

NOTIFY pgrst, 'reload schema';
