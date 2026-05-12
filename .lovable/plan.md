# Diagnóstico Inicial — 3 Telas Financeiras

> **Nenhuma alteração de código, schema, RLS ou dado foi executada.** Este documento é apenas plano. Aguardando aprovação explícita.

---

## 1. Estrutura financeira existente encontrada

**Tabelas (schema `public`)**
- `titulo_pagar` — núcleo da obrigação. Já possui: `data_pagamento`, `valor_pago`, `status`, `conta_bancaria_id`, `aprovador_id`, `aprovado_em`, `motivo_rejeicao`, `forma_pagamento`, `competencia`, `data_vencimento`, `centro_custo_id`, `contrato_id`, `fornecedor_id`, `pedido_id`.
- `pre_titulo_pagar` + `pre_titulo_rateio` + `pre_titulo_anexo` — staging antes de virar título (NF/manual). Possui `aprovador_id`, `aprovado_em`, `motivo_rejeicao`, `solicitante_id`, `titulo_pagar_id` (após promoção).
- `malote_pagamento` + `malote_titulo` — agrupamento operacional já existente. `status`, `data_pagamento`, `qtd_titulos`, `valor_total`, `remessa_id`, `enviado_em`, `executado_em`.
- `conta_bancaria`, `movimento_bancario` (já com `titulo_pagar_id`, `conciliado`), `extrato_bancario`.
- `conciliacao_match`, `conciliacao_regra(s)` — conciliação extrato × título.
- `aprov_etapa`, `aprov_instancia`, `sup_aprov_*` — motor de alçadas (genérico + suprimentos).
- `anexos` — repositório de anexos (uso geral).
- `retorno_bancario`, `retorno_bancario_ocorrencia`, `remessa_cnab_titulo` — CNAB.

**Funções/RPCs já existentes**
- `titulo_pagar_baixar`, `titulo_baixar` — **baixa oficial (não duplicar lógica).**
- `contabilizar_baixa_pagar`, `trg_titulo_pagar_contabiliza` — contabilização automática.
- `malote_criar`, `malote_adicionar_titulo`, `malote_remover_titulo`, `malote_executar` — agrupamento operacional.
- `pre_titulo_submeter / aprovar / rejeitar / promover` — staging.
- `conciliacao_auto_match`.
- `sup_aprov_avaliar_etapa`, `promover_contas_aprovadas`.

**Telas existentes (`src/pages/financeiro/`)**
- `ContasPagar.tsx` (com abas `pagar/PreTitulosTab.tsx`, `pagar/MalotesTab.tsx`)
- `ContasReceber.tsx`, `FluxoCaixa.tsx`, `FluxoCaixaDiario.tsx`
- `ConciliacaoFluxoCaixa.tsx`
- `MovimentosBancarios.tsx`
- `IntegracaoBancaria.tsx` + builder

## 2. Rotas/telas existentes reaproveitáveis

| Necessidade | Reaproveitar | Decisão |
|---|---|---|
| Tela 1 — Análise por Período | `ContasPagar.tsx` | **Adaptar** (nova aba "Análise por Período" e expansão dos filtros/cards). Não criar rota nova. |
| Tela 2 — Programação | `pagar/MalotesTab.tsx` + `malote_pagamento` | **Reaproveitar como base** (renomear UX para "Programação", manter `malote_*` no banco como entidade técnica de agrupamento; programação = malote enriquecido com aprovação e datas). |
| Tela 7 — Validação Pós-Pagamento | nada equivalente | **Criar** (rota `/app/financeiro/validacao-pos-pagamento`). |

## 3. Como as 3 telas cobrem o processo completo

```text
[Tela 1 Análise] -> seleciona títulos -> [Tela 2 Programação]
   (filtra carteira)        (data, banco, prioridade)
                                   |
                            aba Aprovações (alçada)
                                   |
                            aba Lote operacional -> malote_executar -> titulo_pagar_baixar
                                                                              |
                                                              [Tela 7 Validação Pós-Pagamento]
                                                                  conferência aprovado x pago
                                                                  comprovante / baixa / movimento
                                                                  envia p/ conciliação -> conciliacao_match
                                                                  arquiva
```

## 4. Tela 1 — Contas a Pagar / Análise por Período

- **Local:** nova aba dentro de `ContasPagar.tsx` ("Análise por Período"), além das já existentes.
- **Fonte:** `titulo_pagar` (já tem todos os campos exigidos pelo escopo).
- **Filtros, cards, grade, botões, regras de bloqueio:** conforme escopo (sem reescrever aqui).
- **Saída:** `selectedTitulos[]` em estado/contexto consumido pela Tela 2 via navegação (`navigate('/app/financeiro/programacao-pagamentos', { state })`) ou query param de IDs.

## 5. Tela 2 — Programação de Pagamentos

