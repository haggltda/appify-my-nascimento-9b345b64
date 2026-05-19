## Onda 4 — Matriz granular Pessoa/Perfil × Tela × Ação

### Objetivo
Permitir configurar permissões em 3 níveis com precedência: **Override por pessoa** > **Perfil (role)** > **Default do menu**. Ações controladas: `view`, `create`, `update`, `delete`, `approve`, `export`.

### Banco (migration)

**Enum existente reutilizado:** `app_action` (já usado em `role_permissions.acao`).

**Tabela `screen_permission_profile`** (perfil × tela × ação)
- `role app_role`, `menu_codigo text` (FK lógica → `app_menu.codigo`), `acao app_action`, `allow boolean default true`
- UNIQUE (role, menu_codigo, acao)
- Substitui/complementa `role_permissions` (mantemos a antiga; nova é mais específica por tela).

**Tabela `screen_permission_user`** (override por pessoa)
- `user_id uuid`, `menu_codigo text`, `acao app_action`, `allow boolean`, `empresa_id uuid null` (opcional: escopo por empresa), `created_by uuid`, `motivo text`
- UNIQUE (user_id, menu_codigo, acao, empresa_id)

**Função `has_screen_access(_user uuid, _menu text, _acao app_action, _empresa uuid default null) returns boolean`**
- SECURITY DEFINER, search_path=public
- Lógica: 1) admin → true; 2) override user (mais específico com empresa, senão sem empresa) → retorna `allow`; 3) qualquer role do user em `screen_permission_profile` com allow=true → true; 4) fallback `role_permissions` legado; 5) false.

**RLS:** ambas tabelas — SELECT para authenticated; INSERT/UPDATE/DELETE apenas admin/diretor_adm via `has_role`.

**Seed inicial:** popular `screen_permission_profile` com `view` para todos os menus existentes baseado em `role_permissions` atual (não destrutivo).

### Frontend

**Nova tela `/app/admin/permissoes`** (`AcessosPermissoes.tsx`)
- 2 abas:
  - **Por Perfil**: tabela `role × menu × acao` com toggle. Filtros por role e módulo.
  - **Por Pessoa**: seleciona usuário → matriz menu × acao com override. Mostra "herdado do perfil" vs "override".
- Reutiliza `app_menu` para listar telas agrupadas por módulo.

**Hook `useScreenAccess(menuCodigo, acao)`**
- Chama RPC `has_screen_access`, cache via react-query 5min.
- `<ScreenGate menu="..." acao="view">` wrapper.

**Sidebar/Rotas:** ainda NÃO bloqueia (Onda 6). Apenas a tela de admin é adicionada ao menu (visível para admin/diretor_adm).

### Matriz de impacto
- DDL aditivo, 0 risco em dados existentes.
- Runtime atual não muda (gates só na Onda 6).
- Tela nova oculta para roles sem permissão.

### Entregáveis
1. Migration (DDL + função + seed)
2. `src/pages/admin/AcessosPermissoes.tsx`
3. `src/hooks/useScreenAccess.ts` + `src/components/auth/ScreenGate.tsx`
4. Item no Sidebar (Administração → Acessos & Permissões)
5. Rota em `App.tsx`

Aprova para implementar?