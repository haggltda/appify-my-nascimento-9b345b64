# A1 — Fase 0: Diagnóstico de Permissões, RLS e Governança (read-only)

Data: 2026-05-27 · Modo: **somente leitura** · Nenhuma alteração foi feita.

## 1. Resumo executivo

- **RLS habilitada em 100% das tabelas `public`** (0 tabelas sem RLS). Boa base.
- **Funções de governança já existem e estão corretas**: `has_role`, `has_screen_access`, `list_accessible_menus` — todas `SECURITY DEFINER` com `search_path = public`. A lógica de precedência **usuário > perfil > admin** já está implementada conforme planejado.
- **🔴 ACHADO CRÍTICO**: `fornecedor_conta_bancaria` possui **policies duplicadas e conflitantes**, incluindo uma SELECT `USING (true)` que torna **dados bancários de fornecedores legíveis por qualquer usuário autenticado** — bypassando totalmente o controle granular. Mesma situação em ~30 outras tabelas (lista abaixo).
- **14 usuários com role `admin`** (de 49 profiles). É muito — recomendo revisão antes de endurecer RLS.
- **132 overrides** em `screen_permission_user` concentrados em 5 usuários (1 com 73). Devem ser preservados.
- **Linter retornou 302 issues**: 4 ERROR (SECURITY DEFINER views), ~298 WARN (search_path mutable, public can execute definer fns, RLS sempre true, buckets públicos).

## 2. Inventário do banco

### 2.1 Tabelas governança (contagens)

| Tabela | Linhas |
|---|---|
| `user_roles` | 86 |
| `role_permissions` | 974 |
| `screen_permission_profile` | 446 |
| `screen_permission_user` (overrides) | **132** |
| `perfil_metadata` | 17 |
| `app_menu` | 90 |
| `profiles` | 49 |

### 2.2 Enum `app_role` (16 valores)

`admin, controladoria, comercial, operacional, juridico, sst, diretor_adm, diretor_op, visitante, comprador, almoxarife, gestor_cc, fiscal_recebedor, financeiro, fiscal, presidencia, usuario`

### 2.3 Enum `app_acao` (8 valores)

`visualizar, incluir, alterar, excluir, aprovar, exportar, executar_ia, alterar_dre`

### 2.4 Distribuição de roles

| Role | Usuários |
|---|---|
| usuario | 33 |
| **admin** | **14** ⚠️ |
| financeiro | 7 |
| operacional / sst | 6 / 6 |
| visitante / juridico / comercial | 4 cada |
| controladoria | 3 |
| comprador | 2 |
| diretor_adm / diretor_op / fiscal | 1 cada |

> **Risco**: 14 admins (28% da base) bypassam toda a RLS via `has_role(_,'admin')`. Recomendo classificar quais devem virar `controladoria` ou perfil intermediário.

### 2.5 Overrides por usuário (top 5)

| user_id | overrides |
|---|---|
| `8a03a976-…` | **73** |
| `16eb1de3-…` | 24 |
| `9645ba19-…` | 24 |
| `8f426a53-…` | 6 |
| `3dff844b-…` | 5 |

Todos serão preservados na Fase 1 (zero `DELETE`).

### 2.6 `perfil_metadata` — estrutura real

Colunas: `role` (app_role), `descricao`, `icone`, `cor`, `updated_at`, `updated_by`.
**Não tem `codigo`, `nome` nem `ativo`.** O "perfil" É o enum `app_role` — não há perfis customizados além dos 17 do enum. Isso bate com o playbook, que prevê todo cadastro dinâmico via `perfil_metadata`.

## 3. Funções de governança (já implementadas corretamente)

| Função | Status |
|---|---|
| `has_role(uuid, app_role)` | ✅ definer, search_path OK |
| `has_screen_access(uuid, text, app_acao, uuid)` | ✅ aplica precedência admin → override empresa → override global → perfil |
| `list_accessible_menus(uuid, text, uuid)` | ✅ unifica perfil + overrides + DENY |

Conclusão: **não precisamos reescrever essas funções na Fase 1.** Só ajustar consumidores e endurecer RLS de tabelas sensíveis.

## 4. 🔴 Achados críticos de RLS

### 4.1 `fornecedor_conta_bancaria` — 8 policies, com `USING (true)` permissiva

Existem **8 policies** na mesma tabela:
- `fcb_select` (granular OK)
- `fcb_insert` / `fcb_update` / `fcb_delete` (granulares OK)
- `perm select fornecedor_conta` (granular OK)
- `perm insert/update/delete` (granular OK)
- **`auth read fornecedor_conta_bancaria` — `USING (true)`** ⚠️

Como Postgres aplica policies permissivas com **OR**, a policy `USING (true)` **anula** todas as restrições. **Qualquer usuário autenticado lê dados bancários de qualquer empresa/fornecedor.**

### 4.2 Outras tabelas com SELECT `USING (true)` (1 policy cada)

`app_menu`, `app_modulo`, `area`, `centros_custo_sequencia`, `cfop`, `comite`, `empresas`, `ia_provedores`, `integration_layout_columns`, `integration_layout_fingerprints`, `integration_layouts`, `integration_validation_rules`, `perfil_metadata`, `plano_contas_master`, `pre_titulo_anexo`, `pre_titulo_rateio`, `role_permissions`, `saldos_iniciais_caixa`, `screen_permission_profile`, `setor`, **9 tabelas `stg_*`** (staging do pacote02/FCR).

