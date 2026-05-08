
# Plano de Implantação V2 — Grupo Nascimento / SPNE
**Modo: PLANEJAMENTO. Nenhuma alteração foi aplicada (banco, código, RLS, migrations, storage, dados).**

---

## 1. Diagnóstico do que já existe

### 1.1. Módulos e rotas (src/App.tsx → src/pages/*)
- **Financeiro:** `ContasPagar`, `ContasReceber` (Títulos, Faturamento, Cobrança, Régua), `MovimentosBancarios`, `IntegracaoBancaria` (+ Builder em 5 etapas).
- **Contábil:** `PlanoContas`, `Lancamentos`, `RegrasContabilizacao`, `Balancete`, `DRE`, `Balanco`, `AprovacaoContas`.
- **Controladoria:** `Empresas`, `CentrosCusto`, `Classificadores`, `DRE` (gerencial), `PlanejadorOBZ`.
- **Contratos:** ciclo completo (Implantação → Postos → Medições → Faturamento → Reajustes → Empenhos → Encerramentos → Detalhe).
- **Fiscal:** `NotasFiscais`, `ApuracaoImpostos`, `Config/Parametros`.
- **Suprimentos / RH / Pareceres / Licitações / BI Dashboard / Administração / MigracaoZero / Integração (Batches, Stepper, Aliases).**
- **Painel Executivo:** já existe `src/pages/PainelExecutivo.tsx` (precisa ser auditado e estendido — não recriar).

### 1.2. Banco (segundo `02_DB_DICTIONARY` e introspecção anterior)
- **Núcleo multitenant:** `empresas`, `profiles` (+ `empresa_id`), `user_roles`, `role_permissions`, `has_role()`, `get_user_empresa(auth.uid())`.
- **Contratos/Custo:** `contrato`, `contrato_posto`, `cronograma_faturamento`, `centros_custo`.
- **Orçamento:** `orcamento_ciclo`, `orcamento_contrato`, `orcamento_contrato_linha`, `parametro_orcamento`, `obz_versoes/periodos/valores`, `v_obz_mensal`.
- **Financeiro:** `titulo_pagar`, `titulo_receber`, `titulo_receber_baixa`, `fluxo_caixa_projetado`, `movimento_bancario`, `extrato_bancario`, `conta_bancaria`, `conciliacao_match`, `conciliacao_regra` **e** `conciliacao_regras` (⚠ duplicidade), `banco_layout*`, `remessa_cnab_titulo`, `cobranca_*`, `regua_cobranca*`.
- **Contábil/DRE/BI:** `lancamento_contabil`, `lancamento_partida`, `conta_contabil`, `plano_contas_master`, `plano_contas_solicitacao`, `regra_contabilizacao`, `dre_linhas`, `realizado_lotes`, `realizado_lancamentos`, `v_dre_comparativo`, `v_realizado_mensal`, `v_fluxo_caixa_mensal`, `vw_bi_resumo_empresa`, `vw_dre_contrato`.
- **Staging/migração (NÃO usar em runtime):** `mz_32_fato_razao_contabil`, `mz_33_fato_balancete`, `mz_60_view_dre_gerencial_competencia`, `mz_61_view_dre_caixa_gerencial`, demais `mz_*`. Edge: `mz-load`, `pacote02-load`.

---

## 2. Telas/rotas afetadas (extensão, sem refatoração fora de escopo)
| Bloco | Tela existente | Ação |
|---|---|---|
| Financeiro | ContasPagar, ContasReceber, MovBancarios, IntegracaoBancaria | Complementar fluxo solicitação→aprovação→título→programação→pagamento→conciliação |
| Orçamento | PlanejadorOBZ, controladoria/DRE | Adicionar validação por linha de rateio (orçado×realizado×excedido×sem orçamento) |
| Fluxo Caixa | (a criar) `/financeiro/fluxo-caixa` (diário, mensal, matricial) | Nova tela + novas views |
| Contábil | Lancamentos, Balancete, DRE | Garantir dupla partida, drill-down até origem |
| Presidência | `PainelExecutivo.tsx` | Estender com blocos A–G + role `presidencia` |
| Carga | `admin/MigracaoZero`, `integracao/Batches` | Reforçar governança (de-para, dedup, prévia, aprovação, promoção) |

---

## 3. Tabelas/Views/RPCs/Functions/Triggers afetadas

