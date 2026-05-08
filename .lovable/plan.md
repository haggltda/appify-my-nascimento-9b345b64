# Etapa 1 — Faturamento Contrato → emite `titulo_receber`

## Objetivo

Permitir que, a partir do **Cronograma de Faturamento** (parcelas geradas pelo orçamento de cada contrato), o usuário **emita títulos a receber** de forma controlada, idempotente e auditável — destravando o restante do fluxo financeiro (Receber → Bancário → Baixa → Cobrança).

## Resultado esperado

- Botão **"Emitir título"** por parcela + ação em **lote** (multi-seleção).
- Cada emissão cria 1 registro em `titulo_receber` vinculado à `cronograma_parcela`.
- Status da parcela passa de `previsto` → `emitido`.
- Bloqueio de emissão duplicada (mesma parcela não gera 2 títulos).
- Tela de **Contas a Receber** passa a listar os títulos gerados (já existe, só ganha dados).

---

## Escopo desta etapa

### 1. Banco de dados (1 migração consolidada)

- Adicionar coluna `cronograma_parcela_id uuid` em `titulo_receber` (FK + índice único parcial onde `status <> 'cancelado'`).
- Função `public.fn_emitir_titulo_receber(p_parcela_id uuid)` (SECURITY DEFINER, search_path fixo):
  - Valida: parcela existe, contrato ativo, `valor_previsto > 0`, ainda não emitida.
  - Insere em `titulo_receber` (empresa_id, contrato_id, sacado, valor, vencimento = competência + regra do contrato, número sequencial por empresa).
  - Atualiza `cronograma_parcela.status = 'emitido'`, `valor_emitido`, `data_emissao`.
  - Loga em `mz_29_log` (ou tabela de auditoria existente).
  - Retorna o `titulo_receber.id`.
- Função `public.fn_emitir_titulos_lote(p_parcela_ids uuid[])` — wrapper que itera com tratamento de erro por item e devolve resumo `{sucesso, falha, detalhes}`.
- RLS: políticas de `INSERT`/`UPDATE` já cobertas; funções respeitam `empresa_ativa`.

### 2. Frontend — `src/pages/financeiro/receber/FaturamentoContratoTab.tsx`

- Adicionar coluna de seleção (checkbox) por parcela elegível (status = `previsto`).
- Botão por linha: **Emitir título** (ícone + tooltip).
- Barra de ação em lote: **Emitir N selecionados**.
- Diálogo de confirmação com totais (qtd e R$).
- Toasts de sucesso/erro com link "Ver título" → `/app/financeiro/contas-receber?id=...`.
- Badge de status atualizado em tempo real (invalidate queries).

### 3. Hook — `src/hooks/useTituloReceber.ts` (novo)

- `useEmitirTitulo()` — mutation single (RPC `fn_emitir_titulo_receber`).
- `useEmitirTitulosLote()` — mutation lote (RPC `fn_emitir_titulos_lote`).
- Invalida: `cronograma`, `titulos_receber`, `kpis_financeiro`.

### 4. Ajuste em `Faturamento.tsx` (visão consolidada)

- Tooltip do ícone da parcela mostra: "Emitido em ..." / "Título nº ..." quando aplicável.
- Sem mudança de layout maior — apenas leitura enriquecida.

### 5. Validações & regras de negócio

- Não emitir se parcela `cancelada`, `recebida` ou já `emitida`.
- Sacado do título = cliente do contrato (campo existente).
- Vencimento = `competencia + dias_vencimento` do contrato (fallback 30).
- Numeração: sequencial por `empresa_id` via função existente ou `nextval`.

### 6. Critérios de aceite (checklist para sua avaliação)

1. Emitir 1 parcela isolada → título aparece em Contas a Receber, parcela vira "emitido".
2. Tentar emitir a mesma parcela 2x → 2ª tentativa retorna erro tratado.
3. Emitir 5 parcelas em lote → 5 títulos criados, resumo correto.
4. Emitir parcela com `valor_previsto = 0` → bloqueado com mensagem clara.
5. KPIs de "Emitido" no header do Faturamento atualizam após ação.
6. RLS: usuário de outra empresa não vê/age sobre parcelas alheias.

### 7. Fora do escopo (próximas etapas)

- Geração de boleto/PIX/CNAB.
- Baixa do título (entra na etapa Bancário).
- Lançamento contábil automático (já existe regra; conectaremos depois).
- Régua de cobrança.

---

## Detalhes técnicos

```text
[FaturamentoContratoTab]
        │  (seleciona parcelas)
        ▼
useEmitirTitulosLote ──RPC──► fn_emitir_titulos_lote(uuid[])
                                  │
                                  ├─ valida cada parcela
                                  ├─ INSERT titulo_receber
                                  ├─ UPDATE cronograma_parcela
                                  └─ retorna {ok, fail, detalhes}
        ▼
invalidate(['cronograma', 'titulos_receber'])
```

Arquivos tocados:
- `supabase/migrations/<ts>_emitir_titulo_receber.sql` (novo)
- `src/hooks/useTituloReceber.ts` (novo)
- `src/pages/financeiro/receber/FaturamentoContratoTab.tsx` (edit)
- `src/pages/contratos/Faturamento.tsx` (tooltip enriquecido)
- `src/integrations/supabase/types.ts` (regenerado)

## Previsão de créditos (build mode, usage-based)

- **Otimista:** 6–9 créditos
- **Provável:** 10–15 créditos
- **Pessimista:** 18–25 créditos (com ajustes de UX após sua avaliação)

## Pausa para validação

Após implementar, **paro e aguardo seu OK** com base no checklist de aceite acima antes de seguir para Bancário/Baixa.
