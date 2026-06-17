# A-2 L6 — PRÉ-FLIGHT READ-ONLY DE IDENTIDADE, ACESSOS, ROLES, PERMISSÕES E EMPRESAS

Modo: **READ-ONLY**. Nenhuma alteração foi executada (sem migration, sem SQL DML/DDL, sem GRANT/REVOKE, sem mudança em banco, RLS, storage, frontend, edge functions, types, usuários, roles, permissões, empresas ou commit).

Classificação final: **REPROVADO_RISCO_CRÍTICO** — há **P0 confirmado de auto-promoção** via `profiles.profiles_self_update` (sem `WITH CHECK`) combinada com `user_pode_atuar_empresa` que lê `profiles.acessa_todas_empresas`. Detalhes abaixo.

---

## PARTE 1 — Inventário de tabelas (todas existem, todas com RLS ON)

| Tabela | Existe | RLS | #Policies | Colunas sensíveis principais | PK |
|---|---|---|---|---|---|
| `profiles` | sim | ON | 3 | `id (uuid)`, `email`, `empresa_id`, `empresa_atual_id`, `acessa_todas_empresas (bool)`, `must_change_password`, `ativo` | `id` |
| `user_roles` | sim | ON | 4 | `id`, `user_id`, `role (app_role)` | `id` |
| `role_permissions` | sim | ON | 4 | `id`, `role`, `modulo`, `menu_codigo`, `acao (app_acao)` | `id` |
| `sessoes_ativas` | sim | ON | 3 | `user_id`, sessão | (n/v) |
| `notificacoes` | sim | ON | 3 | `id`, `user_id`, `empresa_id`, `lida` | `id` |
| `empresas` | sim | ON | 4 | `id`, `codigo`, `cnpj`, `ativa`, `diretor_user_id` | `id` |
| `user_empresa` | sim | ON | 2 | `user_id`, `empresa_id` | (n/v) |
| `screen_permission_user` | sim | ON | 2 | `user_id`, `menu_codigo`, `acao`, `empresa_id`, `allow` | `id` |
| `screen_permission_profile` | sim | ON | 2 | `role`, `menu_codigo`, `acao`, `allow` | `id` |
| `app_menu` | sim | ON | 4 | `codigo`, `modulo_id`, `rota`, `ativo` | `id` |
| `app_modulo` | sim | ON | 4 | `codigo`, `ativo` | `id` |

Triggers presentes (auditoria/updated_at): `trg_audit_profiles`, `trg_audit_user_roles`, `trg_audit_role_permissions`, `trg_audit_empresas`, `trg_profiles_valida_empresa_atual` (valida só `empresa_atual_id`), `trg_spp_updated`, `trg_spu_updated`. **Nenhum trigger de imutabilidade** sobre `user_roles.role/user_id`, `profiles.acessa_todas_empresas/empresa_id/id`, `notificacoes.user_id`, `sessoes_ativas.user_id`, `empresas.id/codigo/cnpj`.

---

## PARTE 2 — Policies UPDATE sem `WITH CHECK` (mapeamento de risco)

Todas as policies UPDATE abaixo têm `WITH CHECK = NULL`. Sem `WITH CHECK`, o Postgres **valida apenas a linha pré-UPDATE** (`USING`) e permite que a linha pós-UPDATE viole o predicado — esse é o vetor clássico de escalonamento.

### 2.1 `public.profiles.profiles_self_update` — **P0 CRÍTICO**
- `cmd=UPDATE` · roles=`{authenticated}`
- `USING = (id = auth.uid()) OR has_role(auth.uid(), 'admin')`
- `WITH CHECK = NULL`
- Risco direto (sem `WITH CHECK` simétrico e sem trigger de imutabilidade):
  - Usuário comum autenticado pode `UPDATE profiles SET acessa_todas_empresas=true WHERE id=auth.uid()` → **auto-promoção a acesso global** porque `user_pode_atuar_empresa` (ver Parte 3) usa exatamente essa flag para liberar **todas as empresas ativas**.
  - Pode também trocar `empresa_id`, `email`, `display_name`, `must_change_password`, `ativo` do próprio profile.
  - Pode tentar trocar `id` para o `id` de outro usuário; o `WITH CHECK` ausente não barra mudança de PK (mesmo que a FK/PK barre, o vetor é não barrado por RLS).
  - `trg_profiles_valida_empresa_atual` cobre **apenas** `empresa_atual_id`; não cobre `acessa_todas_empresas`.
