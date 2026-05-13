## Objetivo

Trocar a tela do menu **Início** (`/app`) — hoje exibe o `PainelExecutivo` — por uma tela limpa de boas-vindas com saudação personalizada e o versículo de Provérbios 16:3, exatamente como na imagem de referência.

O **Painel Executivo continua existindo e acessível** em **Licitações → Visão Geral → Painel Executivo** (`/app/` rota interna já mapeada para o componente). Nada de backend, banco, regras, permissões ou funcionalidades será alterado.

## Escopo (somente frontend / apresentação)

1. **Criar nova página** `src/pages/Inicio.tsx`:
   - Layout centralizado vertical/horizontal, ocupando o espaço do `<main>` do `AppShell`.
   - Saudação dinâmica: `"Olá, {primeiroNome}!"` — obtém o nome do usuário logado via `useAuth` (campo `user.user_metadata.full_name` ou `email` como fallback). Se não houver, usa `"Olá!"`.
   - Versículo (texto exato e obrigatório):
     > **Consagre** ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.
     > — Provérbios 16:3
   - Tipografia serif elegante (display font do projeto), palavra "Consagre" em negrito, ícone discreto de livro aberto (lucide `BookOpen` ou similar) inline ao lado da frase.
   - Usar tokens semânticos do design system (`text-foreground`, `text-muted-foreground`, `bg-background`). Sem cores hardcoded.

2. **Atualizar roteamento** em `src/App.tsx`:
   - Linha 113: `<Route index element={<PainelExecutivo />} />` → `<Route index element={<Inicio />} />`.
   - Adicionar nova rota explícita para o Painel Executivo dentro de Licitações, ex.: `<Route path="painel-executivo" element={<PainelExecutivo />} />` (ou reaproveitar caminho já existente, se houver).

3. **Atualizar Sidebar** (`src/components/layout/Sidebar.tsx`):
   - Garantir que o item **"Painel Executivo"** dentro de **Licitações → Visão Geral** aponte para a nova rota `/app/painel-executivo`.
   - O item **"Início"** continua apontando para `/app`.

## O que NÃO será alterado

- Nenhuma página, hook, contexto, edge function, migration, política RLS, tabela ou regra de negócio.
- Componente `PainelExecutivo` permanece intacto — apenas muda a rota que o renderiza.
- Permissões, papéis, Copiloto IA, menus dinâmicos do banco — nada é tocado.

## Avaliação de impacto

| Área | Impacto |
|---|---|
| Backend / DB / RLS | Nenhum |
| Performance | Positivo — `/app` deixa de carregar consultas pesadas do Painel Executivo no primeiro acesso |
| SEO / Rotas externas | Nenhuma rota pública afetada |
| Permissões | Nenhuma — tela de boas-vindas é visível a qualquer usuário autenticado |
| Risco de regressão | Baixo — somente se algum link interno apontar para `/app` esperando ver o Painel. Mitigação: criar rota dedicada `/app/painel-executivo` e ajustar item de menu |

## Arquivos afetados

- **Criar:** `src/pages/Inicio.tsx`
- **Editar:** `src/App.tsx` (1 rota trocada + 1 rota adicionada)
- **Editar:** `src/components/layout/Sidebar.tsx` (atualizar `to` do item Painel Executivo)

Aguardo seu OK para implementar.