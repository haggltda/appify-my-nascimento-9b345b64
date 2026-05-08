
# Plano V2 — Implantação integrada Financeiro / Orçamento / Razão-DRE / Fluxo / Painel Presidência

Estimativa provável: **~200 créditos** (faixa 120–360 dependendo de iterações).
Ordem segue o prompt V2 original (item 14), com reaproveitamento do que já foi entregue.

## Já executado (não recontabilizado)

- Diagnóstico inicial de schema (tabelas `mz_*`, `contrato`, `cronograma_faturamento`, `empresas`, `centros_custo`).
- Etapa 1 — Faturamento → `titulo_receber`: plano (`.lovable/plan.md`), hook `useTituloReceber.ts`, migração inicial em `titulo_receber` (FK `cronograma_parcela_id`), UI parcial em `FaturamentoContratoTab.tsx`.
- Confirmação de que `contrato` está vazio (decisão pendente: promover de `mz_50_fato_orcamento_contratos_competencia` ou aguardar carga oficial de receita).

## Bloco 1 — Auditoria técnica completa (~7 créditos)

- Inventário de rotas, telas, hooks e RPCs.
- Mapa de duplicidades (`conciliacao_regra` vs `conciliacao_regras`, views `mz_*` vs produtivas).
- RLS atual por tabela sensível, roles existentes, `has_role`, `get_user_empresa`.
- Entrega: relatório `.lovable/auditoria-v2.md`.

## Bloco 2 — Governança de carga + dedupe (~20 créditos)

- Tabela `carga_lote` (batch_id, arquivo, usuário, status, totais, hash).
- Coluna `hash_dedup` + índice único parcial nas tabelas-fato produtivas.
- Função `fn_simular_carga(batch_id)` → retorna {novos, duplicados, pendentes, bloqueados, reconciliação}.
- Função `fn_promover_lote(batch_id)` e `fn_rollback_lote(batch_id)`.
- Tela `Admin > Cargas` com diagnóstico/aprovação/promoção/rollback.

## Bloco 3 — De-para empresa / CC / contrato / conta / DRE (~16 créditos)

- Tabelas `mapa_empresa`, `mapa_centro_custo`, `mapa_contrato`, `mapa_conta`, `mapa_dre`.
- UI de resolução de pendências (linhas em staging com `status = PENDENTE_*`).
- Bloqueio de promoção enquanto houver pendências críticas.

## Bloco 4 — Promoção `mz_*` → produtivas (~25 créditos)

Promover, com reconciliação por empresa/competência/CC/contrato/conta:

- Razão (`mz_32` → `lancamento_contabil` + `lancamento_partida`).
- Balancete (`mz_33` → views produtivas).
- DRE gerencial (`mz_60`/`mz_61` → `realizado_lancamentos` + `dre_linhas`).
- Orçamento de contratos (`mz_50` → `orcamento_contrato` + `orcamento_contrato_linha`).
- Cabeçalhos de contrato + cronograma de faturamento (decisão da Opção A/C que ficou pendente).

## Bloco 5 — Orçamento integrado (~16 créditos)

- Validação por linha de rateio (empresa+competência+CC+contrato+conta+valor).
- Status orçado×realizado com 5 estados (dentro/atenção/excedido/sem orçamento/sem classificação).
- Bloqueio de pré-título quando excedido sem aprovação.
- View `v_orcado_realizado` consolidada.

## Bloco 6 — Fluxo de caixa projetado + realizado (~16 créditos)

- Reaproveitar `fluxo_caixa_projetado`, `movimento_bancario`, `extrato_bancario`.
- Views `v_fluxo_diario`, `v_fluxo_mensal`, `v_fluxo_matricial` (por empresa/CC/contrato).
- Separação operacional / administrativa / financeira / não operacional / intercompany / aplicações.
- Tela `Financeiro > Fluxo de Caixa` com toggle projetado/realizado e drill-down.

## Bloco 7 — Razão / DRE gerencial completo (~20 créditos)

