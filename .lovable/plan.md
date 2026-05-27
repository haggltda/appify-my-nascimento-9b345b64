# Bloco 2 — PLAN MODE: Permissões, Rotas, Menus e Triagem IA fora do fluxo

Diagnóstico read-only completo. **Nada executado.**

## 1. Achados-chave

### 1.1 Falha estrutural no `RouteGuard`
`src/components/auth/RouteGuard.tsx` linha 27:
```ts
const allowed = !data || data.isAdmin || !menuCode || data.codes.has(menuCode) || privilegedBypass;
```
**`!menuCode` libera por padrão**. Toda rota não catalogada em `app_menu` passa sem verificação. Comportamento atual = **allow-by-default**, oposto do critério de aceite do bloco.

### 1.2 Mesmo problema no `Sidebar`
`src/components/layout/Sidebar.tsx` linha 373:
```ts
if (!code) return true; // legacy / not catalogued routes remain visible
```
Itens cuja rota não está em `app_menu` aparecem para todos.

### 1.3 Triagem IA
- Rota declarada em `src/App.tsx` linha 135: `<Route path="triagem" element={<TriagemIA />} />`.
- Item da Sidebar em `Sidebar.tsx` linha 88: `{ label: "Triagem & IA", to: "/app/triagem", icon: Sparkles }`.
- **Não existe** registro `triagem` em `app_menu` (consulta confirmou). Logo: hoje aparece na Sidebar para todos e `RouteGuard` libera por `!menuCode`.

### 1.4 Auditoria App.tsx × `app_menu`
**Rotas em App.tsx sem registro em `app_menu` (parciais, a serem confirmadas no execução):**

| Rota | Componente | Categoria proposta |
|---|---|---|
| `/app` (index) | Inicio | técnica — allowlist |
| `/app/meu-perfil` | MeuPerfil | técnica — allowlist (toda pessoa logada) |
| `/app/triagem` | TriagemIA | **deny** (B2 manda tirar do fluxo) |
| `/app/admin/smoke-helena` | SmokeTestHelena | técnica admin — restrita a `admin` |
| `/app/contratos/:id` | ContratoDetalhe | herda `app_menu` de `/app/contratos/ativos` via prefix match (verificar) |
| `/app/financeiro/integracao-bancaria/builder/:contaId` | IntegracaoBancariaBuilder | herda `integracao-bancaria` |
| `/app/integracao/:id` | BatchDetalhe | herda `integracao` |
| `/app/plano-acoes/:id` | PlanoAcaoDetalhe | herda `plano_acoes_lista` |
| `/app/ajuda/:modulo/:slug` | AjudaTopico | herda `ajuda` |
| `/app/fiscal` | Fiscal | verificar — pode estar truncado na consulta |
| `/app/bi` | BIDashboard | verificar |
| `/app/financeiro/validacao-pos-pagamento` | ValidacaoPosPagamento | verificar |

A lista final será produzida em B2-execução por query completa `app_menu` × varredura de `<Route path="...">` em App.tsx.

### 1.5 `PRIVILEGED_ROUTES` hardcoded
`RouteGuard.tsx` linhas 13–14: bypass de `["/app/admin/permissoes"]` para `["admin","controladoria","presidencia"]`. Funciona, mas é regra fora do banco. Não dá para administradores configurarem pela UI. Mantém-se no B2; reavaliar em bloco futuro.

## 2. Plano proposto (a aprovar antes da execução)

### 2.1 RouteGuard: deny-by-default + allowlist técnica explícita

```ts
// Allowlist somente para rotas técnicas sem operação de negócio.
// Toda rota operacional precisa estar em app_menu para liberar.
const TECHNICAL_ALLOWLIST = [
  "/app",                 // exato (index = Inicio)
  "/app/meu-perfil",
  "/app/ajuda",           // listagem; tópicos herdam por prefix
];

// Rotas operacionais SEM menuCode -> negado.
const allowed =
  !data ||                       // ainda carregando contexto
  data.isAdmin ||
  privilegedBypass ||
  (menuCode && data.codes.has(menuCode)) ||
  TECHNICAL_ALLOWLIST.includes(pathname) ||
  TECHNICAL_ALLOWLIST.some(p => pathname.startsWith(p + "/"));
```

Audit log em negação continua igual.

### 2.2 Sidebar: deny-by-default igual ao RouteGuard
Trocar `if (!code) return true` por `if (!code) return false` em `canSee` (linha 373), exceto para itens da allowlist técnica. Itens sem `menuCode` somem para não-admin.

Adicional: **remover o item “Triagem & IA”** do `licitacoesModule` (linha 88). Mantém-se a rota em App.tsx e o componente `TriagemIA.tsx` intocados — só fica inacessível por menu. Quem digitar `/app/triagem` recebe “Acesso negado” pelo novo RouteGuard.

