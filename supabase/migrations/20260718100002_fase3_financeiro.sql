-- FASE 3 (lote 2/6 — Financeiro) — remove has_role(admin)/empresa da RLS
--
-- Mesmo padrão do lote 1 (Controladoria). Nomes de policy confirmados por
-- grep nas migrations de origem antes de escrever este arquivo.
--
-- Achado à parte, fora do escopo original dos 2 audits: `pre_titulo_parcela`
-- (criada em 20260521174135) ficou com a policy aberta antiga
-- ("auth read/write pre_titulo_parcela", USING (auth.uid() IS NOT NULL) —
-- qualquer autenticado) porque nasceu DEPOIS das duas tabelas irmãs
-- (pre_titulo_rateio/pre_titulo_anexo) terem sido corrigidas, e ninguém
-- lembrou de aplicar o mesmo fix nela. Corrigido aqui também.
--
-- Menu 'conciliacao-bancaria' não existia em app_menu (mesma lacuna já viste
-- em Jurídico/Recrutamento antes da Fase 0) — cadastrado nesta migration.

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, 'conciliacao-bancaria', 'Conciliação Bancária', '/app/financeiro/conciliacao-bancaria', 65
  FROM public.app_modulo m WHERE m.codigo = 'financeiro'
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- ── conta_bancaria ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS cb_select ON public.conta_bancaria;
CREATE POLICY cb_select ON public.conta_bancaria FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'contas-bancarias', 'visualizar'::app_acao));
DROP POLICY IF EXISTS cb_insert ON public.conta_bancaria;
CREATE POLICY cb_insert ON public.conta_bancaria FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'contas-bancarias', 'incluir'::app_acao));
DROP POLICY IF EXISTS cb_update ON public.conta_bancaria;
CREATE POLICY cb_update ON public.conta_bancaria FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'contas-bancarias', 'alterar'::app_acao));
DROP POLICY IF EXISTS cb_delete ON public.conta_bancaria;
CREATE POLICY cb_delete ON public.conta_bancaria FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'contas-bancarias', 'excluir'::app_acao));

-- ── movimento_bancario ───────────────────────────────────────────────────
DROP POLICY IF EXISTS mb_select ON public.movimento_bancario;
CREATE POLICY mb_select ON public.movimento_bancario FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'movimentos-bancarios', 'visualizar'::app_acao));
DROP POLICY IF EXISTS mb_write ON public.movimento_bancario;
CREATE POLICY mb_write ON public.movimento_bancario FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'movimentos-bancarios', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'movimentos-bancarios', 'alterar'::app_acao));

-- ── extrato_bancario / conciliacao_regra / conciliacao_regras / conciliacao_match ──
DROP POLICY IF EXISTS extrato_select ON public.extrato_bancario;
CREATE POLICY extrato_select ON public.extrato_bancario FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS extrato_modify ON public.extrato_bancario;
CREATE POLICY extrato_modify ON public.extrato_bancario FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS conc_regra_select ON public.conciliacao_regra;
CREATE POLICY conc_regra_select ON public.conciliacao_regra FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS conc_regra_modify ON public.conciliacao_regra;
CREATE POLICY conc_regra_modify ON public.conciliacao_regra FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS creg_select ON public.conciliacao_regras;
CREATE POLICY creg_select ON public.conciliacao_regras FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS creg_write ON public.conciliacao_regras;
CREATE POLICY creg_write ON public.conciliacao_regras FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS conc_match_select ON public.conciliacao_match;
CREATE POLICY conc_match_select ON public.conciliacao_match FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS conc_match_modify ON public.conciliacao_match;
CREATE POLICY conc_match_modify ON public.conciliacao_match FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'conciliacao-bancaria', 'alterar'::app_acao));

-- ── titulo_pagar / titulo_receber(+baixa) ───────────────────────────────
DROP POLICY IF EXISTS tp_select ON public.titulo_pagar;
CREATE POLICY tp_select ON public.titulo_pagar FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'contas-pagar', 'visualizar'::app_acao));
DROP POLICY IF EXISTS tp_write ON public.titulo_pagar;
CREATE POLICY tp_write ON public.titulo_pagar FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao));

DROP POLICY IF EXISTS tr_select ON public.titulo_receber;
CREATE POLICY tr_select ON public.titulo_receber FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'contas-receber', 'visualizar'::app_acao));
DROP POLICY IF EXISTS tr_write ON public.titulo_receber;
CREATE POLICY tr_write ON public.titulo_receber FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'contas-receber', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'contas-receber', 'alterar'::app_acao));

