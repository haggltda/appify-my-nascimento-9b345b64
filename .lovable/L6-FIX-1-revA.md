# L6-FIX-1 REV. A — PLANO DE BUILD ISOLADO

**Escopo:** corrigir P0 de auto-escalada em `public.profiles` sem quebrar
usuários globais legítimos (financeiro/fiscal multiempresa do Grupo
Nascimento: HAG, SN, NH e demais).

**Status de execução:** NADA FOI EXECUTADO. Apenas leitura via
`supabase--read_query`. Nenhuma migration criada, nenhum SQL aplicado,
nenhum frontend/edge/type/dado/role/empresa alterado, nenhum commit.

---

## 1. Modelo de autorização unificado (reafirmado, não alterado)

```
Acesso final = ESCOPO DE EMPRESA  ∧  PERMISSÃO FUNCIONAL
```

- **Escopo de empresa (ONDE):** `public.user_pode_atuar_empresa(user, empresa)`
- **Permissão funcional (O QUE):** `public.has_role`, `public.has_permissao`,
  `public.can_access`, `public.has_screen_access`
- **Empresa ativa (`profiles.empresa_atual_id`):** apenas CONTEXTO de
  navegação/filtro visual. Nunca é a segurança final — segurança é RLS.
- **Acesso global (`profiles.acessa_todas_empresas = true`):** significa
  *"pode atuar em todas as empresas ativas"*, mas continua exigindo
  role/permissão funcional para cada ação. Não vira admin.

Usuários globais legítimos (ex.: lançador fiscal que opera HAG+SN+NH)
**continuam funcionando** porque `user_pode_atuar_empresa` já reconhece
o flag — a correção NÃO toca nessa função.

---

## 2. Pré-flight read-only (evidências coletadas)

### 2.1 Colunas reais de `public.profiles`
| coluna | tipo | null | default | classificação |
|---|---|---|---|---|
| `id` | uuid | NO | — | chave (= auth.uid) |
| `empresa_id` | uuid | YES | — | **SENSÍVEL** (empresa-base) |
| `display_name` | text | YES | — | seguro (self-edit) |
| `email` | text | YES | — | **SENSÍVEL** (identidade) |
| `ativo` | boolean | NO | true | **SENSÍVEL** (kill-switch) |
| `created_at` / `updated_at` | tstz | NO | now() | gerenciado |
| `must_change_password` | boolean | NO | false | **SENSÍVEL** (kill-switch de senha) |
| `avatar_url` | text | YES | — | seguro (self-edit) |
| `empresa_atual_id` | uuid | YES | — | contexto (self-edit COM validação) |
| `acessa_todas_empresas` | boolean | NO | false | **SENSÍVEL CRÍTICO** (vetor P0) |

### 2.2 Policies atuais de `public.profiles`
- `profiles_admin_insert` (INSERT, `WITH CHECK`: admin OR `id = auth.uid()`)
- `profiles_self_select` (SELECT, `USING`: `id = auth.uid() OR has_role(admin)`)
- `profiles_self_update` (UPDATE, `USING`: `id = auth.uid() OR has_role(admin)`, **`WITH CHECK` = NULL** → vetor P0)

### 2.3 Triggers existentes em `public.profiles`
- `trg_audit_profiles` (AFTER I/U/D → `audit_trigger()`) — auditoria já existe ✅
- `trg_profiles_upd` (BEFORE UPDATE → `set_updated_at()`)
- `trg_profiles_valida_empresa_atual` (BEFORE UPDATE OF `empresa_atual_id` → `profiles_validate_empresa_atual()`) — valida via `user_pode_atuar_empresa` ✅

### 2.4 `user_pode_atuar_empresa` (resumo do corpo real)
Retorna true se `_empresa NOT NULL` E:
1. `has_role(_user,'admin')`, **OU**
2. `profiles.acessa_todas_empresas = true` E empresa está ativa, **OU**
3. existe vínculo em `user_empresa`, **OU**
4. `profiles.empresa_id = _empresa`.

→ Confirma: o sistema reconhece quatro caminhos de escopo (admin, global,
vínculo n-para-n, empresa-base). A correção NÃO altera essa função.

### 2.5 Como o sistema representa "acesso a todas as empresas"
- Flag `profiles.acessa_todas_empresas` (booleano em profiles) — caminho 2 acima.
- Vínculo explícito `user_empresa(user_id, empresa_id)` — caminho 3 (alternativa quando se quer N empresas específicas, não todas).
- `has_role(admin)` — caminho 1 (admin é global por definição).

