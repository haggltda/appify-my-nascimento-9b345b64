# Plano Mestre Enxuto — Governança & Experiência do ERP

## 1. Princípios

- Não quebrar o que já existe. Mudanças incrementais, frontend-first.
- Cada PR pequeno, isolado, revisável e reversível.
- Economia de créditos: 1 PR por vez, sem abrir tudo junto.
- Backend/RLS/Edge só quando estritamente necessário e aprovado.

## 2. Mapa das 12 prioridades (resumo)

| # | Prioridade | Escopo | Risco | Custo estimado (impl.) |
|---|---|---|---|---|
| 0 | Base de Conhecimento / Manual Guiado | Frontend-only, rotas + MDX/JSON | Baixo | 8–15 |
| 1 | Tour guiado por módulo (onboarding) | Frontend (driver.js/shepherd) | Baixo | 4–8 |
| 2 | Tooltips contextuais padronizados | Frontend (componente único) | Baixo | 3–6 |
| 3 | Centro de notificações in-app | DB (tabela) + frontend | Médio | 6–10 |
| 4 | Auditoria visível ao usuário | Leitura de logs existentes + UI | Médio | 5–9 |
| 5 | Padronização de PageHeader/Empty/Loading/Error | Frontend refactor leve | Baixo | 4–7 |
| 6 | Atalhos de teclado + Command Palette (⌘K) | Frontend (cmdk) | Baixo | 4–8 |
| 7 | Preferências do usuário (tema, densidade, idioma) | DB leve + frontend | Médio | 5–8 |
| 8 | Feedback in-app (sugestão/bug) | DB simples + frontend | Baixo | 3–6 |
| 9 | Dashboard "Meu trabalho hoje" | Frontend (queries existentes) | Baixo | 5–9 |
| 10 | Busca global | Frontend + view SQL | Médio | 6–10 |
| 11 | Saúde do sistema (status edge functions, filas) | Leitura + UI | Médio-alto | 6–10 |
| 12 | Tema/identidade visual refinada | Frontend (tokens) | Baixo | 3–6 |

Ordem sugerida: **0 → 5 → 2 → 1 → 9 → 6 → 8 → 7 → 4 → 3 → 10 → 11 → 12**
(Começa pelos itens de maior valor percebido e menor risco; deixa os que tocam backend pesado para o fim.)

## 3. Detalhamento — PR1: Base de Conhecimento / Manual Guiado

### Objetivo
Hub interno onde qualquer usuário acessa manuais, passo-a-passo, FAQs e vídeos por módulo, sem sair do ERP.

### Escopo (frontend-only)
- Nova rota `/ajuda` com índice por módulo (Financeiro, Contábil, RH, Suprimentos, Plano de Ações, Integração FCR, Admin).
- Rota `/ajuda/:modulo/:topico` renderiza um artigo (Markdown).
- Botão de ajuda flutuante no `AppShell` que abre painel lateral com:
  - busca por título/tag
  - "artigos relacionados à página atual" (mapeado por rota)
- Conteúdo armazenado em `src/content/ajuda/*.md` (versionado no repo). Sem banco.
- Renderização Markdown com `react-markdown` + `remark-gfm` (já leve).

### Estrutura proposta
```text
src/
  pages/ajuda/
    Ajuda.tsx              (índice)
    AjudaTopico.tsx        (render do artigo)
  components/ajuda/
    HelpFab.tsx            (botão flutuante)
    HelpPanel.tsx          (painel lateral)
    ArticleCard.tsx
  content/ajuda/
    index.json             (catálogo + mapeamento rota→artigos)
    financeiro/
      programacao-pagamentos.md
      conciliacao.md
    integracao-fcr/
      carregar-lote.md
      reprocessar-lote.md
    ...
```

### Itens fora do escopo do PR1
- Edição inline pelo usuário (vira PR futuro).
- Vídeos hospedados (apenas links externos por enquanto).
- Busca full-text avançada (apenas filtro client-side por título/tag).

### Riscos / mitigação
- Risco: bundle cresce com markdown. Mitigação: `React.lazy` nas rotas de ajuda.
- Risco: conteúdo desatualizado. Mitigação: cada artigo tem `updated_at` no frontmatter visível.

## 4. Camada profissional / governança (transversal, não é PR)

Aplicar em todos os PRs:
- Cada PR mexe em **no máximo 1 módulo principal**.
- Sem migração de banco no PR1.
- Componentes novos usam tokens do `index.css` (sem cores hard-coded).
- Toda nova rota protegida com `ProtectedRoute` quando aplicável.
- Nenhum PR remove rota/feature existente sem aviso explícito.

## 5. Economia de créditos — estratégia de execução

| Etapa | Ação | Custo aprox. |
|---|---|---|
| Agora | Aprovar este plano | 0 |
| PR1 | Implementar Base de Conhecimento (estrutura + 3 artigos seed: FCR carregar lote, FCR reprocessar, Programação de Pagamentos) | 8–15 |
| PR2 | Padronização visual (Prio 5) | 4–7 |
| PR3 | Tooltips padronizados (Prio 2) | 3–6 |
| ... | um por mensagem, sob demanda | 3–10 cada |

Não abrir PR2 enquanto PR1 não estiver validado por você em produção.

## 6. Decisões que preciso de você

1. **Confirmar PR1 = Base de Conhecimento** com escopo acima (frontend-only, 3 artigos seed). Sim / ajustar.
2. **Quais 3 artigos seed** você quer primeiro? (sugestão: FCR carregar lote, FCR reprocessar, Programação de Pagamentos)
3. **Botão de ajuda flutuante**: aprovar agora ou deixar só o menu `/ajuda` no PR1 e o FAB num PR2?

Pare aqui. Aguardo suas respostas para abrir o PR1.
