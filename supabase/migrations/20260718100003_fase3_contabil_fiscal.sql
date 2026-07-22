-- FASE 3 (lote 3/6 — Contábil + Fiscal) — remove has_role(admin)/empresa da RLS
--
-- Achado à parte, fora do escopo dos 2 audits originais (que trataram
-- `stg_*` como andaime de ETL pontual — a maioria é mesmo, mas essas duas
-- não): `stg_aprovacao_contas` e `stg_sugestoes_novas_contas` viraram fila
-- de aprovação PERMANENTE (usadas direto por AprovacaoContas.tsx, confirmado
-- na auditoria de tabelas sem uso), e a policy de leitura delas
-- (`..._read`) é `USING (true)` — qualquer autenticado lê dados de aprovação
-- contábil de qualquer empresa. Corrigido aqui.
--
-- Achado 2: os módulos Fiscal e BI tinham, os dois, um app_menu com código
-- 'principal' — colisão real, já que as funções de gate comparam
-- menu_codigo sem saber de qual módulo é (um perfil de módulo "BI" passaria
-- a também abrir "Fiscal" sem querer). Renomeado o do Fiscal antes de
-- gatear qualquer tabela com ele.
--
-- Nota de transparência: `realizado_lancamentos`/`realizado_lotes` não têm
-- consumidor direto identificável no front (só aparecem no types.ts gerado,
-- são alimentadas pelo motor de Integração) — gateadas com 'avancada' como
-- aproximação razoável; vale confirmar com um teste real.

UPDATE public.app_menu
SET codigo = 'fiscal-principal'
WHERE codigo = 'principal'
  AND modulo_id = (SELECT id FROM public.app_modulo WHERE codigo = 'fiscal');

-- ── lancamento_contabil / lancamento_partida ─────────────────────────────
DROP POLICY IF EXISTS lc_select ON public.lancamento_contabil;
CREATE POLICY lc_select ON public.lancamento_contabil FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'lancamentos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS lc_write ON public.lancamento_contabil;
CREATE POLICY lc_write ON public.lancamento_contabil FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'lancamentos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'lancamentos', 'alterar'::app_acao));

DROP POLICY IF EXISTS lp_select ON public.lancamento_partida;
CREATE POLICY lp_select ON public.lancamento_partida FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'lancamentos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS lp_write ON public.lancamento_partida;
CREATE POLICY lp_write ON public.lancamento_partida FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'lancamentos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'lancamentos', 'alterar'::app_acao));

-- ── conta_contabil (adiada do lote 1 — é do módulo Contábil) ────────────
DROP POLICY IF EXISTS cc_cont_select ON public.conta_contabil;
CREATE POLICY cc_cont_select ON public.conta_contabil FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'visualizar'::app_acao));
DROP POLICY IF EXISTS cc_cont_insert ON public.conta_contabil;
CREATE POLICY cc_cont_insert ON public.conta_contabil FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'plano-contas', 'incluir'::app_acao));
DROP POLICY IF EXISTS cc_cont_update ON public.conta_contabil;
CREATE POLICY cc_cont_update ON public.conta_contabil FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'alterar'::app_acao));
DROP POLICY IF EXISTS cc_cont_delete ON public.conta_contabil;
CREATE POLICY cc_cont_delete ON public.conta_contabil FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'excluir'::app_acao));

-- ── plano_contas_solicitacao ─────────────────────────────────────────────
DROP POLICY IF EXISTS pcs_select ON public.plano_contas_solicitacao;
CREATE POLICY pcs_select ON public.plano_contas_solicitacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'visualizar'::app_acao));
DROP POLICY IF EXISTS pcs_insert ON public.plano_contas_solicitacao;
CREATE POLICY pcs_insert ON public.plano_contas_solicitacao FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'plano-contas', 'incluir'::app_acao));
DROP POLICY IF EXISTS pcs_update_owner ON public.plano_contas_solicitacao;
CREATE POLICY pcs_update_owner ON public.plano_contas_solicitacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'alterar'::app_acao) AND criado_por = auth.uid());
DROP POLICY IF EXISTS pcs_update_approver ON public.plano_contas_solicitacao;
CREATE POLICY pcs_update_approver ON public.plano_contas_solicitacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'aprovar'::app_acao));
DROP POLICY IF EXISTS pcs_delete ON public.plano_contas_solicitacao;
CREATE POLICY pcs_delete ON public.plano_contas_solicitacao FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'plano-contas', 'excluir'::app_acao));

-- ── stg_aprovacao_contas / stg_sugestoes_novas_contas (fila de aprovação
--    permanente, não ETL descartável) ────────────────────────────────────
DROP POLICY IF EXISTS "stg_aprovacao_contas_read" ON public.stg_aprovacao_contas;
CREATE POLICY stg_aprovacao_contas_read ON public.stg_aprovacao_contas FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacao-contas', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "stg_aprovacao_contas_admin_all" ON public.stg_aprovacao_contas;
CREATE POLICY stg_aprovacao_contas_write ON public.stg_aprovacao_contas FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacao-contas', 'aprovar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'aprovacao-contas', 'aprovar'::app_acao));

