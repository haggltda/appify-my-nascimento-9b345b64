# Inventário Final — Pendências para fechar o Prompt Mestre

Snapshot: 2026-05-20. Confirmado: **G1 (Fluxos RC) + G2 (Mutirão de Gestores) liberados.**

---

## ✅ Já entregue (referência)

- **Multiempresa:** `acessa_todas_empresas`, `user_pode_atuar_empresa`, `EmpresaAtivaContext`, switcher no topbar.
- **Etapa 1 (Segurança):** 27 tabelas críticas migradas para `user_pode_atuar_empresa`. Helena replicada nas 6 empresas.
- **Etapa 2 (Alçadas):** engine `sup_aprov_*` (8 tabelas + funções), pilotos Requisição/Licitação/Programação de Pagamento, Timeline, Inbox unificado, manual de cadastro, preferências de notificação, vínculo de orçamento 3 níveis (empresa → CC → etapa).
- **Gestores de CC (base):** coluna `gestor_user_id`, índice, bloqueio de requisição sem gestor, aba "Gestores de CC" com import/export XLSX.
- **Legados redirecionados:** `useTemAlcada`, Inbox, ProgramacaoPagamentos, Composicao (licitação).
- **SLA:** edge `sla-escalonamento-tick` + `pg_cron` 60 min + sininho.
- **Smoke test Etapa 2:** cron ativo, função 200, Helena OK.

---

## 🔴 Pendências para fechar 100%

### G1 — Fluxos de Requisição de Compra (RC) e Pedido de Compra (PC) — APROVADO

**Gap:** `sup_aprov_fluxo` ainda não tem entradas oficiais para `requisicao_compra` e `licitacao_etapa` (detectado no Smoke Test). Sem isso `abrir_instancia` cai no fallback genérico.

1. **Seed de fluxos oficiais por empresa (6x):**
   - `requisicao_compra`: Etapa 1 = gestor_cc (dinâmico via `centros_custo.gestor_user_id`) → Etapa 2 (condicional) = diretor quando orçamento estourado.
   - `pedido_compra`: faixas por valor (até X = gestor, X–Y = diretor, > Y = presidência).
   - `licitacao_etapa`: aprovação por etapa do edital (qualificação, técnica, comercial, homologação).
2. **Resolver dinâmico `tipo_responsavel = 'gestor_cc'`** no `sup_aprov_abrir_instancia` (hoje só resolve por user_id fixo).
3. **Wire-up nos pontos de criação:**
   - `RequisicaoCompra` (form) → chamar `sup_aprov_abrir_instancia` ao submit.
   - `PedidoCompra` → idem.
   - `LicitacaoAprovacaoBox` já existe — validar que abre instância por etapa.
4. **Testes manuais:** 1 RC com orçamento OK, 1 RC estourando orçamento (deve abrir Etapa 2), 1 PC em cada faixa.

### G2 — Mutirão de Gestores de CC — APROVADO

**Gap:** 737 de 742 CCs sem gestor → qualquer RC trava (bloqueio implementado).

1. **Sessão de cadastro com Controladoria** usando a tela "Gestores de CC":
   - Exportar XLSX modelo (já implementado).
   - Controladoria preenche `gestor_email` por linha.
   - Reimportar e validar preview (verde/amarelo/vermelho).
2. **Relatório pós-mutirão:** quantos CCs ainda sem gestor por empresa.
3. **Comunicado interno:** avisar gestores que entrarão no fluxo de RC.

---

### Demais pendências (fora de G1/G2) que o prompt mestre ainda cobre

#### P1 — Migração de dados produtivos (Blocos 2-8 da auditoria V2)
Tabelas produtivas ainda vazias bloqueiam DRE/Painel:
- `titulo_receber`, `titulo_pagar`, `lancamento_contabil`, `lancamento_partida`, `movimento_bancario`, `extrato_bancario`, `realizado_lancamentos`, `orcamento_contrato`, `fluxo_caixa_projetado`.
- Promoção via `integration_*` (estendendo o que já existe — sem tabela paralela).
- Falta `integration_alias_contas_contabeis` e `integration_alias_dre`.

#### P2 — Bloco 9: Painel Executivo da Presidência
- 7 views `vw_presidencia_*` (DRE consolidado, fluxo, backlog, aprovações pendentes, SLA, top desvios, recebíveis).
- Rota `pages/presidencia/PainelExecutivo.tsx` (hoje só existe Inbox).

#### P3 — Onda 2 multiempresa (80 tabelas "nice to have")
- Documentado em `impacto-multiempresa-137-tabelas.md`. Não bloqueia Helena, mas elimina filtros single-tenant residuais.

#### P4 — Cleanup
- Dropar `conciliacao_regra` (duplicada de `conciliacao_regras`).
- Migrar fluxos antigos `aprov_*` financeiros para `sup_aprov_*` (consolidação dos 3 engines apontada em `analise-alcadas-aprovacao.md`).

#### P5 — UX residual
- Notificações por email/push (hoje só sininho funciona; toggle existe mas worker de email/push não).
- Tela de "Minhas aprovações pendentes" agrupada por processo na Home.

#### P6 — Documentação/treinamento
- Manual "Como aprovar uma RC" (gestor de CC).
- Manual "Mutirão de cadastro de gestores" (controladoria).
- Vídeo curto do fluxo ponta-a-ponta.

---

## Ordem sugerida de execução

| # | Item | Bloqueia? | Esforço |
|---|------|-----------|---------|
| 1 | **G1** — Seed fluxos RC/PC/Licitação + resolver `gestor_cc` | Sim — sem isso RC não roda | M |
| 2 | **G2** — Mutirão de gestores (sessão com Controladoria) | Sim — sem isso RC trava | Operacional |
| 3 | P5.1 — Manual rápido de aprovação RC | Para treinamento | P |
| 4 | P1 — Promoção dos fatos restantes via `integration_*` | Bloqueia DRE/Painel | G |
| 5 | P2 — Painel Presidência (7 views + tela) | Entrega final ao executivo | M |
| 6 | P4 — Cleanup (`aprov_*` legado + tabelas duplicadas) | Dívida técnica | P |
| 7 | P3 — Onda 2 multiempresa (80 tabelas) | Não bloqueia | M |
| 8 | P5.2 — Email/push worker | Conforto | M |

**Sequência aprovada para começar agora:** 1 → 2 → 3.