- **Rota nova:** `/app/financeiro/programacao-pagamentos` (única rota nova autorizada além da Tela 7).
- **Reuso:** entidade `malote_pagamento` + `malote_titulo` como persistência. Renomear apenas no UX para "Programação". Funções `malote_criar`, `malote_adicionar_titulo`, `malote_remover_titulo`, `malote_executar` continuam sendo o caminho oficial.
- **Abas internas (sem novas telas):** `Títulos Programados`, `Resumo por Data`, `Resumo por Banco`, `Resumo por Empresa`, `Pendências`, `Histórico`, `Aprovações`.
- **Aprovações:** integrar com motor existente `aprov_etapa` / `aprov_instancia` via nova função RPC `programacao_submeter_aprovacao` (proposta — ver §16). Não criar tela separada.
- **Lote operacional:** botão "Gerar lote" dentro da aba Resumo — chama `malote_criar` agrupando por (empresa, banco, data). **Mantém apenas títulos com programação aprovada.**
- **Bloqueio de edição após envio para aprovação:** controlado por `status` da programação.

## 6. Tela 7 — Validação Pós-Pagamento

- **Rota nova:** `/app/financeiro/validacao-pos-pagamento`.
- **Fonte:** `titulo_pagar` (status pago) + `movimento_bancario` (vínculo via `titulo_pagar_id`) + nova tabela `financeiro_pagamento_validacao` (proposta) + `anexos` (comprovante) + `conciliacao_match`.
- **Comparativos:** valor aprovado (snapshot na programação) × `valor_pago`; data programada × `data_pagamento`; conta prevista × conta usada (movimento).
- **Ações:** marcar conforme/divergente, abrir divergência, anexar evidência, enviar para conciliação (cria/triggera `conciliacao_auto_match` ou registra pendência), arquivar.

## 7. Componentes, abas, modais e ações internas necessários

- `AnalisePeriodoTab` (componente em `pagar/`).
- `ProgramacaoPagamentosPage` + sub-componentes: `ProgramacaoHeader`, `ItensTab`, `ResumoDataTab`, `ResumoBancoTab`, `ResumoEmpresaTab`, `PendenciasTab`, `HistoricoTab`, `AprovacoesTab`, `LoteOperacionalDrawer`.
- `ValidacaoPosPagamentoPage` + `ChecklistLateral`, `DivergenciaDialog`, `ComprovanteViewer`, `EnviarConciliacaoDialog`.
- Hooks: `useTitulosPagarAnalise`, `useProgramacaoPagamento`, `useProgramacaoAprovacao`, `useValidacaoPagamento`.

## 8. Tabelas existentes impactadas

- `titulo_pagar` — somente leitura + escrita via RPCs já existentes (`titulo_pagar_baixar`).
- `malote_pagamento`, `malote_titulo` — receber novos campos (ver §9).
- `aprov_instancia`, `aprov_etapa` — instanciar para programação.
- `movimento_bancario` — leitura para validação.
- `anexos` — referenciar comprovante.

## 9. Tabelas novas propostas (somente se aprovadas)

- **`financeiro_programacao_extensao`** (1‑1 com `malote_pagamento`): `prioridade`, `urgencia`, `excecao`, `justificativa`, `periodo_inicio`, `periodo_fim`, `enviado_aprovacao_por/em`, `observacao`. *(Alternativa: alterar `malote_pagamento` adicionando colunas — preferível, menor fragmentação.)*
- **`financeiro_programacao_item_extensao`** (1‑1 com `malote_titulo`): `valor_programado`, `prioridade`, `motivo_bloqueio`, `observacao`. *(Idem: pode virar colunas em `malote_titulo`.)*
- **`financeiro_pagamento_aprovacao`**: vínculo programação ↔ `aprov_instancia`, snapshot `valor_aprovado`, `data_pagamento_aprovada`, `etapa`, `decisao`, `aprovador_id`, `justificativa`, `decidido_em`.
- **`financeiro_pagamento_validacao`**: registro de validação por título pago — campos exatos conforme §8 do escopo.
- **`financeiro_pagamento_log`**: auditoria cross (programação, aprovação, validação).

> **Pré-malote: NÃO será criado.** Continuamos com `pre_titulo_pagar` apenas no fluxo NF→título já existente (não confundir com o conceito proibido).

## 10. Campos obrigatórios

Conforme §8 do escopo do usuário — preservados integralmente.

## 11. Integração com aprovação de pagamento

- Reuso de `aprov_etapa` (alçadas por `valor_min/valor_max` + `role_required`) e `aprov_instancia`.
- Nova RPC: `programacao_submeter_aprovacao(programacao_id)` cria instância na primeira etapa elegível pelo `valor_total`.
- Nova RPC: `programacao_decidir(programacao_id, decisao, justificativa)` registra voto, avança etapa ou consolida `status='aprovada'/'reprovada'`.
- Edição após aprovação → reabrir aprovação (status volta para `rascunho` com flag `reaberto`).