### 2.6 Frontend que toca `profiles` (uso real, sem alteração nesta etapa)
- `src/pages/MeuPerfil.tsx` — self-update do próprio usuário.
- `src/components/admin/UsuariosReal.tsx` + `src/pages/admin/AcessosPermissoes.tsx` + `src/pages/admin/tabs/IdentidadeTab.tsx` — fluxo administrativo.
- `src/context/EmpresaAtivaContext.tsx` — troca de `empresa_atual_id`.
- `src/context/PermissoesContext.tsx` — leitura.
- Edge: `supabase/functions/admin-create-user` — provisionamento.

### 2.7 SDK self-update
Sim, hoje o usuário consegue `supabase.from('profiles').update({...}).eq('id', auth.uid())`
porque `profiles_self_update` permite via `USING` e **não tem `WITH CHECK`**.
Esse é exatamente o P0.

---

## 3. Proposta técnica (NÃO EXECUTADA)

### 3.1 Princípio
Bloqueio é por **trigger BEFORE UPDATE comparando OLD vs NEW**, porque
`WITH CHECK` sozinho não compara colunas antigas vs novas e portanto não
consegue impedir auto-elevação granular. `WITH CHECK` simétrico é adicionado
apenas como cinto-suspensório (defesa em profundidade), não como solução.

### 3.2 Função-trigger nova: `public.profiles_block_self_escalation()`

Comportamento:

- Se `auth.uid() IS NULL` (chamada server-side sem JWT — edge function com
  service_role) → **permite** (admin-create-user, admin-reset-password e
  futuras edges administrativas continuam funcionando).
- Se `auth.uid() = OLD.id` E **NÃO** `has_role(auth.uid(),'admin')`
  (CONTEXTO 1 — self-update):
  - bloqueia mudança de `acessa_todas_empresas`
  - bloqueia mudança de `empresa_id`
  - bloqueia mudança de `ativo`
  - bloqueia mudança de `must_change_password`
  - bloqueia mudança de `email`
  - bloqueia mudança de `id`
  - `empresa_atual_id` continua passando pelo trigger existente (`profiles_validate_empresa_atual`) → ok mudar para empresa onde `user_pode_atuar_empresa` retorna true; reuso, sem duplicar lógica.
  - `display_name`, `avatar_url`: permitidos.
- Se `auth.uid() <> OLD.id` E **NÃO** admin → bloqueia (defesa contra
  edição cruzada via algum fluxo futuro).
- Se `has_role(auth.uid(),'admin')` (CONTEXTO 2 — fluxo administrativo) →
  permite tudo. `trg_audit_profiles` já registra a alteração (auditoria
  garantida sem nova infra).

Erro retornado: mensagem genérica `'campo restrito ao fluxo administrativo'`
com `ERRCODE = 'insufficient_privilege'` — sem vazar nome de campo nem stack.

### 3.3 Policy `profiles_self_update` — `WITH CHECK` simétrico
Adicionar `WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(),'admin'))`.
Não substitui a trigger; é cinto-suspensório contra reassinatura de `id`.

### 3.4 O que NÃO muda nesta etapa
- `user_pode_atuar_empresa` — intacta (preserva globais).
- `user_empresa`, `user_roles`, `role_permissions`, `app_menu`,
  `screen_permission_*` — intactos.
- `empresas` — intacta.
- `can_access`, `has_role`, `has_permissao`, `has_screen_access` — intactas.
- Frontend, edges, types, storage, buckets — intactos.
- Trigger `profiles_validate_empresa_atual` — intacta (reutilizada).
- Trigger `trg_audit_profiles` — intacta (já registra).

---

## 4. Migration PROPOSTA (não executar; preview apenas)

```sql
-- 1) função-trigger fail-closed
CREATE OR REPLACE FUNCTION public.profiles_block_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- chamadas server-side sem JWT (service_role em edges): permite
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- admin: permite (auditado por trg_audit_profiles)
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- não-admin não pode editar profile alheio
  IF v_uid <> OLD.id THEN
    RAISE EXCEPTION 'alteração restrita ao fluxo administrativo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- self-update: campos sensíveis imutáveis
  IF NEW.id <> OLD.id
     OR NEW.acessa_todas_empresas IS DISTINCT FROM OLD.acessa_todas_empresas
     OR NEW.empresa_id            IS DISTINCT FROM OLD.empresa_id
     OR NEW.ativo                 IS DISTINCT FROM OLD.ativo
     OR NEW.must_change_password  IS DISTINCT FROM OLD.must_change_password
     OR NEW.email                 IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'campo restrito ao fluxo administrativo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) trigger BEFORE UPDATE (roda antes de set_updated_at e do validador
--    de empresa_atual_id — order alfabética: prefixo 'a_' garante 1º)
CREATE TRIGGER a_trg_profiles_block_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_block_self_escalation();

-- 3) WITH CHECK simétrico na policy existente
DROP POLICY profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING      ((id = auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK ((id = auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role));
```

