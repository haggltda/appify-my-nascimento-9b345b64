# Bloco 2 — Regras globais de conteúdo responsivo

Objetivo: criar utilitários e ajustes globais que tornam tabelas, formulários e containers responsivos sem tocar em telas específicas (isso fica para o Bloco 3).

## Escopo

Apenas utilidades CSS globais e pequenos ajustes em componentes base de UI. Nenhuma tela individual será modificada neste bloco.

## Arquivos que serão alterados

1. **`src/index.css`** — adicionar utilitários globais:
   - `.table-scroll` → wrapper com `overflow-x-auto` + `-mx-4 sm:mx-0` para tabelas extrapolarem em mobile com scroll horizontal limpo.
   - `.grid-form` → grid responsivo padrão (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`) para formulários.
   - `.card-pad` → padding responsivo (`p-4 sm:p-6`) para Cards densos.
   - `.chart-h` → altura adaptativa (`h-[260px] sm:h-[320px] lg:h-[380px]`) para containers de Recharts.
   - Garantir que `img, svg, video, canvas` tenham `max-width: 100%` global.

2. **`src/components/ui/table.tsx`** — envolver `<table>` em wrapper já existente (`<div className="relative w-full overflow-auto">`); confirmar que o wrapper tem `overflow-x-auto` (já tem `overflow-auto`, validar). Sem mudança visual no desktop.

3. **`src/components/ui/dialog.tsx`** — garantir que o `DialogContent` tenha `max-w-[calc(100vw-2rem)]` em mobile e `max-h-[calc(100vh-2rem)] overflow-y-auto` para não cortar conteúdo em telas pequenas. Manter larguras desktop atuais via `sm:max-w-lg` (default shadcn).

4. **`src/components/ui/sheet.tsx`** — verificar larguras. Se `side="right"` está com `w-3/4 sm:max-w-sm`, manter; se está fixa em `w-[400px]`, ajustar para `w-[90vw] sm:w-[400px]`.

## Arquivos que NÃO serão tocados

- `AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx` (Bloco 1, finalizados).
- Qualquer `pages/**` (vai no Bloco 3).
- Recharts em telas (vai no Bloco 3).
- `tailwind.config.ts` (sem novas keys, só usar as existentes).
- Banco, edge functions, auth, rotas.

## Detalhes técnicos

```css
/* index.css — adições */
@layer utilities {
  .table-scroll { @apply -mx-4 sm:mx-0 overflow-x-auto; }
  .grid-form { @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4; }
  .card-pad { @apply p-4 sm:p-6; }
  .chart-h { @apply h-[260px] sm:h-[320px] lg:h-[380px]; }
}

@layer base {
  img, svg, video, canvas { max-width: 100%; height: auto; }
}
```

Os utilitários ficam disponíveis para o Bloco 3 aplicar nas telas críticas, mas não quebram nada se não forem usados.

## Como evitar quebra no desktop

- Todas as utilidades usam prefixos `sm:`/`lg:` para que o comportamento ≥ breakpoint seja idêntico ao atual.
- Mudanças em `dialog.tsx`/`sheet.tsx` só afetam mobile (cap de largura/altura por viewport).
- `table.tsx` já tem wrapper `overflow-auto`; só validamos.

## Como testar

1. Preview desktop 1920/1366 → nenhuma diferença visual.
2. Preview mobile 414/360 → abrir um modal qualquer (ex.: criar usuário) e verificar que não corta lateralmente nem verticalmente.
3. Console limpo, sem warnings de layout.
4. Build sem erros.

## Riscos

- Baixíssimos: utilidades novas não afetam nada até serem usadas. Ajustes em `dialog`/`sheet` são caps de viewport, conservadores.
- Verificar se `dialog.tsx` já tem `max-h` — se tiver, não duplicar.

## Perguntas

1. Confirma os nomes das utilidades (`table-scroll`, `grid-form`, `card-pad`, `chart-h`)? Ou prefere outro padrão de nomenclatura (ex.: `u-table-scroll`)?
2. No Bloco 3, prefere começar pelas telas mais usadas (Lista do Plano de Ações, Capital de Giro, CopilotoIA) ou pelas mais quebradas?

Aguardo aprovação para executar o Bloco 2.