- Proposta (NÃO EXECUTÁVEL): `WITH CHECK` simétrico + **trigger BEFORE UPDATE** imutabilizando `id`, `acessa_todas_empresas`, `empresa_id`, `email`, `ativo`, `must_change_password` quando `auth.uid() = OLD.id` AND NOT admin. Helper `is_admin()` SECURITY DEFINER já existe via `has_role`.

### 2.2 `public.user_roles.user_roles_admin_upd` — **P1**
- `USING = has_role(auth.uid(),'admin')` · `WITH CHECK = NULL`
- Como o USING já exige admin, **usuário comum não dispara o UPDATE**. Risco residual: admin pode mover `role` para outra linha sem validação pós-update; um admin malicioso/erro pode reescrever para `role` que não respeita o enum esperado por outras regras. P1 (escopo restrito a admin) — mitigar com `WITH CHECK = has_role(auth.uid(),'admin')` simétrico.

### 2.3 `public.role_permissions.rp_admin_upd` — **P2**
- `USING = has_role(auth.uid(),'admin')` · `WITH CHECK = NULL`. Mesmo padrão: só admin. P2. Mitigar com `WITH CHECK` simétrico.

### 2.4 `public.sessoes_ativas."atualizar minhas sessoes"` — **P1**
- `USING = (user_id = auth.uid()) OR has_role(auth.uid(),'admin')` · `WITH CHECK = NULL`
- Risco: usuário comum pode fazer `UPDATE sessoes_ativas SET user_id = '<outro_user>' WHERE user_id = auth.uid()` — **transferir/sequestrar identidade da sessão** para outro user_id. Impacto depende do consumo dessa tabela (revogação, listagem). P1.
- Proposta: `WITH CHECK = (user_id = auth.uid()) OR has_role(auth.uid(),'admin')`.

### 2.5 `public.notificacoes."marcar minhas notificacoes"` — **P1**
- `USING = (user_id = auth.uid()) OR has_role(auth.uid(),'admin')` · `WITH CHECK = NULL` · role=`public` (anônimo bloqueia por `auth.uid()=NULL`, mas vetor existe para qualquer authenticated).
- Risco: usuário comum pode setar `user_id = outro` na própria notificação → **transferir notificação alheia**, ou alterar `empresa_id`/`titulo`/`mensagem`. P1.
- Proposta: `WITH CHECK` simétrico + considerar trigger imutável em `user_id`, `empresa_id`, `titulo`, `mensagem`, `tipo`, `link` (usuário só deveria flipar `lida`).

### 2.6 `public.empresas.empresas_admin_upd` — **P2**
- `USING = has_role(auth.uid(),'admin')` · `WITH CHECK = NULL`. Só admin. Mitigar simetricamente.

### 2.7 `public.app_menu.app_menu_admin_upd` e `public.app_modulo.app_modulo_admin_upd` — **OK**
- `USING` e `WITH CHECK` ambos = `has_role(auth.uid(),'admin')`. Simétricas. **Sem ressalva.**

### 2.8 `public.screen_permission_user.spu_write` (ALL) e `public.screen_permission_profile.spp_write` (ALL) — **OK**
- `USING` e `WITH CHECK` ambos = `admin OR diretor_adm`. Simétricas.

### 2.9 `public.user_empresa.user_empresa_admin_all` (ALL) — **OK**
- `USING` e `WITH CHECK` = `admin`. Simétricas. Usuário comum não pode atribuir-se a empresa.

---

## PARTE 3 — Funções de permissão

| Função | Args | Retorna | SECDEF | search_path | Resumo / risco |
|---|---|---|---|---|---|
| `has_role(_user_id uuid, _role app_role)` | (uuid, app_role) | bool | sim | `public` | Lê `user_roles`. **Sem risco** isolado. |
| `has_permissao(_user, _modulo, _acao, _menu)` | (uuid,text,text,text) | bool | sim | `public` | Lê `user_roles`+`role_permissions`. Sem risco isolado. |
| `can_access(_user,_menu,_acao,_empresa,_modulo)` | (uuid,text,app_acao,uuid,text) | bool | sim | `public,pg_temp` | Bypass admin; aplica `screen_permission_user` (override por empresa→global), depois `role_permissions` (suporta `modulo='*'`), depois `screen_permission_profile`. **Não consulta** `user_empresa`/`user_pode_atuar_empresa` — autorização por menu/ação **não verifica empresa** (apenas filtra override por empresa quando fornecida). Risco: tela "permitida" não restringe empresa por si só; restrição multiempresa depende das policies das tabelas-fim. |
| `has_screen_access(_user,_menu,_acao,_empresa)` | (uuid,text,app_acao,uuid) | bool | sim | `public` | Bypass admin; override `spu` (empresa→global); profile `spp`. Mesmo gap multiempresa que `can_access`. |
| `user_pode_atuar_empresa(_user, _empresa)` | (uuid,uuid) | bool | sim | `public` | True se admin OU `profiles.acessa_todas_empresas=true` (com empresa ativa) OU `user_empresa` OU `profiles.empresa_id=_empresa`. **Acoplamento crítico** com `profiles_self_update`: a flag `acessa_todas_empresas` é editável pelo próprio usuário. |
| `user_can_see_empresa(_empresa_id)` | (uuid) | bool | sim | `public` | Usado por `empresas_select_scoped`. Admin OU `user_empresa` OU `profiles.empresa_id`. **Não considera** `acessa_todas_empresas` — divergência intencional/incidental vs `user_pode_atuar_empresa`. |