DROP POLICY IF EXISTS "stg_sugestoes_novas_contas_read" ON public.stg_sugestoes_novas_contas;
CREATE POLICY stg_sugestoes_novas_contas_read ON public.stg_sugestoes_novas_contas FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacao-contas', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "stg_sugestoes_novas_contas_admin_all" ON public.stg_sugestoes_novas_contas;
CREATE POLICY stg_sugestoes_novas_contas_write ON public.stg_sugestoes_novas_contas FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacao-contas', 'aprovar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'aprovacao-contas', 'aprovar'::app_acao));

-- ── realizado_lancamentos / realizado_lotes ──────────────────────────────
DROP POLICY IF EXISTS rlanc_select ON public.realizado_lancamentos;
CREATE POLICY rlanc_select ON public.realizado_lancamentos FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'avancada', 'visualizar'::app_acao));
DROP POLICY IF EXISTS rlanc_insert ON public.realizado_lancamentos;
CREATE POLICY rlanc_insert ON public.realizado_lancamentos FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'avancada', 'incluir'::app_acao));
DROP POLICY IF EXISTS rlanc_update ON public.realizado_lancamentos;
CREATE POLICY rlanc_update ON public.realizado_lancamentos FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'avancada', 'alterar'::app_acao));
DROP POLICY IF EXISTS rlanc_delete ON public.realizado_lancamentos;
CREATE POLICY rlanc_delete ON public.realizado_lancamentos FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'avancada', 'excluir'::app_acao));

DROP POLICY IF EXISTS rlot_select ON public.realizado_lotes;
CREATE POLICY rlot_select ON public.realizado_lotes FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'avancada', 'visualizar'::app_acao));
DROP POLICY IF EXISTS rlot_write ON public.realizado_lotes;
CREATE POLICY rlot_write ON public.realizado_lotes FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'avancada', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'avancada', 'alterar'::app_acao));

-- ══════════════════════════════ FISCAL ═══════════════════════════════════
-- (todas as telas de Fiscal ficam numa página só, /app/fiscal, menu único
-- 'fiscal-principal' — renomeado no topo deste arquivo)

DROP POLICY IF EXISTS "fiscal_config_select" ON public.empresa_fiscal_config;
CREATE POLICY fiscal_config_select ON public.empresa_fiscal_config FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "fiscal_config_manage" ON public.empresa_fiscal_config;
CREATE POLICY fiscal_config_manage ON public.empresa_fiscal_config FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

DROP POLICY IF EXISTS "servico_select" ON public.servico_municipal;
CREATE POLICY servico_select ON public.servico_municipal FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "servico_manage" ON public.servico_municipal;
CREATE POLICY servico_manage ON public.servico_municipal FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

DROP POLICY IF EXISTS "nf_select" ON public.nota_fiscal;
CREATE POLICY nf_select ON public.nota_fiscal FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "nf_manage" ON public.nota_fiscal;
CREATE POLICY nf_manage ON public.nota_fiscal FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

DROP POLICY IF EXISTS "nfev_select" ON public.nota_fiscal_evento;
CREATE POLICY nfev_select ON public.nota_fiscal_evento FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "nfev_insert" ON public.nota_fiscal_evento;
CREATE POLICY nfev_insert ON public.nota_fiscal_evento FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'incluir'::app_acao));

DROP POLICY IF EXISTS "apur_select" ON public.apuracao_imposto;
CREATE POLICY apur_select ON public.apuracao_imposto FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "apur_manage" ON public.apuracao_imposto;
CREATE POLICY apur_manage ON public.apuracao_imposto FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

DROP POLICY IF EXISTS "apur_item_select" ON public.apuracao_imposto_item;
CREATE POLICY apur_item_select ON public.apuracao_imposto_item FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "apur_item_manage" ON public.apuracao_imposto_item;
CREATE POLICY apur_item_manage ON public.apuracao_imposto_item FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));

DROP POLICY IF EXISTS "param_fiscal_select" ON public.parametro_fiscal;
CREATE POLICY param_fiscal_select ON public.parametro_fiscal FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "param_fiscal_insert" ON public.parametro_fiscal;
CREATE POLICY param_fiscal_insert ON public.parametro_fiscal FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'fiscal-principal', 'incluir'::app_acao));
DROP POLICY IF EXISTS "param_fiscal_update" ON public.parametro_fiscal;
CREATE POLICY param_fiscal_update ON public.parametro_fiscal FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'alterar'::app_acao));
DROP POLICY IF EXISTS "param_fiscal_delete" ON public.parametro_fiscal;
CREATE POLICY param_fiscal_delete ON public.parametro_fiscal FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'fiscal-principal', 'excluir'::app_acao));

-- cfop / plano_contas_master: deixados abertos de propósito (mesma decisão
-- do lote 1 pra classificadores) — são catálogos de referência nacional
-- (códigos fiscais / plano de contas mestre), não dado de negócio por
-- empresa, e o risco de gatear errado (travar import de NF) é maior que o
-- ganho de segurança.

-- Rollback: reaplicar as policies das migrations de origem citadas nos
-- comentários, e UPDATE app_menu SET codigo='principal' WHERE codigo=
-- 'fiscal-principal' (cuidado: só reverter isso se tiver certeza que BI
-- não ficou com nenhum dado gravado achando que era Fiscal nesse meio tempo).

NOTIFY pgrst, 'reload schema';
