# BLOCO_2A_FIX_GRADE_2026_RESOLUCAO_HUMANA_E_CARGA

## 1. Análise das 5 duplicatas (decisão linha-a-linha)

Diagnóstico das duplicatas em `src/data/licitacoesGradeSeed.json` aplicando a regra do usuário: "manter L01/L1; analisar se a duplicada é continuação ou linha completa".

### Conflito #1 — PORTO ALEGRE · PE 9038/2026 — LINHAS COMPLETAS (lotes distintos)
- Linha 88: `Empresa origem: Lote 1`, valor R$ 24.550.044, 279 pessoas, Pos 3.
- Linha 89: `Empresa origem: Lote 2`, sem valor, Pos 4.
- **Decisão**: regra "manter L01/L1" → **manter linha 88 (Lote 1), excluir linha 89 (Lote 2)**.

### Conflito #2 — SÃO CARLOS · PE 9/2026 — CONTINUAÇÃO / linha complementar
- Linha 121: "Vigia", 15 pessoas, 08h, observação "poucos postos", valor R$ 5.445.557,12.
- Linha 125: "Vigilância patrimonial", 09h, observação "Não temos cadastro no licitações-e", **mesmo valor**.
- Mesmo certame descrito 2x com complementos. Linha 121 é mais completa (tem Pos, Nº Pessoas, Resp).
- **Decisão**: **manter linha 121, excluir linha 125** (continuação/complemento). Sem L01/L1 aqui.

### Conflito #3 — CURITIBA · PE 90001/2026 — ATUALIZAÇÃO posterior do mesmo certame
- Linha 133: status SUSPENSO/cancelada, valor R$ 7.724.745,18 (versão antiga).
- Linha 139: status em_andamento, valor R$ 8.538.893,74, Pos 25 (versão atualizada e mais completa).
- **Decisão**: **manter linha 139 (atualização), excluir linha 133**. Sem L01/L1.

### Conflito #4 — ASSIS CHATEAUBRIAND · PE 4/2026 — LINHAS COMPLETAS (lotes distintos)
- Linha 201: `LOTE 01`, Pos 37.
- Linha 202: `LOTE 02`, Pos 34.
- **Decisão**: regra "manter L01" → **manter linha 201 (LOTE 01), excluir linha 202 (LOTE 02)**.

### Conflito #5 — SANTA MARIA · PE 90048/2026 — LINHAS COMPLETAS (lotes distintos)
- Linha 237: `LOTE 01`, Pos 3.
- Linha 238: `LOTE 02`, Pos 2.
- **Decisão**: regra "manter L01" → **manter linha 237 (LOTE 01), excluir linha 238 (LOTE 02)**.

**Resultado**: seed reduzido de 288 → 283 linhas, sem perda semântica de Lote 1/L01 e mantendo a versão mais completa nos conflitos #2 e #3.

> Observação: nos conflitos #1, #4 e #5 os Lotes 2 ficam fora desta carga porque a chave funcional do banco (`empresa_id + orgao + numero + abertura`) hoje não distingue lote. Isso preserva a regra atual sem mudar schema. Se for desejado importar também os Lotes 2 depois, exigirá decisão de produto para estender a chave (DH-DEDUP-FONTE-C), que **não** está no escopo deste bloco.

## 2. Escopo de execução

Apenas dois passos, atômicos, nessa ordem:

1. **Editar somente** `src/data/licitacoesGradeSeed.json`:
   - Remover linhas 89, 125, 133, 202, 238 (decisões acima).
   - Nenhuma outra alteração de conteúdo.
2. **Importar a grade corrigida via pipeline existente** (sem novo código, sem nova RPC):
   - Reaproveitar `useLicitacaoImportacao` (`criarLote → anexarLinhas → confirmarLote`) e o mapper `mapGradeToImportRows`.
   - Executar a partir do botão "Importar Grade 2026" em `src/components/licitacoes/ImportGradeDialog.tsx`, autenticado como admin, contra `empresa_id = 5a61c769-21d8-4e61-b9bb-506b8db0bce8` (HAGG, já existente — confirmado no banco).
   - Nenhum INSERT manual via SQL; nenhuma migration de dados; nenhum bypass de RLS.

## 3. Proibições (mantidas)

- NÃO alterar banco, RPCs, RLS, schema, triggers, types.
- NÃO alterar Pipeline.tsx, Composicao.tsx, useLicitacao.ts, useBdi.ts, CustosBDI.tsx, ImportGradeDialog.tsx, mapper, hook de importação.
- NÃO alterar Suprimentos/Financeiro/Fiscal/Contábil/DRE/Caixa.
- NÃO escolher lote automaticamente diferente do definido acima.
- NÃO criar `_v2.json`; editar o próprio seed (rastreabilidade via git).

## 4. Critérios de aceite

- `jq 'length' src/data/licitacoesGradeSeed.json` retorna **283**.
- `jq '[.[] | {empresa_id,orgao,numero,abertura}] | group_by(.) | map(select(length>1)) | length'` retorna **0**.
- Após a importação manual via UI:
  - lote criado com `status=confirmado`,
  - `inseridas = 283`, `atualizadas = 0`, `erros = 0`,
  - Pipeline lista 283 licitações reais (UUID válido), abertura de Composição funcional para qualquer item (guard UUID já ativo).

## 5. Rollback documentado (não executado)

- Reverter o commit do seed (`git revert`) restaura as 5 linhas.
- Reverter dados importados: marcar o lote como cancelado via `licitacao_importacao_cancelar(p_lote)` se o backend suportar pós-confirmação; caso contrário, apagar as licitações inseridas filtrando pelo `lote_id` no histórico de importação. **Não será executado neste bloco.**

## 6. Matriz de conformidade

| Requisito do usuário | Atendimento |
|---|---|
| Manter L01/L1 | Sim (Conflitos #1, #4, #5) |
| Analisar continuação vs linha completa nas duplicadas | Sim (Conflito #2 = continuação; #3 = atualização; #1/#4/#5 = lotes distintos completos) |
| Excluir uma das duplicadas | Sim (5 linhas removidas) |
| Importar para os locais corretos no banco | Sim, via pipeline oficial (`licitacao_importacao_*`) — sem SQL manual |

## 7. Próximo passo

Aprovar este plano para entrar em build mode e executar **apenas** o passo 1 (editar o seed). O passo 2 (importação) é disparado pelo usuário no botão "Importar Grade 2026" da tela, autenticado como admin, para que a RLS valide a operação.