Todas as funções têm `search_path` fixo. Nenhuma chamada de RPC é DML.

---

## PARTE 4 — Risco de auto-promoção (consolidado)

| # | Vetor | Classificação |
|---|---|---|
| 1 | Alterar próprio `role` em `user_roles` (UPDATE) | **Negado** — `user_roles_admin_upd` exige admin no `USING`. |
| 2 | Alterar `profiles` para parecer admin (`acessa_todas_empresas=true`, `empresa_id`, etc.) | **P0 CRÍTICO** — `profiles_self_update` sem `WITH CHECK`. |
| 3 | INSERT/UPDATE em `user_roles` por não-admin | **Negado** (INSERT exige admin no `WITH CHECK`; UPDATE/DELETE exigem admin no `USING`). |
| 4 | Alterar `role_permissions` | **Negado** (só admin). |
| 5 | Alterar empresa vinculada (`user_empresa`) | **Negado** (só admin). |
| 6 | Alterar sessão de outro usuário | **P1** — `sessoes_ativas` UPDATE sem `WITH CHECK` permite reassinar `user_id` a partir da própria sessão. |
| 7 | Alterar notificação de outro usuário | **P1** — `notificacoes` UPDATE sem `WITH CHECK` permite mover `user_id`. |
| 8 | Alterar cadastro global de empresas | **Negado** (só admin). |
| 9 | Acesso por URL direta sem permissão | Depende de policy de tabela-fim; ver Parte 6 (`RouteGuard` é deny-by-default, mas RLS é a defesa real). |
| 10 | Burlar empresa ativa | **P0 derivado** do item 2: ao ligar `acessa_todas_empresas`, `user_pode_atuar_empresa` libera qualquer empresa ativa em policies dependentes (K/O-1A, K/O-1B e demais que usam essa função). |

---

## PARTE 5 — Usuários com acesso global

1. Representação existe: `profiles.acessa_todas_empresas boolean NOT NULL`.
2. Reside em `profiles`. Não há campo equivalente em `user_empresa`/`empresas`/`user_roles`.
3. `user_pode_atuar_empresa` **contempla** acesso global (flag + empresa ativa).
4. Admin é sempre tratado como acesso global em `has_role`/`can_access`/`has_screen_access`/`user_pode_atuar_empresa`/`user_can_see_empresa`.
5. Usuário não-admin com múltiplas empresas é contemplado via `user_empresa` (M:N).
6. Risco de usuário global ser bloqueado: **`user_can_see_empresa` NÃO checa `acessa_todas_empresas`** → SELECT em `empresas` pode esconder linhas para um "usuário global" não-admin. **Divergência funcional confirmada por leitura de schema.**
7. Risco de usuário comum acessar empresa indevida via RLS de tabelas-fim: depende de cada tabela; este bloco só inventaria identidade. BLOQUEADO_POR_FALTA_DE_EVIDÊNCIA para o agregado funcional sem teste de runtime.

---

## PARTE 6 — Frontend (somente leitura, sem alteração)

