-- FASE 3 (lote 4/6 — Suprimentos) — remove has_role(admin)/empresa da RLS
--
-- Achado à parte: `sup_aprov_fluxo`/`sup_aprov_etapa`/`sup_aprov_instancia`/
-- `sup_aprov_voto` tiveram uma 2ª geração de policies criada em
-- 20260520033145 (fluxo_read_empresa, etapa_read_empresa, inst_read,
-- voto_read) SEM dropar a 1ª geração de 20260430003250 (fluxo_select,
-- etapa_select, inst_select, voto_select) — mesmo padrão de policy órfã já
-- visto em fornecedor_conta_bancaria/RECRUTAMENTO_CPF_BLACKLIST. As duas
-- gerações coexistem hoje (Postgres OR-combina policies permissivas). Este
-- arquivo dropa TODOS os nomes históricos das duas gerações antes de criar
-- a versão final, pra não deixar nenhuma sobrevivente.
--
-- Cobertura deste lote: tabelas "pai" de cada tela. As tabelas filhas de
-- cotação (cotacao_item/cotacao_fornecedor/cotacao_proposta/
-- cotacao_proposta_item) e de NF/recebimento (nf_entrada_item/_log,
-- recebimento_nf_item/_ocorrencia) NÃO foram cobertas aqui ainda — cada uma
-- tem sua própria cópia do critério antigo (EXISTS no pai + has_role/
-- empresa), não herdam o fix do pai automaticamente. Fica pra uma migration
-- de complemento, sinalizado no fim deste arquivo.

-- ── fornecedor ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS forn_select ON public.fornecedor;
CREATE POLICY forn_select ON public.fornecedor FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fornecedores', 'visualizar'::app_acao));
DROP POLICY IF EXISTS forn_write ON public.fornecedor;
DROP POLICY IF EXISTS forn_insert ON public.fornecedor;
CREATE POLICY forn_insert ON public.fornecedor FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'fornecedores', 'incluir'::app_acao));
DROP POLICY IF EXISTS forn_update ON public.fornecedor;
CREATE POLICY forn_update ON public.fornecedor FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'fornecedores', 'alterar'::app_acao));
DROP POLICY IF EXISTS forn_delete ON public.fornecedor;
CREATE POLICY forn_delete ON public.fornecedor FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'fornecedores', 'excluir'::app_acao));

-- ── produto / produto_categoria / produto_servico ───────────────────────
DROP POLICY IF EXISTS prod_select ON public.produto;
CREATE POLICY prod_select ON public.produto FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'produtos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS prod_write ON public.produto;
CREATE POLICY prod_write ON public.produto FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'produtos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'produtos', 'alterar'::app_acao));

DROP POLICY IF EXISTS pc_select ON public.produto_categoria;
CREATE POLICY pc_select ON public.produto_categoria FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'categorias', 'visualizar'::app_acao));
DROP POLICY IF EXISTS pc_write ON public.produto_categoria;
CREATE POLICY pc_write ON public.produto_categoria FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'categorias', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'categorias', 'alterar'::app_acao));

DROP POLICY IF EXISTS ps_select ON public.produto_servico;
CREATE POLICY ps_select ON public.produto_servico FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'produtos-servicos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS ps_write ON public.produto_servico;
CREATE POLICY ps_write ON public.produto_servico FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'produtos-servicos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'produtos-servicos', 'alterar'::app_acao));

-- ── almoxarifado ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS almox_select ON public.almoxarifado;
CREATE POLICY almox_select ON public.almoxarifado FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'almoxarifados', 'visualizar'::app_acao));
DROP POLICY IF EXISTS almox_write ON public.almoxarifado;
CREATE POLICY almox_write ON public.almoxarifado FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'almoxarifados', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'almoxarifados', 'alterar'::app_acao));

-- ── estoque_lote / estoque_saldo / estoque_movimento / estoque_reserva ──
DROP POLICY IF EXISTS lote_select ON public.estoque_lote;
CREATE POLICY lote_select ON public.estoque_lote FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'estoque', 'visualizar'::app_acao));
DROP POLICY IF EXISTS lote_write ON public.estoque_lote;
CREATE POLICY lote_write ON public.estoque_lote FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'estoque', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'estoque', 'alterar'::app_acao));