**A criar (apenas após aprovação):**
- `vw_presidencia_resumo_executivo`, `vw_presidencia_caixa_capital_giro`, `vw_presidencia_pagamentos`, `vw_presidencia_faturamento_recebiveis`, `vw_presidencia_dre_consolidada`, `vw_presidencia_contratos_margem`, `vw_presidencia_pendencias_governanca`.
- RPCs: `rpc_presidencia_capital_giro(periodo, empresa_ids[])`, `rpc_carga_simular(batch_id)`, `rpc_carga_promover(batch_id)`, `rpc_carga_rollback(batch_id)`.
- Tabelas de governança de carga: `carga_lote` (id, arquivo, origem, status, criado_por), `carga_de_para_empresa`, `carga_de_para_centro_custo`, `carga_de_para_contrato`, `carga_de_para_conta`, `carga_pendencia` (motivo, registro_ref). Coluna `hash_dedup` + índice único onde aplicável (razão, fluxo, orçamento, realizado).
- Triggers: validação dupla partida em `lancamento_partida` (somatório débito=crédito por `lancamento_contabil_id`); validação `centro_custo.empresa_id = registro.empresa_id`.

**A consolidar (não duplicar):**
- Decidir entre `conciliacao_regra` vs `conciliacao_regras` antes de qualquer alteração.

**Não tocar em runtime:** todas as `mz_*` permanecem isoladas como staging.

---

## 4. RLS / policies / roles afetadas
- Usar **somente** `has_role(auth.uid(), <role>)` e `get_user_empresa(auth.uid())`.
- **Nova role `presidencia`** (proposta — requer migration aprovada no enum `app_role` e em `role_permissions`).
- RLS em todas as views novas: filtro por `empresa_id IN (empresas autorizadas ao usuário)`; consolidação multiempresa apenas se `has_role('presidencia') OR has_role('admin_master')`.
- Frontend: anon key apenas. Nenhum check via `localStorage`.

---

## 5. Lacunas identificadas
1. Razão contábil produtiva atualmente reside em `mz_32_*` (staging). Falta camada de promoção controlada para `lancamento_contabil` + `lancamento_partida`.
2. Fluxo de caixa diário/matricial não tem tela própria (existe view mensal).
3. Orçamento não tem motor de validação em tempo de criação de pré-título (gate orçamentário).
4. Capital de giro não possui view/RPC consolidada por janela (7/15/30 dias).
5. Painel Presidência atual não tem blocos A–G nem role-gate `presidencia`.
6. Falta `hash_dedup` em algumas tabelas-fato.
7. Duplicidade `conciliacao_regra` vs `conciliacao_regras` não resolvida.
8. Falta de-para de empresas/centros/contratos formalizados (atualmente inferido por sigla).

---

## 6. Plano de carga produtiva governada
Pipeline obrigatório (sem destrutivo, sem mock, sem inferência por nome):

```text
Upload → Staging (mz_*) → Diagnóstico colunas → Normalização
  → De-Para empresa → De-Para CC → De-Para contrato → De-Para conta → De-Para DRE
  → Validação competência → Validação caixa → Dedup (hash_dedup)
  → Prévia reconciliação (empresa, competência, CC, contrato, conta, DRE, fluxo)
  → Aprovação do lote (carga_lote.status='APROVADO')
  → Promoção controlada (RPC) para tabelas produtivas
  → Log de promoção + relatório → Rollback disponível por batch_id
```

Regras: ambíguo = `PENDENTE_EMPRESA` (não promove). Sem `empresa_id` = bloqueio. CC de outra empresa = bloqueio. Diferença não explicada na reconciliação = bloqueio.

---

## 7. Plano para evitar duplicidade por empresa
- `hash_dedup = sha256(empresa_id|origem_tipo|id_origem|arquivo|linha|documento|data_comp|data_caixa|valor|conta|cc|contrato)`.
- Índice único parcial em cada fato produtivo (`lancamento_contabil`, `realizado_lancamentos`, `fluxo_caixa_projetado`, `titulo_*`).
- Pré-insert: `EXISTS hash_dedup` → marca duplicado, não insere.
- Reconciliação obrigatória **por empresa** antes de promover (nunca replicar mesma base entre empresas).

---

## 8. Views/RPCs propostas para o painel
Lista do item 3 acima. Todas com:
- `SECURITY INVOKER` (default), filtro `empresa_id` aplicado por RLS subjacente das tabelas-fonte.
- Ou `SECURITY DEFINER` apenas se necessário para agregação cross-empresa, com `WHERE has_role(auth.uid(),'presidencia')` interno.

---

