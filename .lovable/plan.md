## Meu entendimento

Você quer que **cada Centro de Custo tenha um gestor responsável** (uma pessoa já cadastrada no sistema). Esse gestor:

1. É **definido manualmente, um a um**, com autonomia total para trocar a qualquer momento.
2. Pode ser **importado em massa via planilha** (com layout pronto que o sistema gera).
3. É aplicado em **todas as empresas** — o mesmo gestor pode responder por CCs de várias empresas (HAGG, AGPS, CANAA, LF, NH, SN).
4. Quando um **CC novo é criado** (manual, via contrato, licitação, rateio), ele entra na lista pendente de definição de gestor.
5. Vira **automaticamente a alçada de aprovação das Requisições de Compra** daquele CC (substitui/precede a etapa hoje fixa do diretor).
6. Na tela, o gestor vê **apenas as pendências da empresa selecionada no seletor superior** (filtro por empresa ativa do topbar), mas o cadastro dele independe da empresa.

Confirma se é isso antes de eu mexer em qualquer código?

---

## Caminho proposto (mais seguro e performático)

### 1. Banco — usar o que já existe, sem migration nova

A coluna `centros_custo.gestor_user_id uuid` **já existe** (verifiquei). Hoje está `NULL` em todos os 742 CCs. Não precisa criar tabela nova nem alterar schema — só popular e usar.

Vou apenas:
- Criar um índice `idx_centros_custo_gestor` em `(gestor_user_id, empresa_id)` para performance da inbox.
- Garantir RLS de UPDATE restrito a admin/controladoria (já deve existir; só conferir).
- **Fallback automático no fluxo de aprovação**: na função `sup_aprov_abrir_instancia`, quando o CC da requisição não tiver `gestor_user_id`, cair para `empresas.diretor_user_id` (Helena hoje). Isso evita travar requisições durante a transição.

### 2. Nova aba "Gestores de CC" em Administração → Alçadas

Uma tela única, dedicada, **sem mexer nas telas de Centros de Custo, Empresas, Requisições ou Alçadas atuais**:

```text
┌─────────────────────────────────────────────────────────────┐
│ Gestores de Centro de Custo            [Baixar modelo .xlsx]│
│                                        [Importar planilha]  │
├─────────────────────────────────────────────────────────────┤
│ Filtros: [Empresa ▼] [Status: pendente/definido] [Busca]   │
├─────────────────────────────────────────────────────────────┤
│ Empresa │ Código │ Nome do CC      │ Gestor atual    │ Ação│
│ HAGG    │ 001    │ Obra Praia      │ [João Silva ▼]  │ 💾  │
│ AGPS    │ 050    │ Adm Central     │ ⚠ pendente [▼]  │ 💾  │
└─────────────────────────────────────────────────────────────┘
```

- **Filtro por empresa** usa o seletor de empresa ativa do topbar (`EmpresaAtivaContext`) — exatamente como você pediu.
- **Selo "pendente"** para CCs com `gestor_user_id IS NULL`.
- **Combobox de gestor** com busca (lista de `profiles` ativos, todas as empresas — gestor é global).
- **Edição inline** salva direto em `centros_custo.gestor_user_id` (UPDATE pontual, sem refetch da lista toda).
- **Paginação** server-side (50 por página) — temos 742 CCs.

### 3. Importação por planilha

- Botão **"Baixar modelo .xlsx"** gera arquivo já preenchido com todos os CCs da empresa ativa:
  | empresa_codigo | cc_codigo | cc_nome | gestor_email (preencher) | gestor_atual (somente leitura) |
- Botão **"Importar planilha"** lê XLSX (já temos `xlsx` no projeto via `src/lib/integracao/parser.ts`), valida cada linha, mostra preview com diffs (verde=novo, amarelo=alteração, vermelho=email não encontrado), e só grava após confirmação.
- Grava em batch via `upsert` por `(empresa_id, codigo)` atualizando apenas `gestor_user_id`.

### 4. Integração com aprovação de Requisições (cirúrgico)

Hoje a etapa de aprovação de Requisição é fixa por fluxo. Mudança mínima:
- No `sup_aprov_abrir_instancia` (ou no resolver de responsável da etapa marcada como "gestor_cc"), adicionar resolução dinâmica: `responsavel_user_id := COALESCE(cc.gestor_user_id, empresa.diretor_user_id)`.
- Marcar a 1ª etapa do fluxo de Requisição como `tipo_responsavel = 'gestor_cc'` (novo valor de enum ou flag) — só onde aplicável, sem quebrar os outros fluxos (pagamento, contrato etc).

Vou detalhar essa parte do SQL **só depois** que você aprovar o desenho geral, pra evitar mexer em coisa que não precisa.

### 5. O que NÃO vou mexer

- Telas existentes de Centros de Custo, Empresas, Requisições, Alçadas (cadastro de fluxo).
- Fluxos de aprovação de pagamento, contrato, licitação.
- A migration da Helena que acabou de rodar (fica como fallback).
- Estrutura de `sup_aprov_fluxo` / `sup_aprov_etapa` — só acrescento resolução dinâmica do responsável.

---

## Perguntas antes de implementar

1. **Confirma o entendimento acima?**
2. O gestor de CC pode **aprovar requisições de qualquer empresa** onde ele seja gestor de algum CC, certo? (filtro só visual, no topbar)
3. Quando importar a planilha e o email **não existir** em `profiles`, devo: (a) ignorar a linha e mostrar erro, ou (b) oferecer convite/cadastro do usuário?
4. Quero manter Helena como **fallback automático** quando o CC não tiver gestor, ou prefere **bloquear a requisição** até definir gestor?

Aguardo seu OK pra começar.