**Análise por categoria**:
- Catálogos públicos OK: `app_menu`, `app_modulo`, `area`, `cfop`, `setor`, `comite`, `perfil_metadata`, `plano_contas_master` (leitura ampla é aceitável; admins controlam escrita).
- **Sensíveis** (precisam endurecer): `empresas`, `centros_custo_sequencia`, `role_permissions`, `screen_permission_profile`, `saldos_iniciais_caixa`, `pre_titulo_anexo`, `pre_titulo_rateio`, `ia_provedores` (pode conter chaves), `integration_layouts*`.
- Staging `stg_*`: aceitável manter aberto para admins, mas idealmente restringir a `controladoria`.

## 5. Linter — 302 issues, agrupadas

| Categoria | Qtd | Severidade |
|---|---|---|
| Security Definer **View** | 4 | ERROR |
| Function search_path mutable | ~5 | WARN |
| Extension in public | 1 | WARN |
| RLS Policy Always True (UPDATE/DELETE/INSERT) | ~3 | WARN |
| Public Bucket Allows Listing | 2 | WARN |
| Public Can Execute SECURITY DEFINER Function | **~280** | WARN |
| Outros | restante | WARN |

> Os ~280 warnings de "Public Can Execute SECURITY DEFINER Function" são funções de negócio (cnab, contabilizar_*, dre_*, etc.) acessíveis ao role `anon`. Não é necessariamente exploit (a maioria valida `auth.uid()` internamente), mas vale revogar EXECUTE de `anon` em massa.

## 6. Frontend / Edge Functions

- `PermissoesContext` (`src/context/PermissoesContext.tsx`): carrega roles + `role_permissions` no login. Lógica de bypass admin local correta. **Não consulta overrides** (`screen_permission_user`) — depende de `useScreenAccess` para isso. OK.
- `useScreenAccess` → `has_screen_access` ✅
- `useAccessibleMenus` → `list_accessible_menus` ✅
- `ScreenGate` ✅ / `RoleGate` (não verificado em detalhe) / `RouteGuard` (não verificado em detalhe)
- Edge functions `admin-create-user`, `admin-reset-password`, `admin-revoke-session`: **não auditadas nesta fase** (Fase 2). Risco médio se não validam role admin do caller.

## 7. Tabela de riscos

| # | Risco | Severidade | Mitigação Fase 1 |
|---|---|---|---|
| R1 | `fornecedor_conta_bancaria` exposto a todos autenticados via policy `USING (true)` | **🔴 Crítico** | DROP da policy permissiva; manter `fcb_*` granulares |
| R2 | `empresas`, `role_permissions`, `screen_permission_profile`, `ia_provedores` com SELECT aberto | 🟠 Alto | Substituir `USING (true)` por `has_role(_,'admin') OR user_can_see_empresa(empresa_id)` |
| R3 | 14 admins (28% da base) | 🟡 Médio | Revisão manual antes de Fase 1; sugestão de gate |
| R4 | 4 SECURITY DEFINER views (ERROR no linter) | 🟠 Alto | Converter para INVOKER ou recriar como funções com RLS aplicada |
| R5 | ~280 SECURITY DEFINER fns executáveis por `anon` | 🟡 Médio | `REVOKE EXECUTE ON FUNCTION ... FROM anon` em massa |
| R6 | Funções `update_updated_at_column` etc. sem `search_path` | 🟢 Baixo | `ALTER FUNCTION ... SET search_path = public` |
| R7 | Edge functions admin-* podem aceitar caller não-admin | 🟠 Alto | Validar `has_role(caller,'admin')` no início (Fase 2) |
| R8 | 132 overrides em `screen_permission_user` — quebrar pode tirar acesso de produção | 🟡 Médio | Backup + dry-run antes de qualquer ALTER |

## 8. Estimativa refinada de créditos

Comparado à estimativa inicial (28–70), os dados reais **reduzem o esforço**:

| Fase | Escopo refinado | Mensagens |
|---|---|---|
| **Fase 1A — RLS crítico** | DROP `auth read fornecedor_conta_bancaria` + 4 tabelas sensíveis (R1+R2) | **3–5** |
| **Fase 1B — Hardening linter** | Revoke EXECUTE anon, fix search_path, converter 4 views | **5–8** |
| **Fase 1C — Validações** | Smoke test (login admin, login usuario, login com 73 overrides), linter re-run | **2–4** |
| **Fase 2 — Frontend** | Unificar UI de gestão (já parcialmente feito), `PermissoesContext` ler overrides via cache, ScreenGate em telas que faltam | **6–10** |
| **Fase 2 — Edge Functions** | Validar role admin em `admin-create-user`/`reset`/`revoke` | **3–5** |
| **QA + buffer** | | **4–8** |
| **Total** | | **~23–40 créditos** |

> Reserva sugerida: **30 créditos** com gate entre Fase 1 e Fase 2.

## 9. Para leigo

- O sistema **já tem a estrutura certa** (RLS ligada em tudo, funções `has_role`/`has_screen_access` funcionando, 132 permissões personalizadas por usuário preservadas).
- O problema **concreto e urgente**: uma regra antiga, esquecida, deixou os **dados bancários de fornecedores visíveis para qualquer usuário logado**. Isso precisa ser corrigido o quanto antes.
- O resto são afinamentos (revogar acesso público a funções internas, restringir 4 ou 5 tabelas sensíveis, validar admins nas edge functions).
- Nenhum dado em produção será perdido. As 132 permissões customizadas, os 974 acessos de perfil e os 446 acessos por perfil/tela ficam intactos.

## 10. Próximo passo — pergunta de gate

**Aprovar Fase 1A (correção crítica: RLS de `fornecedor_conta_bancaria` + 4 tabelas sensíveis)?**

Se sim, na próxima mensagem eu submeto a migração SQL (somente DROP de policies permissivas + recriação restrita; **sem CREATE/DROP de tabelas, sem DELETE de dados**) e rodo o linter novamente para confirmar.