Nenhuma outra alteração. Sem `USING true`, sem `WITH CHECK true`,
sem mexer em outras tabelas/funções.

---

## 5. Plano de testes futuros

| # | cenário | esperado |
|---|---|---|
| T1 | usuário comum: `UPDATE profiles SET acessa_todas_empresas=true WHERE id=auth.uid()` | falha `insufficient_privilege` |
| T2 | usuário comum: muda `empresa_id` próprio | falha |
| T3 | usuário comum: muda `ativo=false` próprio | falha |
| T4 | usuário comum: muda `must_change_password=false` | falha |
| T5 | usuário comum: muda `email` | falha |
| T6 | usuário comum: muda `display_name`/`avatar_url` | passa |
| T7 | usuário comum: `empresa_atual_id` para empresa permitida | passa |
| T8 | usuário comum: `empresa_atual_id` para empresa não permitida | falha (trigger existente) |
| T9 | admin: concede `acessa_todas_empresas=true` a usuário financeiro | passa |
| T10 | financeiro com `acessa_todas_empresas=true` + role financeiro → lança em HAG/SN/NH | passa (RLS via user_pode_atuar_empresa ∧ has_role) |
| T11 | usuário com `acessa_todas_empresas=true` SEM role funcional → tenta anexo fiscal | falha (K/O-1B já bloqueia) |
| T12 | K/O-1A e K/O-1B continuam funcionando | sem regressão |
| T13 | RouteGuard/ScreenGate inalterados | ok |
| T14 | `EmpresaAtivaContext` troca para empresa autorizada | passa |
| T15 | usuário comum tenta editar profile alheio via SDK | falha |
| T16 | edge `admin-create-user` (service_role) cria/atualiza profile | passa (v_uid IS NULL) |

Execução: MODO-A com usuários reais — pendente, fora desta etapa.

---

## 6. Rollback fail-closed

Se houver regressão funcional, rollback **somente** remove o `WITH CHECK`
adicionado e a trigger:

```sql
-- NÃO recriar policies antigas vulneráveis
DROP TRIGGER IF EXISTS a_trg_profiles_block_self_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_block_self_escalation();
-- policy profiles_self_update permanece com WITH CHECK simétrico
-- (mantém ao menos o cinto-suspensório; NÃO restaura a vulnerabilidade
--  de WITH CHECK ausente).
```

Princípio: rollback nunca devolve auto-promoção.

---

## 7. Impacto avaliado

| área | impacto esperado |
|---|---|
| Administração > Usuários | nenhum (admin passa pela trigger) |
| Meu Perfil | só `display_name`/`avatar_url` editáveis pelo próprio usuário (já é o comportamento de UI hoje) |
| Troca de empresa ativa | preservada (trigger existente cobre) |
| Financeiro/fiscal multiempresa | preservado (função user_pode_atuar_empresa intacta) |
| K/O-1A / K/O-1B | preservados (não há mudança em anexos) |
| NFs / contas a pagar / estoque / fornecedores / BDI / contrato futuros | herdam o mesmo modelo unificado |
| Usuário admin | preservado |
| Usuário sem role funcional | continua sem operar — agora também sem conseguir se autopromover |
| Usuário com acesso global sem permissão de módulo | continua bloqueado por has_permissao/has_role |
| Edge functions com service_role | preservadas (auth.uid() IS NULL → bypass) |

---

## 8. Confirmações

- Módulos / permissões NÃO foram reescritos.
- `app_menu`, `role_permissions`, `screen_permission_*`, `can_access`,
  `has_screen_access`, `has_permissao`, `has_role`,
  `user_pode_atuar_empresa` NÃO foram alterados.
- Usuários globais legítimos (HAG+SN+NH) serão preservados — flag
  `acessa_todas_empresas` continua válido e respeitado.
- Usuário comum não conseguirá se autopromover (trigger fail-closed).
- Nada foi alterado nesta etapa (sem migration aplicada, sem SQL, sem
  frontend, sem edge, sem types, sem dado, sem role, sem empresa, sem
  storage, sem commit).

---

## 9. Classificação final

**CANDIDATO_A_BUILD_ISOLADO_CONDICIONAL**

Condições para autorização de execução:
1. confirmação humana de que o conjunto de campos sensíveis está completo
   (especialmente `email` — se o fluxo de auth do projeto não usa
   `profiles.email` como identidade, pode ser removido da lista);
2. confirmação de que `display_name` e `avatar_url` permanecem auto-editáveis
   (mantido na proposta);
3. autorização explícita para criar a migration L6-FIX-1.
