# Análise — Lotes de Ajuste Contábil com Aprovação da Controladoria

**Contexto:** complemento ao plano de promoção `mz_* → tabelas transacionais` (Item 8).
**Data:** 2026-05-20
**Origem:** chat — usuário descreveu cenário de ajuste de faturamento (débito em "clientes a receber" + crédito em "faturamento bruto" na DRE conforme contrato) executado em lote, com aprovação obrigatória da Controladoria.

---

## 1. O que o usuário descreveu (em linguagem contábil)

> "Se eu precisar fazer um ajuste de faturamento debitando um valor faturamento em clientes a receber, eu preciso também creditar em faturamento bruto na dre de acordo com o contrato, e esse lote precisa ser aprovado pela controladoria para poder ser contabilizado corretamente, e automaticamente altera essas telas que estamos conversando."

Traduzindo:
- **Origem do ajuste**: usuário com perfil "ajuste em lote" (provavelmente Helena/Controladoria/Contabilidade).
- **Natureza**: partida dobrada — toda linha de débito precisa de uma linha de crédito de igual valor, vinculada a:
  - Conta contábil (plano de contas)
  - Centro de custo
  - **Contrato** (origem do faturamento)
  - Empresa
  - Período de competência
- **Fluxo de aprovação**: lote entra em `pendente` → Controladoria aprova/reprova → se aprovado, **só então** as linhas viram lançamentos efetivos em `lancamento_partida` / `realizado_lancamentos` / `titulo_receber`.
- **Efeito cascata automático** (após aprovação):
  - DRE Realizada (faturamento bruto sobe)
  - Razão (movimento nas duas contas)
  - Balancete (saldos atualizados)
  - FCD se o ajuste tiver previsão de caixa
  - Posição de títulos a receber por contrato
  - Indicadores de margem por contrato (Controladoria)

---

## 2. Por que isso muda o desenho da Onda 1

Antes (plano original): promoção `mz_*` era apenas movimentação **histórica**. Novas inclusões viriam só de baixas de pagamento, NF, etc. — operações **atômicas** (1 evento = 1 par débito/crédito).

Agora: existe um **terceiro caminho de entrada** nas tabelas transacionais:

```text
┌──────────────────┐
│   Origem dos     │
│  lançamentos     │
└────────┬─────────┘
         │
         ├── 'mz_carga'      → cargas históricas (Integrações/Migrações)  [já existe]
         ├── 'app'           → eventos atômicos (baixa, NF, recebimento)  [já existe]
         ├── 'integracao'    → edge functions mz-load/fcr-load/pacote02   [já existe]
         └── 'ajuste_lote'   → LOTES de ajuste com aprovação Controladoria  [NOVO]
```

A diferença crítica: `ajuste_lote` precisa de **estado intermediário** (`rascunho → pendente → aprovado/reprovado → contabilizado`) antes de virar lançamento efetivo. As outras 3 origens já entram contabilizadas.

---

## 3. Modelo de dados proposto

### 3.1 Tabela mestre do lote
`ajuste_lote_contabil`
- `empresa_id` (filtrado por RLS multiempresa)
- `numero_lote` (sequencial por empresa/ano)
- `tipo_ajuste` (`reclassificacao` | `correcao_faturamento` | `provisao` | `estorno` | `outro`)
- `competencia` (YYYY-MM)
- `descricao`, `justificativa`
- `valor_total_debito`, `valor_total_credito` (devem ser iguais — validação)
- `quantidade_linhas`
- `status` (`rascunho` | `pendente_aprovacao` | `aprovado` | `reprovado` | `contabilizado` | `estornado`)
- `criado_por`, `criado_em`
- `aprovado_por`, `aprovado_em`, `parecer_aprovacao`
- `contabilizado_em` (quando o engine efetiva)
- `lote_estorno_de` (FK auto-relacionada, para estornos)

### 3.2 Linhas do lote (staging — não aparece em DRE até aprovação)
`ajuste_lote_contabil_linha`
- `lote_id` (FK)
- `tipo` (`D` | `C`)
- `conta_contabil_id`
- `centro_custo_id` (nullable)
- `contrato_id` (nullable — obrigatório quando conta é de receita de contrato)
- `valor`
- `historico` (texto)
- `data_competencia`
- `documento_referencia` (NF, contrato, parcela, etc.)

### 3.3 Vínculo após contabilização
- Quando aprovado, o engine cria registros em:
  - `lancamento_partida` (uma linha por linha do lote)
  - `lancamento_partida_centro` (rateio por CC)
  - `titulo_receber` ou `titulo_pagar` (quando a linha tem natureza de título)
  - `realizado_lancamentos` (impacto em FCR se for caixa)
- Todas essas linhas carregam `origem = 'ajuste_lote'` e `ajuste_lote_id = <id>` para rastreabilidade.
- **Estorno**: cria um novo lote com sinais invertidos, vinculado via `lote_estorno_de`. Nunca apaga o histórico.

---

## 4. Fluxo de aprovação (reaproveita motor de alçadas existente)

O sistema **já tem** infraestrutura de alçadas (`AlcadasTab`, `useTemAlcada`, `TimelineAprovacao`, `SaudeAlcadasPanel`). Reaproveitamos:

```text
[Helena cria lote] 
   → status = rascunho 
   → valida totais D=C 
   → submete 
   → status = pendente_aprovacao
   → engine de alçadas calcula aprovador (Controladoria → Diretoria Financeira se > R$ X)
   → notifica inbox /aprovacoes/inbox
[Controladoria abre lote] 
   → vê linhas, contratos afetados, impacto preview na DRE/FCD
   → aprova / devolve / reprova
   → se aprovado:
       → engine assíncrono cria linhas em lancamento_partida + realizado_lancamentos + titulo_receber
       → status = contabilizado
       → atualiza materialized views ou triggers das telas (DRE/Razão/Balancete/FCD)
```