| Arquivo | Supabase | RPC perm. | Empresa ativa | Protege rota | Só oculta? | Cache c/ empresa_id | Risco URL direta |
|---|---|---|---|---|---|---|---|
| `src/App.tsx` | indireto | não | indireto | rotas envoltas em `ProtectedRoute`/`RouteGuard` | n/a | n/a | baixo (RLS é defesa final) |
| `src/components/ProtectedRoute.tsx` | sim (`useAuth`) | não | não | exige sessão; força troca de senha | n/a | n/a | n/a |
| `src/components/auth/RouteGuard.tsx` | sim (audit insert) | usa `useAccessibleMenus` (codes/isAdmin) + flag soberana | não checa empresa | sim, deny-by-default + allowlist técnica | bloqueia render, mas RLS é a barreira real | n/a | médio: bypass por allowlist se rota técnica for sensível |
| `src/components/auth/ScreenGate.tsx` | sim | `useScreenAccess` → `has_screen_access` | sim (passa `empresaId`) | apenas oculta children | **sim, só oculta** | n/a | alto se ação não tiver RLS dedicada |
| `src/components/RoleGate.tsx` | não | usa `PermissoesContext.can` | indireto | só oculta | **sim, só oculta** | n/a | igual acima |
| `src/hooks/useScreenAccess.ts` | sim | `has_screen_access` (RPC) | sim | n/a | n/a | queryKey inclui `empresaId` | baixo |
| `src/hooks/useAccessibleMenus.ts` | sim | `useAccessibleMenus` (a verificar implementação) | parcial | usado pelo RouteGuard | n/a | n/a | médio |
| `src/context/PermissoesContext.tsx` | sim | agrega `can()` | indireto | n/a | só fornece flags p/ UI | n/a | médio |
| `src/context/EmpresaAtivaContext.tsx` | sim | n/a | **define** empresa ativa | n/a | n/a | n/a | depende de `profiles.empresa_atual_id` (trigger valida) |
| `src/components/layout/Sidebar.tsx` | indireto | usa menus acessíveis | indireto | só oculta itens | **sim, só oculta** | n/a | menu oculto ≠ rota bloqueada |
| `src/pages/Administracao.tsx`, `admin/tabs/Permissoes(Unificadas)?Tab.tsx`, `PerfisTab.tsx`, `IdentidadeTab.tsx`, `components/admin/UsuariosReal.tsx` | sim | sim (`has_role`, `can_access`) | parcial | rotas protegidas por `PRIVILEGED_ROUTES` em RouteGuard | mistura ocultar + RPC admin | n/a | baixo p/ admin; **edição de profile/role depende 100% das RLS** — o gap P0 do item 2.1 anula essa proteção |

Risco transversal: **diversos gates só ocultam UI**. Sem `WITH CHECK` simétrico em `profiles`/`notificacoes`/`sessoes_ativas`, um usuário autenticado consegue manipular dados via SDK Supabase mesmo sem ver o botão.

---

## PARTE 7 — Proposta técnica (PSEUDOCÓDIGO / NÃO EXECUTÁVEL)

Ordem sugerida (do mais crítico para o menos):

### L6-FIX-1 (P0) — `profiles_self_update` com `WITH CHECK` + trigger de imutabilidade
```sql
-- PSEUDOCÓDIGO — NÃO EXECUTAR
DROP POLICY profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.profiles_block_self_escalation() RETURNS trigger ... AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') AND NEW.id = auth.uid() THEN
    IF NEW.id <> OLD.id
       OR NEW.acessa_todas_empresas IS DISTINCT FROM OLD.acessa_todas_empresas
       OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.ativo IS DISTINCT FROM OLD.ativo
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
    THEN RAISE EXCEPTION 'campo imutavel para o proprio usuario'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;
CREATE TRIGGER trg_profiles_block_self_escalation BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_self_escalation();
```
Impacto: bloqueia auto-promoção; admin segue podendo editar. Testes: ver Parte 8 (T-L6-1..T-L6-4). Rollback fail-closed: DROP do trigger + restaurar policy original SEM tornar mais permissiva.

### L6-FIX-2 (P1) — `sessoes_ativas` UPDATE com `WITH CHECK` simétrico
```sql
-- PSEUDOCÓDIGO
DROP POLICY "atualizar minhas sessoes" ON public.sessoes_ativas;
CREATE POLICY "atualizar minhas sessoes" ON public.sessoes_ativas FOR UPDATE
  USING ((user_id = auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(),'admin'));
```

### L6-FIX-3 (P1) — `notificacoes."marcar minhas notificacoes"` com `WITH CHECK` + trigger imutável
Adicionar `WITH CHECK` simétrico e trigger restringindo UPDATE de não-admin a apenas `lida`/`updated_at`.

### L6-FIX-4 (P1) — `user_roles_admin_upd` com `WITH CHECK = has_role(auth.uid(),'admin')`
Simetria defensiva. Sem mudança funcional.

### L6-FIX-5 (P2) — `WITH CHECK` simétrico em `role_permissions.rp_admin_upd` e `empresas.empresas_admin_upd`
Hardening. Sem mudança funcional.

### L6-FIX-6 (Divergência funcional) — alinhar `user_can_see_empresa` com `user_pode_atuar_empresa`
Decisão de produto: incluir `acessa_todas_empresas` em `user_can_see_empresa` (e, idealmente, centralizar ambas em **uma só** função canônica). Sem alteração agora.