DROP POLICY IF EXISTS saldo_select ON public.estoque_saldo;
CREATE POLICY saldo_select ON public.estoque_saldo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'estoque', 'visualizar'::app_acao));
-- saldo_admin_write não é tocada — mantida por trigger automático (ver
-- comentário original), não é ação de usuário navegando a tela.

DROP POLICY IF EXISTS mov_select ON public.estoque_movimento;
CREATE POLICY mov_select ON public.estoque_movimento FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'movimentos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS mov_insert ON public.estoque_movimento;
CREATE POLICY mov_insert ON public.estoque_movimento FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'movimentos', 'incluir'::app_acao));
-- mov_admin_modify não é tocada (bloqueio de update/delete direto, mantém
-- só admin via has_role — é proteção de integridade do histórico, não gate
-- de tela).

DROP POLICY IF EXISTS res_select ON public.estoque_reserva;
CREATE POLICY res_select ON public.estoque_reserva FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'estoque', 'visualizar'::app_acao));
DROP POLICY IF EXISTS res_write ON public.estoque_reserva;
CREATE POLICY res_write ON public.estoque_reserva FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'estoque', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'estoque', 'alterar'::app_acao));

-- ── requisicao_compra ────────────────────────────────────────────────────
DROP POLICY IF EXISTS rc_select ON public.requisicao_compra;
CREATE POLICY rc_select ON public.requisicao_compra FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS rc_insert ON public.requisicao_compra;
CREATE POLICY rc_insert ON public.requisicao_compra FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'requisicoes', 'incluir'::app_acao));
DROP POLICY IF EXISTS rc_update ON public.requisicao_compra;
CREATE POLICY rc_update ON public.requisicao_compra FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'alterar'::app_acao));
DROP POLICY IF EXISTS rc_delete ON public.requisicao_compra;
CREATE POLICY rc_delete ON public.requisicao_compra FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'requisicoes', 'excluir'::app_acao));

-- ── pedido_compra ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS pc_select ON public.pedido_compra;
CREATE POLICY pc_select ON public.pedido_compra FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'pedidos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS pc_write ON public.pedido_compra;
CREATE POLICY pc_write ON public.pedido_compra FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'pedidos', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'pedidos', 'alterar'::app_acao));

-- ── nf_entrada ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS nfe_select ON public.nf_entrada;
CREATE POLICY nfe_select ON public.nf_entrada FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'nf-entrada', 'visualizar'::app_acao));
DROP POLICY IF EXISTS nfe_insert ON public.nf_entrada;
CREATE POLICY nfe_insert ON public.nf_entrada FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'nf-entrada', 'incluir'::app_acao));
DROP POLICY IF EXISTS nfe_update ON public.nf_entrada;
CREATE POLICY nfe_update ON public.nf_entrada FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'nf-entrada', 'alterar'::app_acao));
DROP POLICY IF EXISTS nfe_delete ON public.nf_entrada;
CREATE POLICY nfe_delete ON public.nf_entrada FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'nf-entrada', 'excluir'::app_acao));

-- ── recebimento_nf ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "receb_select" ON public.recebimento_nf;
CREATE POLICY receb_select ON public.recebimento_nf FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'recebimentos', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "receb_insert" ON public.recebimento_nf;
CREATE POLICY receb_insert ON public.recebimento_nf FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'recebimentos', 'incluir'::app_acao));
DROP POLICY IF EXISTS "receb_update" ON public.recebimento_nf;
CREATE POLICY receb_update ON public.recebimento_nf FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'recebimentos', 'alterar'::app_acao));

-- ── parametro_cotacao / cotacao ──────────────────────────────────────────
DROP POLICY IF EXISTS "param_cot_select" ON public.parametro_cotacao;
CREATE POLICY param_cot_select ON public.parametro_cotacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "param_cot_write" ON public.parametro_cotacao;
CREATE POLICY param_cot_write ON public.parametro_cotacao FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));

