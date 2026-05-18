
# Plano de Melhoria — Tela Aguardando Minha Aprovação

## 1. Arquivo/tela localizada

- **Rota**: `/app/aprovacoes/inbox` (link no Sidebar "Aguardando Aprovação")
- **Arquivo React**: `src/pages/aprovacoes/Inbox.tsx`
- **Componentes**: `PageHeader`, `Card`, `Tabs`, `Table`, `Dialog`, `Textarea`, `Button`, `Badge` (shadcn)
- **Hooks/services**: `useQuery` + `supabase` client (sem service layer dedicado); `useMutation` chama RPC `programacao_decidir`
- **Origem dos dados**: query única `financeiro_pagamento_aprovacao` filtrada por `aprovador_id = auth.uid()` e `decisao='pendente'`, com join leve em `malote_pagamento` (descricao, qtd_titulos). Compras/OBZ/Plano estão como `TODO`.

## 2. Dados disponíveis hoje

| Campo desejado | Disponível? | Origem | Observação |
|---|---|---|---|
| Origem (módulo) | Sim | derivado no front | só "financeiro" hoje |
| Tipo | Parcial | derivado (etapa) | "Programação etapa N" |
| Item/Título | Sim | `malote_pagamento.descricao` | |
| Valor | Sim | `financeiro_pagamento_aprovacao.valor_aprovado` | |
| Data pgto aprovada | Sim | `data_pagamento_aprovada` | |
| Empresa_id | Sim | tabela | precisa join para nome |
| Qtd títulos | Sim | `malote_pagamento.qtd_titulos` | |
| Etapa atual | Sim | `etapa` | |
| Justificativa origem | Sim | `malote_pagamento.justificativa` | não selecionado hoje |
| Prioridade/urgência/exceção | Sim | `malote_pagamento.prioridade/urgencia/excecao` | não selecionado |
| Período (inicio/fim) | Sim | `malote_pagamento.periodo_inicio/fim` | não selecionado |
| Criado por (solicitante) | Sim | `malote_pagamento.criado_por` / `enviado_aprovacao_por` | precisa join `profiles` |
| Enviado em | Sim | `enviado_aprovacao_em` | |
| Conta bancária pagadora | Sim | `malote_pagamento.conta_bancaria_id` | join |
| Títulos do malote (NF, fornecedor, vencimento, CC, contrato) | Sim | `titulo_pagar` via `malote_titulo` (relação a confirmar) | requer 2ª query |
| Próxima etapa / cascata | Parcial | `alcada_aprovacao` ordenada por `ordem` | precisa 1 query extra |
| Histórico (timeline) | Parcial | `financeiro_pagamento_aprovacao` (todas linhas da programação, com `decidido_em`,`decisao`,`aprovador_id`) | requer 1 query extra |
| Anexos | **Não** | sem tabela de anexos por programação no payload atual | mostrar vazio |

## 3. Dados faltantes

| Campo | Impacto | Como obter | Precisa backend? | PR futuro? |
|---|---|---|---|---|
| Anexos (NF PDF, XML, boleto, contrato) | Médio | Não há tabela `documento_anexo` ligada a programação/título. Existem só PDFs gerados sob demanda | Sim (nova tabela ou bucket + tabela `pagamento_anexo`) | Sim |
| CNPJ do fornecedor por título | Baixo | `titulo_pagar -> fornecedor.cnpj` | Não (já existe), só ampliar query | Não |
| Centro de custo nome | Baixo | `centro_custo.nome` join | Não | Não |
| Contrato número | Baixo | `contrato.numero` join | Não | Não |
| Compras / OBZ / Plano no inbox | Médio | tabelas `sup_aprov_instancia`, `obz_versao`, `plano_acao` | Frontend pode somar; depende de RLS já existente | PR separado |
| Próxima etapa textual | Baixo | `alcada_aprovacao.etapa` ordem+1 | Não, query simples | Não |

## 4. Proposta visual (referência: screenshot enviado)

**Cards superiores (5 cards executivos):**
- Pendentes Comigo (contagem + delta "X novos hoje")
- Valor Total Pendente
- Financeiro (qtd + valor)
- Compras (qtd + valor — vazio agora)
- Contratos/Outros (qtd + valor — vazio agora)
- Ícones em pill com bg suave (`bg-{cor}-soft`), tipografia grande, hierarquia clara

**Toolbar:**
- Tabs (`Todos | Financeiro | Compras | Contratos/Outros`) com contadores
- Busca textual (filtra fornecedor/título/nº doc no client)
- Botões `Filtros` (popover: vencidos/a vencer, faixa de valor) e `Exportar` (CSV client-side)

**Tabela principal (densa, com mais colunas):**
- Origem (chip colorido) | Tipo | Item/Título | Fornecedor (+CNPJ pequeno) | Nº Doc/NF | Valor | Emissão | Vencimento (+ "X dias" em destaque amarelo/vermelho) | Competência | Lançamento
- Linha inteira clicável → abre drawer
- Hover destaca linha; linha selecionada com `bg-accent/30` e borda esquerda
- Coluna Ações compacta com ícones (kebab) — mantém Aprovar / Devolver / Rejeitar atuais

