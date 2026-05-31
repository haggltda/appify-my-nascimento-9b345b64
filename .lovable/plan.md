# BLOCO 2A.1-PIPELINE-DB REV1 — execução aprovada condicionalmente

Plano REV1 aprovado. Clique em **Implement plan** para entrar em build mode e aplicar exatamente o que está abaixo.

## Arquivos a criar

1. `src/utils/licitacoes/mapDbLicitacaoToPipeline.ts` — mapper `public.licitacao → Licitacao` (UI). Mapeia enum DB (`rascunho|oportunidade|em_andamento|vencida|perdida|cancelada`) para enum UI; `criticidade="media"` (CRITICIDADE_NAO_LOCALIZADA_NO_BANCO); `empresa=""` (sigla pendente — D-PIPE-1); `prazo=abertura` (proxy); preserva `id` uuid e `responsavel_user_id`; resolve nome via `ResponsavelMap` com fallback `"—" → display_name → email → "Responsável vinculado"`.
2. `src/hooks/useLicitacoesPipeline.ts` — `useQuery({ queryKey:["licitacoes-pipeline", empresaId], enabled:!!empresaId, staleTime:30s })`. SELECT em `public.licitacao` (17 colunas) filtrado por `empresa_id`, `order("abertura" asc nullsFirst:false).order("updated_at" desc).limit(2000)`. Segunda query opcional em `profiles.select("id,display_name,email").in("id", ids)` para resolver responsáveis. Sem `service_role`. Apenas SELECT.

## Arquivo a alterar

`src/pages/Pipeline.tsx` (3 edits cirúrgicos):

- **linha 9**: adicionar `import { useLicitacoesPipeline } from "@/hooks/useLicitacoesPipeline";` após o import de `useEmpresaId`.
- **linhas 70–93**: remover o `useMemo` que lia direto do `licitacoesBase` e o comentário/handleRefresh temporário. Em seu lugar: manter `handleConfirmAssume`, depois declarar `importOpen`, `empresaAtivaId`, chamar `useLicitacoesPipeline`, calcular `usandoFonteTemporaria` e o novo `data` (real > mock só com banner). `handleRefreshPipeline` passa a chamar `setOverrides(loadOverrides())` **e** `refetchPipeline()`.
- **linhas 158–162**: envolver o `view === "kanban" ? KanbanView : TableView` em uma cadeia de estados: sem empresa → empty "Selecione uma empresa"; loading → empty "Carregando licitações…"; erro → empty tone error com `error.message`; banco vazio sem mock → empty "Nenhuma licitação importada"; senão → banner amarelo de fonte temporária (quando aplicável) + Kanban/Table.
- Acrescentar componente auxiliar `EmptyPipeline({ title, message, tone? })` ao lado de `FilterPill`.

ImportGradeDialog, botão "Importar Grade 2026" (linhas 122–129), `openComposicao` (duplo clique → `/app/composicao?licitacao=<uuid>`), filtros, `AssumirButton`, `KanbanView`, `TableView` — todos preservados byte-a-byte.

## Garantias pós-build

- `rg 'from\("licitacao"\)\.(delete|insert|update|upsert)' src/pages/Pipeline.tsx src/hooks/useLicitacoesPipeline.ts src/utils/licitacoes/mapDbLicitacaoToPipeline.ts` → 0.
- `rg 'from\("licitacao"\)\.select' src/hooks/useLicitacoesPipeline.ts` → 1.
- `rg "service_role" src/pages/Pipeline.tsx src/hooks/useLicitacoesPipeline.ts src/utils/licitacoes/mapDbLicitacaoToPipeline.ts` → 0.
- Composicao.tsx, ImportGradeDialog.tsx, useLicitacaoImportacao.ts, mapGradeToImportRows.ts, useEmpresaId.ts, mocks/seeds, localStorage — intactos.
- Backend, RPCs, `public.licitacao`, `stg_licitacoes`, enums e Edge Functions — intactos.
- TypeScript compila; lint passa.

## Rollback frontend

1. `rm src/hooks/useLicitacoesPipeline.ts`
2. `rm src/utils/licitacoes/mapDbLicitacaoToPipeline.ts`
3. Reverter os 3 edits em `Pipeline.tsx` via VCS.
4. Banco e dados importados não são tocados.

## Conteúdo completo dos arquivos

O conteúdo byte-a-byte de cada arquivo já foi entregue em **BLOCO_2A_1_PIPELINE_DB_PLAN_MODE_REV1** (§9.1, §9.2, §9.3) e será aplicado na execução.