DROP POLICY IF EXISTS trb_select ON public.titulo_receber_baixa;
CREATE POLICY trb_select ON public.titulo_receber_baixa FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'contas-receber', 'visualizar'::app_acao));
DROP POLICY IF EXISTS trb_insert ON public.titulo_receber_baixa;
CREATE POLICY trb_insert ON public.titulo_receber_baixa FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'contas-receber', 'incluir'::app_acao));

-- ── pre_titulo_pagar(+parcela) / malote_pagamento(+titulo) ──────────────
DROP POLICY IF EXISTS "pretitulo_select" ON public.pre_titulo_pagar;
CREATE POLICY pretitulo_select ON public.pre_titulo_pagar FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'contas-pagar', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "pretitulo_insert" ON public.pre_titulo_pagar;
CREATE POLICY pretitulo_insert ON public.pre_titulo_pagar FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'contas-pagar', 'incluir'::app_acao));
DROP POLICY IF EXISTS "pretitulo_update" ON public.pre_titulo_pagar;
CREATE POLICY pretitulo_update ON public.pre_titulo_pagar FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao));

DROP POLICY IF EXISTS "auth read pre_titulo_parcela" ON public.pre_titulo_parcela;
DROP POLICY IF EXISTS "auth write pre_titulo_parcela" ON public.pre_titulo_parcela;
CREATE POLICY pretitulo_parcela_select ON public.pre_titulo_parcela FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'contas-pagar', 'visualizar'::app_acao));
CREATE POLICY pretitulo_parcela_write ON public.pre_titulo_parcela FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'contas-pagar', 'alterar'::app_acao));

DROP POLICY IF EXISTS "malote_select" ON public.malote_pagamento;
CREATE POLICY malote_select ON public.malote_pagamento FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'programacao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "malote_insert" ON public.malote_pagamento;
CREATE POLICY malote_insert ON public.malote_pagamento FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'programacao', 'incluir'::app_acao));
DROP POLICY IF EXISTS "malote_update" ON public.malote_pagamento;
CREATE POLICY malote_update ON public.malote_pagamento FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'programacao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "malote_titulo_select" ON public.malote_titulo;
CREATE POLICY malote_titulo_select ON public.malote_titulo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'programacao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "malote_titulo_insert" ON public.malote_titulo;
CREATE POLICY malote_titulo_insert ON public.malote_titulo FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'programacao', 'incluir'::app_acao));
DROP POLICY IF EXISTS "malote_titulo_delete" ON public.malote_titulo;
CREATE POLICY malote_titulo_delete ON public.malote_titulo FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'programacao', 'excluir'::app_acao));

-- ── remessa_cnab(+titulo) / retorno_bancario(+ocorrencia) /
--    parametro_integracao_bancaria / banco_layout ────────────────────────
DROP POLICY IF EXISTS "remessa_select" ON public.remessa_cnab;
CREATE POLICY remessa_select ON public.remessa_cnab FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "remessa_write" ON public.remessa_cnab;
CREATE POLICY remessa_write ON public.remessa_cnab FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));
DROP POLICY IF EXISTS "remessa_titulo_all" ON public.remessa_cnab_titulo;
CREATE POLICY remessa_titulo_all ON public.remessa_cnab_titulo FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS retorno_select ON public.retorno_bancario;
CREATE POLICY retorno_select ON public.retorno_bancario FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS retorno_modify ON public.retorno_bancario;
CREATE POLICY retorno_modify ON public.retorno_bancario FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS retorno_ocor_select ON public.retorno_bancario_ocorrencia;
CREATE POLICY retorno_ocor_select ON public.retorno_bancario_ocorrencia FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS retorno_ocor_modify ON public.retorno_bancario_ocorrencia;
CREATE POLICY retorno_ocor_modify ON public.retorno_bancario_ocorrencia FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS param_int_bnc_select ON public.parametro_integracao_bancaria;
CREATE POLICY param_int_bnc_select ON public.parametro_integracao_bancaria FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS param_int_bnc_modify ON public.parametro_integracao_bancaria;
CREATE POLICY param_int_bnc_modify ON public.parametro_integracao_bancaria FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

DROP POLICY IF EXISTS bl_select ON public.banco_layout;
CREATE POLICY bl_select ON public.banco_layout FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'visualizar'::app_acao));
DROP POLICY IF EXISTS bl_modify ON public.banco_layout;
CREATE POLICY bl_modify ON public.banco_layout FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'integracao-bancaria', 'alterar'::app_acao));