**Drawer lateral direito (Sheet, 480-560px):**
- Header: chips de origem + status ("Pendente de aprovação"); título grande; subtítulo (PP-xxxx · NF yyyy)
- Grid 2 colunas com Fornecedor, Valor, Emissão, Vencimento (+dias), Competência, Empresa, Centro de custo, Contrato
- Bloco "Responsável pelo lançamento" (nome + módulo origem)
- Seção **Linha do tempo**: lançado → enviado → etapa atual (highlight) → próxima etapa (cinza). Pontos verdes/azuis/cinza.
- Seção **Documentos anexados**: lista com ícone PDF, nome, tamanho, botões Visualizar/Download. Se vazio: estado "Nenhum anexo localizado".
- Footer fixo: `Ver detalhes` (navega à origem) | `Devolver` | `Rejeitar` | `Aprovar` (verde, destaque)

**Layout:**
- Espaçamento generoso, cards com `rounded-xl`, shadows sutis, identidade do ERP preservada
- Responsivo: drawer vira full-screen sheet em <md; cards colapsam para 2 cols

## 5. Escopo frontend-only possível agora

1. Refazer KPIs (5 cards com ícone, valor, label, mini-delta)
2. Adicionar tabs Compras / Contratos-Outros (zerados, prontos para receber dados)
3. Ampliar query atual com joins: `malote_pagamento(descricao, qtd_titulos, justificativa, prioridade, urgencia, excecao, enviado_aprovacao_em, conta_bancaria:conta_bancaria_id(banco_nome, agencia, conta), empresa:empresa_id(nome_fantasia, cnpj), solicitante:enviado_aprovacao_por(nome))`
4. 2ª query on-demand (ao abrir drawer): títulos do malote com fornecedor/CC/contrato; e histórico (`financeiro_pagamento_aprovacao` da mesma `programacao_id` ordenado por etapa)
5. 3ª query on-demand: `alcada_aprovacao` da empresa por `ordem` para "próxima etapa"
6. Adicionar busca/filtro client-side
7. Drawer (`Sheet`) com timeline, grid de dados, seção anexos vazia
8. Manter `Dialog` de confirmação e RPC `programacao_decidir` inalterados

## 6. Escopo que deve ficar para PR futuro

- Tabela/bucket de **anexos** ligada a programação/título (backend novo)
- Inclusão real de **Compras** (`sup_aprov_instancia`), **OBZ** (`obz_versao`), **Plano** (`plano_acao`) — cada uma com RPC de decisão própria
- Notificações em tempo real (Realtime) do inbox
- Export CSV oficial via Edge Function (se quiser server-side)

## 7. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Quebrar fluxo de aprovação atual | Alta | Não tocar em `programacao_decidir` nem no Dialog de confirmação |
| Queries adicionais lentas | Média | Lazy-load detalhes só ao abrir drawer; `staleTime: 30s` |
| RLS bloquear novos joins (profiles/conta_bancaria) | Média | Testar com Helena (admin) e usuário não-admin antes de finalizar |
| Layout quebrar em telas pequenas | Baixa | Drawer responsivo + grid colapsável |
| Mostrar dado errado de "anexos" | Baixa | Não inventar; mostrar estado vazio |

## 8. Plano de implementação

1. Refatorar KPIs para 5 cards executivos (estilo screenshot)
2. Ampliar query principal com joins seguros (empresa, conta, solicitante)
3. Ampliar tabela com novas colunas (fornecedor agregado, vencimento+dias, competência, lançamento)
4. Criar componente `InboxDetailDrawer` (Sheet) com header, grid de dados, timeline, seção anexos
5. Adicionar queries lazy (títulos do malote, histórico, alçada/próxima etapa)
6. Adicionar busca textual + tabs com contadores reais
7. Garantir que Aprovar/Devolver/Rejeitar continuam chamando `programacao_decidir` exatamente como hoje
8. Testes manuais (Helena admin) e ajustes de responsividade

## 9. Testes obrigatórios

- Abrir `/app/aprovacoes/inbox` → cards renderizam, sem erro
- Lista carrega pendentes do usuário
- Clicar em linha → drawer abre com dados corretos
- Drawer mostra "Nenhum anexo" sem quebrar
- Timeline mostra etapa atual em destaque
- Aprovar → RPC chamada, item some, toast verde
- Devolver/Rejeitar → exige justificativa (≥5 chars)
- Busca filtra título/fornecedor
- Tabs Compras/Contratos exibem estado vazio amigável
- Tela <768px: drawer ocupa tela inteira, tabela rola horizontal
- Typecheck passa (`tsc --noEmit` via build automático)

## 10. Confirmações

- Será **frontend-only**: sim
- Não altera banco: sim
- Não altera RLS/policies: sim
- Não altera Edge Functions: sim
- Não altera RPC `programacao_decidir` nem regras de aprovação: sim
- Não cria mock data: sim (estados vazios reais)
- Reaproveita componentes shadcn já existentes (`Sheet`, `Card`, `Table`, `Dialog`): sim

---

**Aguardando aprovação para implementar.** Posso começar pelo passo 1 (KPIs + query ampliada) e seguir incrementalmente, ou prefere que eu entregue tudo de uma vez?
