# Inventário pós A → B → C (2026-05-20)

## Concluído nesta rodada

### A — Onda 2 RLS Sub-onda 2.1 (Financeiro/Compras) ✅
- 46 tabelas migradas de `get_user_empresa(uid)=empresa_id` para `user_pode_atuar_empresa(uid, empresa_id)`.
- Tabelas: titulo_pagar/baixa/parcela, titulo_receber/baixa/parcela, pre_titulo_pagar, financeiro_pagamento_aprovacao/log/validacao, programacao_pagamento, movimento_bancario, extrato_bancario, conciliacao_match/regra/regras, cnab_*, cobranca_*, banco_layout_*, conta_bancaria, fornecedor, requisicao_compra(_item), pedido_compra(_item), cotacao(_fornecedor/_item/_proposta/_proposta_item/_rc), nf_entrada(_item/_log), nota_fiscal(_evento/_item), recebimento_nf(_item)/_ocorrencia.
- Verificado: 0 policies remanescentes nas 46 tabelas alvo.
- Não tocou: tabelas de alçada (`sup_aprov_*`, `aprov_*`), triggers, telas.

### B — Onda A2 FCR (mínimo backend) ✅
- ALTER `mz_40_fato_fluxo_caixa_realizado`: + `promovido_em`, `promovido_por`, `realizado_lancamento_id`.
- RPC `fcr_promover_lancamento(_mz_id, _empresa_id, _centro_custo_id, _dre_linha_id, _data_lancamento, _data_competencia, _valor, _descricao, _documento, _contraparte, _observacoes)` — SECURITY DEFINER, valida `user_pode_atuar_empresa`, grava em `realizado_lancamentos` com `origem_externa_id='mz_40:<id>'` e marca a linha original. EXECUTE para `authenticated`.
- UI deliberadamente fora deste pacote (decisão usuário) — pode ser ativada em rodada futura.

### C — Smoke Test Helena ✅
- Página `src/pages/admin/SmokeTestHelena.tsx` (rota `/app/admin/smoke-helena`).
- Checklist por empresa (RAC, SPNE, HAGG, LF, NH, SN) × 8 passos; persistência local em localStorage.
- Painel lateral de auditoria filtrada por e-mail do usuário (default `helena`), refetch 15s.
- Link "Smoke Test Helena →" no header da aba Auditoria.
- Não cria permissões, não dispara notificações, não modifica fluxos.

## Pendências do Prompt Mestre

| # | Item | Status | Próximo |
|---|------|--------|---------|
| 1 | Onda 1 RLS (27 tab.) | ✅ | — |
| 2 | Helena diretora 6 empresas | ✅ | — |
| 3 | Gestores de CC | ✅ | — |
| **4** | **Onda 2 RLS (~132 tab.)** | 🟡 46/132 | Sub-onda 2.2 (Estoque/RH ~50 tab.), Sub-onda 2.3 (demais ~36 tab.) |
| 5 | SLA cron + escalonamento | ✅ | — |
| 6 | Edição empresa em CC + manual | ✅ | — |
| 7 | Notificações reais + Saúde Alçadas | ✅ | — |
| **8** | **Promoção `mz_*` → oficial** | 🟡 A1 + A2-min | A2-UI (dialog de promoção na FCR Diário), A3 (titulo_pagar histórico), A4 (titulo_receber), A5 (contratos mz_50), A6 (contábil mz_31/32) |
| **9** | **Smoke test Helena** | 🟡 Tela pronta | Helena executar nas 6 empresas e devolver feedback |

## Itens disponíveis nas Sub-ondas 2.2 / 2.3 (Onda 2 RLS)

Pendentes para futuras rodadas — **não tocados nesta**:
- 2.2 Estoque/RH (~50): almoxarifado*, produto*, estoque*, movimento_estoque*, colaborador*, alocacao_colaborador, folha*, ponto*, ferias*, beneficio*.
- 2.3 Demais (~36): anexos, plano_acoes*, contrato*, cronograma_faturamento, medicao*, orcamento_contrato*, empenho*, posto*, apuracao_imposto*, lancamento_contabil, lancamento_partida, realizado_lancamentos, dre_*, balancete, etc.

## Riscos / observações

- Linter Supabase mostra 281→283 issues (todos pré-existentes: SECURITY DEFINER views, search_path mutáveis, extensions em public). A RPC nova `fcr_promover_lancamento` foi criada com `SET search_path = public`.
- Nenhuma view, trigger ou hook frontend foi alterado nesta rodada — sem regressão esperada em telas existentes.
