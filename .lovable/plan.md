## Diagnóstico

**Estado atual (HAGG):**
- Líderes de comitê hoje no banco:
  - Administrativo → Helena Nascimento ❌ (deveria ser Fernanda)
  - Operacional → Senilton Nascimento ✅
  - Controladoria → Yuri Rosa ✅
  - Reunião Extraordinária → Helena Nascimento ❌ (deveria ser Érica Souza Ávila)
  - "Gestor" → o comitê foi descartado na importação (era guarda-chuva)
- Profiles existentes: Yuri, Senilton, Helena, Érica Souza Ávila. **Fernanda não tem profile** — vai como nome livre via campo `descricao` do comitê.
- Tela `Detalhe` (rota `/app/plano-acoes/nova` e `:id`) já tem Comitê e Área em lista suspensa (via `useComitesMap`), mas:
  - **Não traz o gestor da área** ao selecionar a Área (campo Responsável fica em branco)
  - **Não tem campo Setor**
- Tela `CopilotoIA` (painel de rascunho) tem Comitê e Área como **Input de texto livre**, sem Setor e sem auto-preenchimento.
- Tabela `plano_acao` **não possui coluna `setor`** — só `comite` e `area` (texto). Precisa nova coluna `setor` (text).

## O que será feito

### 1. Banco (migração)
- `ALTER TABLE plano_acao ADD COLUMN setor text` (idempotente).
- Corrigir os líderes dos comitês HAGG:
  - **Operacional** → vincular ao profile do **Senilton** (já está; mantém).
  - **Controladoria** → **Yuri Rosa** (já está; mantém).
  - **Administrativo** → desvincula profile e grava `descricao = 'Líder: Fernanda'` (Fernanda não tem profile).
  - **Reunião Extraordinária** → vincula ao profile da **Érica Souza Ávila**.
- (O comitê "Gestor – Helena Nascimento" não existe na empresa porque foi descartado na importação; não será recriado salvo se você pedir.)

### 2. Hook `useComitesMap`
- Estender o retorno: cada comitê passa a expor `areas: Array<{ nome, gestor: string|null, setores: string[] }>` além de `lider` (já carrega `comite.descricao` como fallback quando não há profile).
- Manter compatibilidade com chamadores atuais (campo `areas: string[]` continua disponível como derivação).

### 3. Tela Detalhe (`/app/plano-acoes/nova` e `:id`)
- Ao selecionar **Área** → preencher automaticamente `Responsável` com o gestor cadastrado da área (sobrescreve apenas se estiver vazio ou se a área mudou).
- Adicionar campo **Setor** (Select) abaixo de Área, populado com setores cadastrados daquela área. Seleção manual; salva em `plano_acao.setor`.
- Líder do Comitê continua automático (já existe).

### 4. Tela Copiloto IA (painel de rascunho à direita)
- Trocar Inputs de **Comitê** e **Área** por **Selects** alimentados pelo `useComitesMap` (mesmas regras: área depende do comitê).
- Adicionar **Setor** (Select dependente da Área).
- Auto-preencher **Responsável** com o gestor da área ao selecionar a Área.
- Estender `Draft` (em `useCopilotoChat`) e a edge `copiloto-acoes-criar` para aceitar e persistir `setor`.

### 5. Tipos
- Adicionar `setor: string | null` em `PlanoAcaoRow` (`src/hooks/usePlanoAcoes.ts`) e em `Draft` do copiloto.

## Impacto

- **Banco:** 1 coluna nova (`plano_acao.setor`, nullable, sem default) + 3 updates de líderes em `comite`. Sem perda de dados; código antigo continua funcionando (coluna nullable).
- **Frontend:** mudanças isoladas em `Detalhe.tsx`, `CopilotoIA.tsx`, `useComitesMap.ts`, `useCopilotoChat.ts`, `usePlanoAcoes.ts`.
- **Edge function:** `copiloto-acoes-criar` passa a aceitar `setor` no draft (campo opcional; chamadas antigas seguem válidas).
- **Lista/Kanban/Dashboard:** sem mudança nesta entrega (não foi pedido). A coluna `setor` aparece no detalhe e fica disponível para futuros filtros.
- **Risco:** baixo. Se alguma área não tiver setores cadastrados, o Select de Setor exibe "Sem setores cadastrados" e o usuário pode salvar em branco.

Aguardando seu **OK** para executar a migração e aplicar as mudanças.
