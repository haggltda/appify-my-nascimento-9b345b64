# BLOCO 2A.1-IMPORT-FE REV2 — execução

Plano aprovado tecnicamente em REV2. Estou em plan mode — clique em **Implement plan** para entrar em build mode e aplicar exatamente o que está abaixo.

## Arquivos a criar

1. `src/utils/licitacoes/mapGradeToImportRows.ts` — mapper Grade → contrato RPC; `normalizarValor` BR/US, `normalizarAbertura`, `extrairResponsavelTexto`, `hashRows`, `raw_original` enumerável.
2. `src/hooks/useLicitacaoImportacao.ts` — `useMutation` para as 4 RPCs (`criar_lote`, `anexar_linhas`, `confirmar`, `cancelar`) + `obterLote` (select em `licitacao_importacao_lote`); helper `normalizeError`/`explainError`; flags `isCreating/Uploading/Confirming/Canceling/isBusy`; invalida `["licitacoes"]` e `["pipeline"]` no confirmar.
3. `src/components/licitacoes/ImportGradeDialog.tsx` — wizard `idle → preview → confirmando → sucesso`. Cria lote, anexa, busca resumo, mostra erros (`{linha,erro}` ou `{linha,campo,mensagem}`), pendências previstas vs registradas, bloqueia Confirmar com `linhas_invalidas > 0`, cancela lote em fechamento prematuro / falha em anexar; **mantém modal aberto** se cancelar falhar; exibe aviso de fonte temporária no sucesso.

## Arquivo a alterar

`src/pages/Pipeline.tsx` (3 edits cirúrgicos):

- **linha 6**: remover `import gradeSeed from "@/data/licitacoesGradeSeed.json";` e adicionar `import { ImportGradeDialog } from "@/components/licitacoes/ImportGradeDialog";` + `import { useEmpresaId } from "@/hooks/useEmpresaId";`. Mantém `supabase` (linha 20) e `toast` (linha 21) — ainda usados em `useEffect` de profile e em `handleConfirmAssume`.
- **linhas 89–109**: remover `const [importing, setImporting]` + `handleImportGrade` (destrutivo). Substituir por `const [importOpen, setImportOpen] = useState(false);`, `const { data: empresaAtivaId } = useEmpresaId();`, `const handleRefreshPipeline = () => setOverrides(loadOverrides());`.
- **linhas 138–146**: trocar `onClick={handleImportGrade}` por `onClick={() => setImportOpen(true)}`; remover `disabled={importing}` e texto condicional.
- Antes do `</div>` raiz (após `</AlertDialog>` linha 204): renderizar `<ImportGradeDialog open={importOpen} onOpenChange={setImportOpen} empresaId={empresaAtivaId ?? null} onImported={handleRefreshPipeline} />`.

## Garantias pós-build

- `rg "handleImportGrade|gradeSeed" src/pages/Pipeline.tsx` → 0.
- `rg 'from\("licitacao"\)\.(delete|insert)' src/pages/Pipeline.tsx` → 0.
- TypeScript compila; lint passa.
- Backend, RPCs, `stg_licitacoes`, `public.licitacao`, mocks/seeds, `localStorage`, `Composicao.tsx`, Suprimentos/Financeiro/Fiscal/Contábil/DRE/Caixa **intactos**.
- Nenhum `service_role` no frontend; nenhuma Edge Function criada; nenhuma migration.

## Rollback frontend

Excluir os 3 arquivos novos e reverter o diff de `Pipeline.tsx` via VCS. Não tocar em backend ou dados importados.

## Conteúdo dos arquivos

O conteúdo completo de cada arquivo já foi entregue no documento **BLOCO_2A_1_IMPORT_FE_PLAN_MODE_REV2** anterior nesta thread (seções §5, §6, §7 e §8) e será aplicado byte-a-byte na execução.
