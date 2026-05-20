## Execução sequencial A → B → C

Cada etapa segue o ciclo: **Diagnóstico → Migration (aprovação) → Código → Validação → Checkpoint**. Nada fora do escopo declarado será tocado (sem mexer em alçadas, acessos, botões anulares, telas não-listadas).

---

### A) Onda 2 RLS Multiempresa — Sub-onda 2.1 (Financeiro/Compras)

**Objetivo:** migrar ~35 tabelas de `get_user_empresa(auth.uid()) = empresa_id` para `user_pode_atuar_empresa(auth.uid(), empresa_id)`, permitindo que usuários com acesso a múltiplas empresas (Helena diretora, gestores multi-CC) leiam/escrevam corretamente.

**Tabelas alvo (a confirmar no diagnóstico):**
- Financeiro: `titulo_pagar`, `titulo_pagar_baixa`, `titulo_pagar_parcela`, `pre_titulo`, `pre_titulo_anexo`, `financeiro_pagamento_aprovacao`, `programacao_pagamento`, `movimento_bancario`, `extrato_bancario`, `conciliacao_*`
- Compras: `requisicao_compra*`, `pedido_compra*`, `cotacao*`, `nf_entrada*`, `recebimento*`, `sup_aprov_*`

**Passos:**
1. Query de diagnóstico: listar todas as policies em `pg_policies` que referenciam `get_user_empresa` nesses domínios.
2. Migration única: `DROP POLICY ... CREATE POLICY ...` substituindo a expressão. Manter mesmo nome de policy, mesmo escopo (SELECT/INSERT/UPDATE/DELETE), mesmas roles.
3. Sem alterar estrutura de tabelas, sem mexer em triggers, sem tocar em tabelas de alçada (`sup_aprov_etapa`, `sup_aprov_instancia` — apenas RLS de leitura se aplicável e dentro do domínio Compras).
4. Validar com `supabase--linter` e queries de fumaça (Helena conseguir ver `titulo_pagar` das 6 empresas; gestor de CC ver só os seus).

**Impacto cruzado:** views que filtram por `empresa_id` continuam funcionando (RLS é transparente). Hooks `useEmpresaAtiva` continuam filtrando explicitamente — sem mudança no frontend.

---

### B) Onda A2 FCR — Edição controlada de lançamentos históricos

**Objetivo:** permitir que a tela `FCR Diário` (em `src/pages/financeiro/`) edite lançamentos `mz_40_fato_fluxo_caixa_realizado` promovendo-os sob demanda para `realizado_lancamentos` oficial. Mantém leitura unificada já existente.

**Passos:**
1. Diagnóstico: confirmar existência de `mz_40_fato_fluxo_caixa_realizado` (58.966 linhas conforme auditoria) e estrutura de `realizado_lancamentos`. Localizar a tela FCR exata.
2. Migration: criar RPC `fcr_promover_lancamento(_mz_id uuid)` `SECURITY DEFINER` que:
   - Lê linha do `mz_40`, valida não-promovida.
   - Insere em `realizado_lancamentos` com `origem='app'` e `mz_origem_id` para rastreio.
   - Marca `mz_40` como `promovido_em = now()`.
3. Migration: adicionar coluna `promovido_em timestamptz` em `mz_40_fato_fluxo_caixa_realizado` (se não existir).
4. Frontend: na tela FCR Diário, ao clicar Editar em linha `origem='mz_carga'`, exibir diálogo "Promover para edição oficial" → chama RPC → recarrega.
5. **NÃO** altera regras de alçada, não mexe em contas a pagar/receber, não toca em conciliação.

**Impacto cruzado:** `dre_realizado`, `balancete` já leem de `realizado_lancamentos` — passarão a ver os lançamentos promovidos automaticamente. Views unificadas continuam mostrando ambos (mas sem duplicar, pois marcação `promovido_em` filtra).

---

### C) Smoke Test Helena — Acionamento

**Objetivo:** entregar para a Helena o roteiro de smoke test pronto (`.lovable/smoke-test-aprovacoes.md`) e instrumentar tela `Admin > Auditoria` com filtro "Smoke Test Helena" para acompanhar execução em tempo real.

**Passos:**
1. Ler `.lovable/smoke-test-aprovacoes.md` para confirmar roteiro atual.
2. Criar página `src/pages/admin/SmokeTestHelena.tsx` (read-only) listando os passos do roteiro com checkboxes locais (localStorage), link para cada tela envolvida, e painel lateral com últimos eventos de `audit_log` filtrados por `user_email='helena@...'`.
3. Adicionar rota `/app/admin/smoke-helena` (sem mexer no Sidebar — apenas link no topo de `Admin > Auditoria`).
4. **NÃO** cria novas permissões, não dispara notificações reais, não modifica nenhum fluxo de aprovação.

---

### Inventário atualizado (mantido a cada etapa)

| # | Item Prompt Mestre | Status pré-A→B→C | Após A | Após B | Após C |
|---|---|---|---|---|---|
| 1 | Onda 1 RLS (27 tab.) | ✅ | ✅ | ✅ | ✅ |
| 2 | Helena diretora 6 emp. | ✅ | ✅ | ✅ | ✅ |
| 3 | Gestores CC | ✅ | ✅ | ✅ | ✅ |
| 4 | **Onda 2 RLS (~132 tab.)** | ⏳ 0/132 | 🟡 35/132 (sub-onda 2.1) | 🟡 35/132 | 🟡 35/132 |
| 5 | SLA cron | ✅ | ✅ | ✅ | ✅ |
| 6 | Edição empresa em CC | ✅ | ✅ | ✅ | ✅ |
| 7 | Notif. + Saúde Alçadas | ✅ | ✅ | ✅ | ✅ |
| 8 | **Promoção `mz_*` oficial** | 🟡 A1 (leitura razão) | 🟡 A1 | 🟡 A1+A2 (FCR escrita) | 🟡 A1+A2 |
| 9 | Smoke test Helena | ⏳ | ⏳ | ⏳ | 🟢 acionado |

**Pendências após A→B→C:**
- Onda 2 RLS sub-ondas 2.2 (Estoque/RH ~50 tab.) e 2.3 (demais ~47 tab.)
- Promoção A3 (titulo_pagar histórico), A4 (titulo_receber), A5 (contratos `mz_50`), A6 (contábil `mz_31/32`)
- Helena executar smoke test e devolver feedback

---

### Confirmação solicitada

Posso prosseguir já com a **etapa A** (diagnóstico + migration RLS sub-onda 2.1)? Ao final de A, paro para checkpoint antes de B.