-- ── Cobranças: cobranca_boleto/pix/evento, regua_cobranca(+etapa,execucao),
--    template_mensagem, contrato_email_cobranca ──────────────────────────
DROP POLICY IF EXISTS cb_all ON public.cobranca_boleto;
CREATE POLICY cb_all ON public.cobranca_boleto FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));
DROP POLICY IF EXISTS cp_all ON public.cobranca_pix;
CREATE POLICY cp_all ON public.cobranca_pix FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));
DROP POLICY IF EXISTS ce_all ON public.cobranca_evento;
CREATE POLICY ce_all ON public.cobranca_evento FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));

DROP POLICY IF EXISTS tm_select ON public.template_mensagem;
CREATE POLICY tm_select ON public.template_mensagem FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao));
DROP POLICY IF EXISTS tm_modify ON public.template_mensagem;
CREATE POLICY tm_modify ON public.template_mensagem FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));

DROP POLICY IF EXISTS rc_all ON public.regua_cobranca;
CREATE POLICY rc_all ON public.regua_cobranca FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));
DROP POLICY IF EXISTS rce_all ON public.regua_cobranca_etapa;
CREATE POLICY rce_all ON public.regua_cobranca_etapa FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));
DROP POLICY IF EXISTS rcex_all ON public.regua_cobranca_execucao;
CREATE POLICY rcex_all ON public.regua_cobranca_execucao FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));

DROP POLICY IF EXISTS cec_select ON public.contrato_email_cobranca;
CREATE POLICY cec_select ON public.contrato_email_cobranca FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao));
DROP POLICY IF EXISTS cec_write ON public.contrato_email_cobranca;
CREATE POLICY cec_write ON public.contrato_email_cobranca FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cobrancas', 'alterar'::app_acao));

DROP POLICY IF EXISTS crn_select ON public.cobranca_relatorio_nota;
CREATE POLICY crn_select ON public.cobranca_relatorio_nota FOR SELECT TO authenticated
  USING (
    public.can_access(auth.uid(), 'relatorio-servicos', 'visualizar'::app_acao)
    OR public.can_access(auth.uid(), 'cobrancas', 'visualizar'::app_acao)
  );
DROP POLICY IF EXISTS crn_write ON public.cobranca_relatorio_nota;
CREATE POLICY crn_write ON public.cobranca_relatorio_nota FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'relatorio-servicos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'relatorio-servicos', 'alterar'::app_acao));

-- ── financeiro_pagamento_aprovacao/validacao/log ────────────────────────
DROP POLICY IF EXISTS "fpa_select" ON public.financeiro_pagamento_aprovacao;
CREATE POLICY fpa_select ON public.financeiro_pagamento_aprovacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'validacao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "fpa_insert" ON public.financeiro_pagamento_aprovacao;
CREATE POLICY fpa_insert ON public.financeiro_pagamento_aprovacao FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'validacao', 'aprovar'::app_acao));
DROP POLICY IF EXISTS "fpa_update" ON public.financeiro_pagamento_aprovacao;
CREATE POLICY fpa_update ON public.financeiro_pagamento_aprovacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'validacao', 'aprovar'::app_acao));

DROP POLICY IF EXISTS "fpv_select" ON public.financeiro_pagamento_validacao;
CREATE POLICY fpv_select ON public.financeiro_pagamento_validacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'validacao', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "fpv_insert" ON public.financeiro_pagamento_validacao;
CREATE POLICY fpv_insert ON public.financeiro_pagamento_validacao FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'validacao', 'incluir'::app_acao));
DROP POLICY IF EXISTS "fpv_update" ON public.financeiro_pagamento_validacao;
CREATE POLICY fpv_update ON public.financeiro_pagamento_validacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'validacao', 'alterar'::app_acao));

DROP POLICY IF EXISTS "fpl_select" ON public.financeiro_pagamento_log;
CREATE POLICY fpl_select ON public.financeiro_pagamento_log FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'validacao', 'visualizar'::app_acao));
-- fpl_insert fica como estava (log gravado por trigger/RPC, não por usuário navegando).

-- Rollback: reaplicar as policies das migrations de origem citadas nos
-- comentários (todas DROP POLICY + CREATE POLICY, reversível reaplicando o
-- texto anterior).

NOTIFY pgrst, 'reload schema';