### L6-FIX-7 (Frontend) — auditoria de telas que dependem apenas de `ScreenGate`/`RoleGate`
Mapear telas que executam mutações sem RLS dedicada e adicionar RLS por tabela-fim, em blocos futuros (não escopo L6).

---

## PARTE 8 — Testes futuros (não executados)

1. T-L6-1: usuário comum UPDATE `profiles SET acessa_todas_empresas=true WHERE id=self` → deve **falhar** após L6-FIX-1.
2. T-L6-2: usuário comum UPDATE `profiles SET empresa_id=<outra>` → deve falhar.
3. T-L6-3: usuário comum UPDATE `profiles SET email=<outro>` → deve falhar.
4. T-L6-4: admin UPDATE `profiles SET acessa_todas_empresas=true WHERE id=<x>` → deve passar.
5. T-L6-5: usuário comum UPDATE `user_roles SET role='admin' WHERE user_id=self` → deve falhar (já bloqueado hoje).
6. T-L6-6: admin UPDATE `user_roles` → deve passar.
7. T-L6-7: usuário comum UPDATE `sessoes_ativas SET user_id=<outro> WHERE user_id=self` → deve falhar após L6-FIX-2.
8. T-L6-8: usuário comum UPDATE `notificacoes SET user_id=<outro>` → deve falhar após L6-FIX-3.
9. T-L6-9: usuário comum UPDATE `notificacoes SET lida=true WHERE user_id=self` → deve passar.
10. T-L6-10: SELECT em `empresas` para usuário não-admin com `acessa_todas_empresas=true` — confirmar se vê todas (divergência L6-FIX-6).
11. T-L6-11: troca de `empresa_atual_id` para empresa **não autorizada** → deve falhar (`trg_profiles_valida_empresa_atual`).
12. T-L6-12: revogação de sessão por admin → deve passar; por dono → deve passar; por terceiro → deve falhar.
13. T-L6-13: rota `/app/admin/...` por usuário comum acessada via URL direta → RouteGuard nega; tentativa de mutação via SDK → RLS nega.
14. T-L6-14: override individual em `screen_permission_user` por empresa e global — precedência.
15. T-L6-15: cache de `useAccessibleMenus`/`useScreenAccess` revalida ao trocar empresa.

---

## Retorno final

1. **Status A-2 L6:** REPROVADO_RISCO_CRÍTICO (P0 confirmado).
2. Tabelas: todas as 11 do escopo existem com RLS ON.
3. Policies críticas: `profiles_self_update` (P0), `sessoes_ativas/atualizar minhas sessoes` (P1), `notificacoes/marcar minhas notificacoes` (P1), `user_roles_admin_upd` (P1), `rp_admin_upd` (P2), `empresas_admin_upd` (P2).
4. Funções: `has_role`, `has_permissao`, `can_access`, `has_screen_access`, `user_pode_atuar_empresa`, `user_can_see_empresa` — todas SECDEF com search_path. Divergência multiempresa entre as duas últimas.
5. Riscos: 1× P0, 3× P1, 2× P2.
6. Auto-promoção: confirmada via `profiles.acessa_todas_empresas`.
7. Troca de empresa: bloqueada por trigger para `empresa_atual_id`; **liberada indiretamente** pelo P0 acima.
8. Rota direta: RouteGuard deny-by-default; risco real é mutação via SDK quando RLS for fraca.
9. Usuário global: existe via `acessa_todas_empresas`; tratado em `user_pode_atuar_empresa`, **não** em `user_can_see_empresa`.
10. Frontend: gates dependem majoritariamente de RLS para serem reais.
11. Proposta técnica: L6-FIX-1..7 (pseudocódigo).
12. Testes: T-L6-1..15.
13. Ordem recomendada: L6-FIX-1 → L6-FIX-2 → L6-FIX-3 → L6-FIX-4 → L6-FIX-5 → L6-FIX-6 → L6-FIX-7.
14. **Nenhuma alteração aplicada.**

## Confirmações finais

- Nenhuma migration criada.
- Nenhum SQL de alteração executado.
- Nenhum banco alterado.
- Nenhuma RLS alterada.
- Nenhuma policy alterada.
- Nenhuma função alterada.
- Nenhum usuário alterado.
- Nenhum role alterado.
- Nenhuma empresa alterada.
- Nenhum frontend alterado.
- Nenhuma Edge Function alterada.
- Nenhum storage alterado.
- Nenhum type alterado.
- Nenhum commit realizado.