DROP POLICY IF EXISTS "cot_select" ON public.cotacao;
CREATE POLICY cot_select ON public.cotacao FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "cot_insert" ON public.cotacao;
CREATE POLICY cot_insert ON public.cotacao FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'cotacoes', 'incluir'::app_acao));
DROP POLICY IF EXISTS "cot_update" ON public.cotacao;
CREATE POLICY cot_update ON public.cotacao FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'alterar'::app_acao));
DROP POLICY IF EXISTS "cot_delete" ON public.cotacao;
CREATE POLICY cot_delete ON public.cotacao FOR DELETE TO authenticated
  USING (public.can_access(auth.uid(), 'cotacoes', 'excluir'::app_acao));

-- ── sup_aprov_fluxo / etapa / aprovador / instancia / voto (Aprovações RC/PC) ──
-- Dropando as 2 gerações de nomes (2026-04-30 e 2026-05-20) antes de criar a final.
DROP POLICY IF EXISTS "fluxo_select" ON public.sup_aprov_fluxo;
DROP POLICY IF EXISTS "fluxo_read_empresa" ON public.sup_aprov_fluxo;
DROP POLICY IF EXISTS "fluxo_admin_all" ON public.sup_aprov_fluxo;
DROP POLICY IF EXISTS "fluxo_admin_write" ON public.sup_aprov_fluxo;
CREATE POLICY fluxo_select ON public.sup_aprov_fluxo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'visualizar'::app_acao));
CREATE POLICY fluxo_write ON public.sup_aprov_fluxo FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'aprovacoes', 'alterar'::app_acao));

DROP POLICY IF EXISTS "etapa_select" ON public.sup_aprov_etapa;
DROP POLICY IF EXISTS "etapa_read_empresa" ON public.sup_aprov_etapa;
DROP POLICY IF EXISTS "etapa_admin_all" ON public.sup_aprov_etapa;
DROP POLICY IF EXISTS "etapa_admin_write" ON public.sup_aprov_etapa;
CREATE POLICY etapa_select ON public.sup_aprov_etapa FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'visualizar'::app_acao));
CREATE POLICY etapa_write ON public.sup_aprov_etapa FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'aprovacoes', 'alterar'::app_acao));

-- sup_aprov_aprovador: dropada em 20260520033145 (DROP TABLE ... CASCADE),
-- substituída pela coluna responsavel_user_id direto em sup_aprov_etapa —
-- não existe mais, nada a fazer aqui.

DROP POLICY IF EXISTS "inst_select" ON public.sup_aprov_instancia;
DROP POLICY IF EXISTS "inst_read" ON public.sup_aprov_instancia;
DROP POLICY IF EXISTS "inst_insert" ON public.sup_aprov_instancia;
DROP POLICY IF EXISTS "inst_admin_update" ON public.sup_aprov_instancia;
DROP POLICY IF EXISTS "inst_update_admin" ON public.sup_aprov_instancia;
CREATE POLICY inst_select ON public.sup_aprov_instancia FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'visualizar'::app_acao) OR solicitante_user_id = auth.uid());
CREATE POLICY inst_insert ON public.sup_aprov_instancia FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'aprovacoes', 'incluir'::app_acao));
CREATE POLICY inst_update ON public.sup_aprov_instancia FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'aprovar'::app_acao));

DROP POLICY IF EXISTS "voto_select" ON public.sup_aprov_voto;
DROP POLICY IF EXISTS "voto_read" ON public.sup_aprov_voto;
CREATE POLICY voto_select ON public.sup_aprov_voto FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'aprovacoes', 'visualizar'::app_acao));
-- voto_insert não é tocada (já exige user_id = auth.uid(), é o voto do próprio usuário).

-- PENDENTE (fica pra uma migration de complemento do lote 4): tabelas
-- filhas de cotação (cotacao_item, cotacao_fornecedor, cotacao_proposta,
-- cotacao_proposta_item, cotacao_rc) e de NF/recebimento (nf_entrada_item,
-- nf_entrada_log, recebimento_nf_item, recebimento_nf_ocorrencia) — cada
-- uma tem sua própria cópia do critério antigo via EXISTS no registro pai,
-- não herdam este fix automaticamente.

NOTIFY pgrst, 'reload schema';