Tipo de aprovação a cadastrar em `tipos_aprovacao`: `ajuste_contabil_lote` com regra de alçada por **valor_total_debito**.

---

## 5. Impacto nas telas já existentes

| Tela | Impacto |
|------|---------|
| `Razao.tsx` | filtra por `origem` se necessário; mostra coluna "Origem" (mz_carga / app / ajuste_lote) |
| `DRE.tsx`, `DREGerencialReal.tsx` | sem mudança de query — passa a refletir ajustes assim que `contabilizado`. Adicionar toggle "incluir ajustes em lote (pendentes)" para simulação |
| `Balancete.tsx` | idem DRE |
| `FluxoCaixaDiario.tsx` | só impactado se ajuste tiver linha de caixa (raro) |
| `ConciliacaoEventos.tsx` | conciliações geradas por ajuste de lote ficam marcadas com badge "Ajuste #LOTE-2026-001" |
| `Aprovacoes/Inbox` | novo tipo `ajuste_contabil_lote` aparece junto com pedido de compra, pré-título etc. |
| `Contabilidade` (page) | nova aba "Ajustes em Lote" com lista, criação, aprovação |

**Nenhuma tela existente precisa ser reescrita** — só adicionar a nova aba e o badge de origem onde fizer sentido.

---

## 6. Onde isso encaixa no roadmap atual

Reordenando as fases discutidas anteriormente:

| Fase | Antes | Agora |
|------|-------|-------|
| **Onda 1** | Preparação (origem/batch_id/mz_origem_id) + relatório de reconciliação | **+ campos `ajuste_lote_id` em lancamento_partida, realizado_lancamentos, titulo_receber/pagar** |
| **Onda 2** | Promoção mz_50 → titulo_pagar/receber | Mantém |
| **Onda 3** | Promoção mz_40 → realizado_lancamentos | Mantém |
| **Onda 4** | Promoção mz_30/31/32 → lancamento_partida | Mantém |
| **Onda 5** | Promoção mz_41 → projecao_fluxo_caixa | Mantém |
| **Onda 6 (NOVA)** | — | **Ajuste em lote: tabelas `ajuste_lote_contabil*`, tela de criação, integração com alçadas, engine de contabilização** |
| **Onda 7** | Remoção das views fallback `mz_*` | Mantém |

A Onda 6 é **independente** das ondas 2–5 do ponto de vista de schema: pode ser construída em paralelo. Mas só faz sentido **rodar em produção** depois da Onda 4 (porque ajuste contabiliza em `lancamento_partida`, que precisa ser a fonte oficial da DRE).

---

## 7. Riscos e mitigações específicos

| Risco | Mitigação |
|-------|-----------|
| Lote aprovado por engano contamina DRE fechada | Bloquear submissão se `competencia` < último período fechado (tabela `periodos_fechados`) |
| Aprovador não enxerga impacto antes de aprovar | Tela de aprovação mostra **preview do delta**: "DRE faturamento bruto Contrato X: R$ 1.2M → R$ 1.25M (+R$ 50k)" |
| D ≠ C passa despercebido | Trigger de validação no submit; UI bloqueia botão se `valor_total_debito != valor_total_credito` |
| Estorno sem rastro | `lote_estorno_de` obrigatório; estorno só permitido por mesmo nível de alçada da aprovação original |
| Concorrência: 2 ajustes no mesmo contrato/competência | Lock otimista por `(contrato_id, competencia)` no momento de contabilizar |
| RLS multiempresa | Aplicar `user_pode_atuar_empresa(auth.uid(), empresa_id)` em todas as policies das novas tabelas — já alinhado com Item 4 |

---

## 8. Esforço estimado adicional (Onda 6)

- Migration: 2 tabelas + índices + triggers de validação D=C → ~1h
- Edge function `ajuste-lote-contabilizar` (executa atômico ao aprovar) → ~3h
- Telas: lista, criação (com importação CSV), aprovação com preview → ~6h
- Integração com `tipos_aprovacao` + alçadas → ~1h
- Testes E2E (criar → aprovar → ver na DRE) → ~2h

**Total Onda 6: ~13h de implementação + 2h de validação assistida.**

---

## 9. Perguntas em aberto para o usuário

1. **Quem cria** o lote? Só Controladoria, ou também Contabilidade / Financeiro?
2. **Alçada de aprovação por valor?** Ex: até R$ 10k → Controladoria; > R$ 10k → Diretoria Financeira.
3. **Importação CSV** de lotes é necessária (cenário de muitas linhas) ou só entrada manual linha-a-linha?
4. **Preview do impacto** deve ser apenas DRE ou também Balancete + posição de títulos por contrato?
5. **Notificação por e-mail** ao aprovador, ou só inbox interno?
6. Quando rodar a Onda 6: **junto com as ondas 4–5** ou em rodada dedicada após validar a promoção?

---

## 10. Recomendação

Não muda a Onda 1 do plano original em termos de execução — apenas **adiciona um campo `ajuste_lote_id uuid NULL`** (FK futura) nas tabelas destino. Esse campo fica nulo até a Onda 6 entrar.

Próximo passo sugerido: rodar **Onda 1 enriquecida** (origem + batch_id + mz_origem_id + ajuste_lote_id) e o relatório de reconciliação. Validamos os totais e só depois discutimos as ondas 2–6.