### 2.3 `app_menu`: nenhuma alteração estrutural neste bloco
- **Não criar** registro para `triagem` (o objetivo é mantê-la fora do fluxo).
- **Não criar** registros para `/app/admin/smoke-helena`, `/app` index, `/app/meu-perfil`: ficam tratados via allowlist técnica ou role-check.
- Se a auditoria completa (passo §2.5) revelar rotas operacionais legítimas sem `app_menu` (ex.: `fiscal`, `bi`, `validacao-pos-pagamento`), incluí-las em `app_menu` será proposto em **PLAN separado** com SQL revisado, não neste bloco.

### 2.4 `screen_permission_*` / `has_screen_access` / `list_accessible_menus`
**Intocados.** Confirmado no diagnóstico que o ajuste do RouteGuard + Sidebar é suficiente; não é necessário criar terceiro sistema de permissões nem alterar RPC.

### 2.5 Auditoria completa App.tsx × app_menu (parte da execução)
Antes de tocar em código de produção:
1. Listar 100% das rotas de `src/App.tsx` (parser estático ou regex).
2. Confrontar com `SELECT codigo, rota FROM app_menu WHERE ativo`.
3. Produzir tabela rotaApp → menuCode (ou “sem cadastro”).
4. Para cada “sem cadastro”, decidir: allowlist técnica, role-check específico, ou registro futuro em `app_menu`.
5. Entregar a tabela no PR de execução para revisão humana.

### 2.6 Edge functions e tabelas de Triagem
**Não alterar.** `dump-regras`, qualquer função IA, `triagem_*` tables (se existirem) — preservadas. O bloco só fecha o acesso pelo front.

## 3. Itens fora do Bloco 2

- Botões de Fase 1–7 dentro das telas (escondidos por permissão fina): exige varredura por tela. **Proposta: B2.1 separado** após B2 concluído.
- Alterar `has_screen_access` / `list_accessible_menus` (RPC do banco): proibido.
- Apagar Triagem IA ou edge functions: proibido.
- Substituir `PRIVILEGED_ROUTES` hardcoded por configuração no banco: backlog.
- Migrar `screen_permission_*` para outro modelo: backlog.
- Bloquear `Sidebar` index `/app` (Inicio): mantém-se aberto a todos (allowlist).

## 4. Critérios de aceite (validação pós-execução)

1. URL direta `/app/triagem` por usuário não-admin → tela “Acesso negado” + linha em `access_audit_log` com `motivo = route_guard_block`.
2. Item “Triagem & IA” **ausente** da Sidebar para todos os perfis (inclusive admin — decisão: remover do array; admin acessa via URL se precisar).
3. URL direta `/app/admin/migracao-zero` por usuário sem permissão `migracao-zero` → negado.
4. URL `/app/meu-perfil` continua acessível a qualquer usuário logado.
5. URL `/app/co/empresas` por perfil financeiro sem permissão → negado (já funcionava; confirmar regressão zero).
6. Tabela completa rota×menuCode entregue e revisada antes do merge.

## 5. Rollback

- **Front:** reverter commit; basta restaurar `RouteGuard.tsx` linha 27 (`!menuCode` original) e linha 373 do `Sidebar.tsx` (`return true`) + reinserir item “Triagem & IA”.
- **Banco:** nenhuma migration; nenhum rollback de DB necessário.
- **Snapshot prévio:**
  - `SELECT * FROM app_menu` para JSON.
  - `SELECT * FROM screen_permission_role` para JSON.
  - `SELECT * FROM screen_permission_user` para JSON.
  - Tudo armazenado em `.lovable/B2-snapshot-pre.json` antes de qualquer execução (read-only, parte da execução).

## 6. Riscos

- **R1 — quebra de telas legítimas sem cadastro em `app_menu`:** auditoria §2.5 mitiga antes do switch para deny-by-default. Sem ela, há risco de bloquear telas como `/app/fiscal` ou `/app/bi` para todo mundo.
- **R2 — usuários ativos perdem acesso a `/app/triagem` em produção:** se Triagem estiver em uso real, esconder do menu não é suficiente — uso direto por URL passa a falhar. **Decisão necessária:** confirmar com PO se Triagem pode ficar inacessível agora ou se precisamos deixar bypass para um role específico durante janela de migração.
- **R3 — admin perde atalho visual:** admin sempre passa pelo `data.isAdmin` no RouteGuard, mas se a Sidebar esconder “Triagem & IA” do admin também, ele precisa lembrar a URL. Aceitável segundo o objetivo do bloco.

## 7. Próximos passos (aguardando aprovação humana)

1. Aprovar este plano.
2. Em build mode: rodar §2.5 (auditoria completa) e gravar `.lovable/B2-snapshot-pre.json`.
3. Parar; revisar tabela rota×menuCode com você.
4. Após sua segunda aprovação, aplicar §2.1 + §2.2 (apenas frontend, dois arquivos: `RouteGuard.tsx`, `Sidebar.tsx`).
5. Rodar §4 (critérios de aceite) com Renan Bahr e um admin.
6. Encerrar B2 e abrir PLAN do B2.1 (botões de Fase 1–7 dentro das telas) ou de B1.6 (`fornecedor` insert/delete), conforme sua prioridade.

**Nada executado, nada alterado.**