- Validador de partidas dobradas (trigger).
- Balancete por período/empresa.
- DRE gerencial por empresa, CC e contrato (competência).
- View `vw_dre_contrato` produtiva (não `mz_*`).
- Tela `Contábil > DRE Gerencial` com orçado×realizado e variação R$/%.

## Bloco 8 — Financeiro operacional ponta-a-ponta (~30 créditos)

Fechar o fluxo a partir do que já começamos no Faturamento:

- **Receber**: terminar Etapas 2-5 do plano atual (emissão lote, baixa, conciliação, régua já existente).
- **Pagar**: pré-título → fornecedor → anexo → justificativa → rateio → aprovação por alçada → título → programação → horário de corte → malote → execução → comprovante → conciliação.
- Validação de orçamento (Bloco 5) integrada na aprovação.
- Dupla partida automática (Bloco 7) na baixa.

## Bloco 9 — Painel Executivo Presidência (~25 créditos)

- Role `presidencia` (migration de `app_role` enum + `role_permissions`).
- Rota `/app/presidencia/painel` protegida.
- 7 views novas: `vw_presidencia_resumo_executivo`, `_caixa_capital_giro`, `_pagamentos`, `_faturamento_recebiveis`, `_dre_consolidada`, `_contratos_margem`, `_pendencias_governanca`.
- 18 cards superiores + 7 blocos (A-G) com drill-down.
- Filtros globais: período, empresa, CC, contrato, status, consolidado/individual, caixa/competência.

## Bloco 10 — Testes por role/empresa (~9 créditos)

- 25 cenários do item 11 do prompt.
- Vitest + testes manuais documentados.
- Matriz role × empresa × tela.

## Bloco 11 — Homologação + ajustes UX (~12 créditos)

- Buffer para iterações visuais do painel e correções de aprovação por alçada.

## Bloco 12 — Rollback / observabilidade / relatórios de carga (~7 créditos)

- Snapshots antes/depois.
- Logs estruturados por batch.
- Tela `Admin > Auditoria de Cargas`.

---

## Detalhes técnicos

```text
[Carga arquivo] → staging → simulação → de-para → reconciliação
                                                       │
                                                       ▼
                                               aprovação do lote
                                                       │
                                                       ▼
              ┌─────────── promoção controlada ────────┴────────┐
              ▼              ▼              ▼              ▼     ▼
     orcamento_*    lancamento_*    fluxo_caixa_*    titulo_*   contrato
              │              │              │              │     │
              └──────────────┴──── views v_* / vw_* ───────┴─────┘
                                       │
                                       ▼
                  Telas operacionais + Painel Presidência
```

Princípios mantidos em todos os blocos:
- Nada de `mz_*` em runtime — apenas via promoção.
- `empresa_id` obrigatório em toda fato; consolidação só para `presidencia`/`admin_master`.
- Caixa e competência nunca se misturam.
- Pagamento baixa obrigação, não cria despesa. Recebimento baixa direito, não cria receita.
- RLS sempre ativa; nenhuma policy alterada sem aprovação explícita.

## Total e checkpoints

| Bloco | Créditos prováveis |
|---|---:|
| 1. Auditoria | 7 |
| 2. Governança/dedupe | 20 |
| 3. De-para | 16 |
| 4. Promoção mz_* | 25 |
| 5. Orçamento | 16 |
| 6. Fluxo | 16 |
| 7. Razão/DRE | 20 |
| 8. Financeiro op. | 30 |
| 9. Painel Presidência | 25 |
| 10. Testes | 9 |
| 11. Homologação | 12 |
| 12. Rollback/obs. | 7 |
| **Total** | **~203** |

**Checkpoints de aprovação obrigatórios** (paro e aguardo seu OK):
- Após Bloco 1 (auditoria).
- Após Bloco 4 (antes de promover dados produtivos).
- Após Bloco 8 (antes do Painel).
- Após Bloco 9 (antes da liberação).

Em cada checkpoint você pode redirecionar/cortar escopo sem perder o que já foi feito.