## 9. UX do Painel Presidência
- Rota: `/app/presidencia/painel-executivo` (ou estender `/app` PainelExecutivo).
- Topo: filtros globais (período, empresa, CC, contrato, caixa|competência, consolidado|individual).
- 18 cards executivos (item 7.3 do prompt) com drill-down lateral (Sheet).
- Blocos A–G (Visão Grupo, Caixa/NCG, Pagamentos, Faturamento/Recebíveis, DRE, Contratos, Governança).
- Visual: cards + gráficos (Recharts já no stack), badges de risco, alertas críticos no topo, exportar PDF/Excel se padrão existente.
- Componentes existentes reutilizados: `PageHeader`, `EntityCrudPage`, `Tabs`, `StatusChip`, `RoleGate`.

---

## 10. Riscos classificados
| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Promover dados sem `empresa_id` único | **Crítico** | Bloqueio em RPC, status PENDENTE |
| R2 | Duplicar razão por reimportação | **Crítico** | `hash_dedup` único |
| R3 | Misturar caixa × competência | Alto | Filtro explícito no painel; views separadas |
| R4 | Pagamento gerar nova despesa na DRE | Alto | Trigger/regra: pagamento só baixa título |
| R5 | Vazamento entre empresas | **Crítico** | RLS por `empresa_id` em todas as views novas |
| R6 | Dashboard ligado a `mz_*` | Alto | Proibido — apenas tabelas/views produtivas |
| R7 | Conflito `conciliacao_regra` × `conciliacao_regras` | Médio | Decidir antes de qualquer alteração |
| R8 | Editar migration aplicada | **Crítico** | Sempre nova migration |
| R9 | Service role no frontend | **Crítico** | Apenas anon; service role só em edge functions |
| R10 | Refator fora do escopo | Médio | Travado por este plano |

---

## 11. Bloqueios atuais (precisam de decisão antes de implementar)
1. Aprovar criação da role `presidencia` no enum `app_role` (ou usar `admin_master`).
2. Decidir destino de `conciliacao_regra` vs `conciliacao_regras`.
3. Confirmar de-para oficial de siglas (RAC, SPNE, AGPS, CANAA, HAGG, LF, NH, SN) → CNPJ → `empresas.id`.
4. Aprovar criação das 7 views `vw_presidencia_*` e RPCs de carga.
5. Aprovar adição de `hash_dedup` + índice único nos fatos produtivos.

---

## 12. Plano de testes (25 cenários do item 11 do prompt)
Agrupados em: **Carga (1–7)**, **Financeiro↔Caixa↔DRE (8–11)**, **Competência/Orçamento (12–16)**, **Painel/RBAC (17–20)**, **Drill-down/Governança (21–25)**. Cada teste com: pré-condição, ação, resultado esperado, evidência (SQL + screenshot).

---

## 13. Rollback
- **Frontend:** revert do commit.
- **Migration:** sempre nova migration de reversão (nunca editar a aplicada).
- **Views:** recriar versão anterior via migration.
- **Carga:** `rpc_carga_rollback(batch_id)` — remove apenas registros do `batch_id`, preserva histórico em `carga_lote.status='REVERTIDO'`.
- **Policies:** restaurar versão anterior somente com aprovação.
- **Anexos/Snapshots:** preservar trilha; nunca apagar sem política.

---

## 14. Ordem de implementação (após aprovação)
1. **Bloco 1** — Auditoria técnica (read-only): mapa rotas↔tabelas↔views, lista de gaps confirmada.
2. **Bloco 2** — Governança de carga: tabelas `carga_lote` + de-para + `hash_dedup` + RPCs simular/promover/rollback.
3. **Bloco 3** — De-para empresa/CC/contrato/conta validados com usuário.
4. **Bloco 4** — Promoção controlada `mz_32_*` → `lancamento_contabil/partida` (lote teste 1 empresa).
5. **Bloco 5** — Orçamento integrado (gate em pré-título).
6. **Bloco 6** — Fluxo de caixa (tela diária + matricial + views).
7. **Bloco 7** — Razão/DRE com drill-down até origem.
8. **Bloco 8** — Financeiro operacional completo (solicitação→pagamento→conciliação).
9. **Bloco 9** — Painel Presidência (role + 7 views + 18 cards + blocos A–G).
10. **Bloco 10** — Testes por role/empresa (25 cenários).
11. **Bloco 11** — Homologação com Presidência.
12. **Bloco 12** — Liberação controlada por empresa.

---

## 15. Confirmação
**Nenhuma alteração foi aplicada em banco, frontend, backend, RLS, policies, functions, migrations, storage, autenticação, dados produtivos ou GitHub.** Esta entrega é exclusivamente o plano técnico solicitado no item 13 do prompt V2. Aguardando aprovação explícita para iniciar pelo **Bloco 1 — Auditoria técnica (read-only)**.