## 12. Integração com baixa de título

- **Não duplicar.** Usar `titulo_pagar_baixar` (e `malote_executar` que já invoca a baixa).
- Trigger `trg_titulo_pagar_contabiliza` permanece intacta.
- Pagamento **não cria despesa** — apenas baixa obrigação. Confirmado pelas funções existentes.

## 13. Integração com comprovantes

- Reuso de `anexos` com `entidade='titulo_pagar'` e `entidade_id=titulo.id` (ou `programacao_id`).
- Storage bucket existente (verificar nome no projeto antes da implementação).

## 14. Integração com conciliação

- "Enviar para conciliação" → garante registro em `movimento_bancario` vinculado e dispara `conciliacao_auto_match`.
- Pendências aparecem na Tela 7 enquanto `conciliacao_match` não existir para o título.

## 15. RLS, roles e policies

- Todas as tabelas novas: RLS ON, política por `empresa_id` (usar função `get_user_empresa_id()` se já existir; senão, padrão `user_roles` + `has_role`).
- Roles consumidos: `admin`, `financeiro`, `financeiro_operacional`, `financeiro_gestor`, `aprovador_pagamento`, `diretor_adm`, `diretor_op`, `presidencia`, `controladoria`. Verificar enum `app_role` antes (se faltar, propor `ALTER TYPE` em migration separada para aprovação explícita).
- Nenhuma policy existente será alterada sem aprovação.

## 16. Migrations necessárias (a aplicar somente após aprovação)

1. **M1 — Extensão de `malote_pagamento` / `malote_titulo`** com colunas de programação (prioridade, urgência, exceção, justificativa, período, observação, valor_programado, motivo_bloqueio).
2. **M2 — Tabela `financeiro_pagamento_aprovacao`** + índices + RLS.
3. **M3 — Tabela `financeiro_pagamento_validacao`** + índices + RLS.
4. **M4 — Tabela `financeiro_pagamento_log`** + RLS.
5. **M5 — RPCs**: `programacao_submeter_aprovacao`, `programacao_decidir`, `programacao_reabrir`, `validacao_registrar`, `validacao_enviar_conciliacao`.
6. **M6 (condicional)** — adicionar valores ao enum `app_role` se faltarem.

Cada migration entra como **arquivo separado**, sem editar migrations já aplicadas.

## 17. Riscos e severidade

| Risco | Sev. | Mitigação |
|---|---|---|
| Confusão semântica `malote` ↔ `programação` | Médio | UI usa "Programação"; banco preserva `malote_*`. Documentar. |
| Pagamento sem aprovação por bypass de UI | **Alto** | Validação no RPC `malote_executar` (adicionar guard `programacao_aprovada=true`). |
| Edição após aprovação | Alto | Bloqueio por `status` + RLS update condicional. |
| Duplicação de baixa | Alto | Manter exclusivamente `titulo_pagar_baixar`. |
| Multi-empresa | Alto | RLS por `empresa_id` + filtros server-side. |
| Performance da Tela 1 com 50k+ títulos | Médio | Paginação server-side, índices em `(empresa_id, status, data_vencimento)`. |
| Quebra de telas existentes (`MalotesTab`, `PreTitulosTab`, `ContasPagar`) | Alto | Adições aditivas; nenhuma coluna removida; testes de regressão. |

## 18. Testes obrigatórios

Conforme §11 do escopo — Tela 1, Tela 2, Tela 7, segurança multi-empresa, regras contábeis. Plano detalhado será entregue junto da implementação.

## 19. Rollback

- Migrations idempotentes com `DROP IF EXISTS` documentado em comentário (não executar em rollback automático).
- Plano de rollback por migration: M5→M4→M3→M2→M1.
- Frontend: rotas novas isoladas; remoção via revert do PR sem afetar `ContasPagar`/`Malotes` originais.
- Dados: novas tabelas vazias até execução manual; rollback = `TRUNCATE` + `DROP`.

## 20. Pendências para aprovação

1. Confirmar **estratégia de extensão** de `malote_pagamento`: adicionar colunas (preferido) **ou** tabela 1‑1 separada?
2. Confirmar **enum `app_role`**: posso ler o enum atual para checar se `aprovador_pagamento`, `financeiro_operacional`, `financeiro_gestor`, `presidencia` existem? (operação read-only, sem aplicar mudança)
3. Confirmar **storage bucket** de comprovantes (nome) — para Tela 7.
4. Confirmar que `malote_executar` pode ser ajustado para exigir `programacao_aprovada` (mudança de comportamento sensível).
5. Aprovar lista de migrations M1–M6 antes de qualquer alteração.

---

**Plano concluído. Nenhuma alteração foi executada. Aguardando aprovação explícita para implementar.**
