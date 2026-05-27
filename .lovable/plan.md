
# B1.5 v3 — Plano final de RLS para `fornecedor_conta_bancaria` (PLAN MODE, nada executado)

Escopo restrito: somente `public.fornecedor_conta_bancaria`. Não toca `fornecedor`, frontend, Storage, RouteGuard, Sidebar, app_menu, Triagem, centros_custo, pre_titulo_promover, DRE/Fluxo, conferências, orçamento/faturamento. `forn_insert` e `forn_delete` permanecem registrados para **B1.6** (não incluídos aqui).

---

## 1. SQL proposto (texto, não aplicado)

Nome sugerido do arquivo (a gerar somente após aprovação): `<timestamp>_b15v3_fcb_escopo_empresa.sql`.

```sql
-- =====================================================================
-- B1.5 v3 — RLS escopado por empresa em public.fornecedor_conta_bancaria
-- Pré-requisitos (já existentes no banco, confirmados em B0/B1):
--   - public.has_role(uuid, app_role)
--   - public.has_permissao(uuid, text, text, text)
--   - public.user_pode_atuar_empresa(uuid, uuid)
--   - public.fornecedor(id, empresa_id, is_global, ...)
--   - public.fornecedor_conta_bancaria(id, fornecedor_id, empresa_id, ...)
-- Não altera tabela, grants nem triggers.
-- Não recria as policies "auth *" abertas removidas no B1 original.
-- =====================================================================

BEGIN;

-- 1) Remover as 4 policies "perm *" sem escopo de empresa.
DROP POLICY IF EXISTS "perm select fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm insert fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm update fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm delete fornecedor_conta" ON public.fornecedor_conta_bancaria;

-- Sanidade: garantir que policies "auth *" abertas não existam (foram removidas em B1).
DROP POLICY IF EXISTS "auth read fornecedor_conta_bancaria"   ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth insert fornecedor_conta_bancaria" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth update fornecedor_conta_bancaria" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth delete fornecedor_conta_bancaria" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth select fornecedor_conta"          ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth insert fornecedor_conta"          ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth update fornecedor_conta"          ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth delete fornecedor_conta"          ON public.fornecedor_conta_bancaria;

-- 2) SELECT escopado por empresa
CREATE POLICY "fcb_select"
ON public.fornecedor_conta_bancaria
FOR SELECT
TO authenticated
USING (
  public.has_permissao(auth.uid(), 'suprimentos', 'visualizar', 'fornecedor.conta_bancaria')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
);

-- 3) INSERT escopado + validação cruzada do fornecedor
CREATE POLICY "fcb_insert"
ON public.fornecedor_conta_bancaria
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permissao(auth.uid(), 'suprimentos', 'incluir', 'fornecedor.conta_bancaria')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
  AND EXISTS (
    SELECT 1
    FROM public.fornecedor f
    WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
      AND (
        f.is_global = true
        OR f.empresa_id = fornecedor_conta_bancaria.empresa_id
      )
  )
);

-- 4) UPDATE escopado + validação cruzada repetida no WITH CHECK
--    (USING controla a linha antiga; WITH CHECK controla a linha resultante)
CREATE POLICY "fcb_update"
ON public.fornecedor_conta_bancaria
FOR UPDATE
TO authenticated
USING (
  public.has_permissao(auth.uid(), 'suprimentos', 'alterar', 'fornecedor.conta_bancaria')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
)
WITH CHECK (
  public.has_permissao(auth.uid(), 'suprimentos', 'alterar', 'fornecedor.conta_bancaria')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
  AND EXISTS (
    SELECT 1
    FROM public.fornecedor f
    WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
      AND (
        f.is_global = true
        OR f.empresa_id = fornecedor_conta_bancaria.empresa_id
      )
  )
);

-- 5) DELETE escopado
CREATE POLICY "fcb_delete"
ON public.fornecedor_conta_bancaria
FOR DELETE
TO authenticated
USING (
  public.has_permissao(auth.uid(), 'suprimentos', 'excluir', 'fornecedor.conta_bancaria')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
);

COMMIT;
```

Notas técnicas:
- `WITH CHECK` no UPDATE é **obrigatório** para bloquear o caso "atualizar conta da empresa A apontando `fornecedor_id` para fornecedor local da empresa B". Sem ele, USING valida só a linha anterior.
- Não há `INSERT` com `empresa_id` divergente da empresa ativa: `EXISTS(...) f.is_global OR f.empresa_id = fcb.empresa_id` garante que conta de fornecedor local só pode ser cadastrada na empresa dona do fornecedor.
- Admin bypass mantido em todas as 4 policies via `has_role(...,'admin')`.
- Nenhum `GRANT` alterado — privilégios atuais (`authenticated`, `service_role`) preservados.

---

## 2. Resumo de impacto

| Persona | Antes | Depois (B1.5 v3) |
|---|---|---|
| Usuário sem `fornecedor.conta_bancaria` | Bloqueado pela `perm` | Bloqueado igual (sem mudança visível) |
| Comprador E1 | Via contas de qualquer empresa | Vê só contas com `empresa_id` em que atua |
| Financeiro E1 | Cadastrava/editava cross-empresa | Cadastra/edita só na sua empresa; bloqueado para fornecedor local de E2 |
| Suprimentos E1 | Idem | Idem; pode ter conta própria para fornecedor global |
| Controladoria E1 | Cross-empresa | Escopada por empresa em que atua |
| Admin | Tudo | Tudo (bypass mantido) |

Impacto operacional fora do cadastro de fornecedor: **zero**. PreTítulos, NF, Contas a Pagar, Programação, Malotes/CNAB, Conciliação e Receber não usam essa tabela (confirmado no diagnóstico aprovado).

Risco de regressão de dados: nulo — `fornecedor_conta_bancaria` tem 1 registro vinculado a fornecedor não-global na empresa correta.

---

## 3. Checklist de testes Given/When/Then

Pré-condições compartilhadas:
- E1 e E2 são empresas distintas.
- `u_e1_fin` = usuário financeiro com `user_pode_atuar_empresa(u_e1_fin, E1)=true` e permissão `suprimentos.fornecedor.conta_bancaria` (visualizar/incluir/alterar/excluir).
- `u_e1_sem_perm` = usuário E1 sem `has_permissao('suprimentos','*','fornecedor.conta_bancaria')`.
- `forn_global` com `is_global=true`.
- `forn_local_e2` com `is_global=false`, `empresa_id=E2`.
- `cb_e2_global` = conta bancária para `forn_global` com `empresa_id=E2`.

| # | Given | When | Then | Resultado esperado |
|---|---|---|---|---|
| T1 | `u_e1_fin` logado | SELECT em `fornecedor` filtrando `forn_global` | retorno não vazio | ✅ PASS (RLS de `fornecedor` mantida em B1.5) |
| T2 | `u_e1_fin` logado | SELECT em `fornecedor_conta_bancaria` WHERE id = cb_e2_global | 0 linhas | ✅ PASS (empresa_id=E2 não está no escopo de u_e1_fin) |
| T3 | `u_e1_fin` logado | INSERT em fcb (`fornecedor_id=forn_global, empresa_id=E1`) | sucesso | ✅ PASS |
| T4 | `u_e1_fin` logado | INSERT em fcb (`fornecedor_id=forn_local_e2, empresa_id=E1`) | erro RLS / 0 linhas | ✅ PASS (forn não-global e empresa_id diverge) |
| T5 | `u_e1_fin` logado | INSERT em fcb (`fornecedor_id=forn_global, empresa_id=E2`) | erro RLS | ✅ PASS (u_e1_fin não atua em E2) |
| T6 | `u_e1_fin` logado, conta `cb_e1` (forn_global, E1) já existe | UPDATE cb_e1 SET fornecedor_id=forn_local_e2 | erro RLS via WITH CHECK | ✅ PASS (bloqueia troca para fornecedor local de outra empresa) |
| T7 | `u_e1_fin` logado, cb_e1 existente | UPDATE cb_e1 SET principal=true | sucesso | ✅ PASS |
| T8 | `u_e1_fin` logado | DELETE cb_e2_global (empresa_id=E2) | 0 linhas | ✅ PASS |
| T9 | `u_e1_sem_perm` logado | SELECT em fcb | 0 linhas | ✅ PASS (permissão bloqueia antes do escopo) |
| T10 | `u_e1_sem_perm` logado | INSERT em fcb (qualquer) | erro RLS | ✅ PASS |
| T11 | admin logado | SELECT em fcb (qualquer empresa) | retorna tudo | ✅ PASS (bypass) |
| T12 | `u_e1_fin` em PreTitulosTab | `supabase.from('fornecedor').select('id, razao_social')` | lista inclui `forn_global` | ✅ PASS (PreTítulos não depende de fcb) |
| T13 | `u_e1_fin` em PreTitulosTab | INSERT em `pre_titulo` com `fornecedor_id=forn_global, empresa_id=E1` | sucesso | ✅ PASS (sem acoplamento com fcb) |

Todos os 13 testes devem rodar antes e depois da migração para confirmar não-regressão (T1, T12, T13) e correção (T2, T4–T6, T8–T10).

Forma de execução sugerida (após aprovação): SQL `SET LOCAL role authenticated; SET LOCAL request.jwt.claims = '{"sub":"<uuid>"}'` em transação read-only, ou checks via Supabase JS com sessão dos usuários de teste.

---

## 4. Rollback

### 4.1 Rollback seguro (recomendado)

Restaura apenas leitura escopada e bloqueia escritas sensíveis — **não** reabre SELECT global. Útil se algo travar fluxo legítimo de cadastro.

```sql
BEGIN;

DROP POLICY IF EXISTS "fcb_insert" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "fcb_update" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "fcb_delete" ON public.fornecedor_conta_bancaria;

-- Mantém "fcb_select" intacta → leitura continua escopada por empresa.
-- Escritas ficam totalmente bloqueadas até reaplicar policies corrigidas.

COMMIT;
```

### 4.2 Rollback emergencial restrito (janela controlada)

Se for absolutamente necessário escrever cross-empresa em uma janela de minutos (ex.: ajuste manual feito por admin via app, não via SQL), recriar apenas INSERT/UPDATE **ainda exigindo permissão e admin/atuação na empresa**, mas sem o `EXISTS(... fornecedor ...)`. Não recria policies abertas.

```sql
BEGIN;

DROP POLICY IF EXISTS "fcb_insert" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "fcb_update" ON public.fornecedor_conta_bancaria;

CREATE POLICY "fcb_insert_relaxed" ON public.fornecedor_conta_bancaria
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permissao(auth.uid(),'suprimentos','incluir','fornecedor.conta_bancaria')
  AND (public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.user_pode_atuar_empresa(auth.uid(), empresa_id))
);

CREATE POLICY "fcb_update_relaxed" ON public.fornecedor_conta_bancaria
FOR UPDATE TO authenticated
USING (
  public.has_permissao(auth.uid(),'suprimentos','alterar','fornecedor.conta_bancaria')
  AND (public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.user_pode_atuar_empresa(auth.uid(), empresa_id))
)
WITH CHECK (
  public.has_permissao(auth.uid(),'suprimentos','alterar','fornecedor.conta_bancaria')
  AND (public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.user_pode_atuar_empresa(auth.uid(), empresa_id))
);

COMMIT;
```

Política operacional: rollback 4.2 só com aprovação humana explícita, janela de tempo declarada e reaplicação obrigatória do B1.5 v3 ao fim da janela.

### 4.3 O que rollback **não** faz

- Não recria `auth select/insert/update/delete fornecedor_conta`.
- Não recria `auth read/insert/update/delete fornecedor_conta_bancaria`.
- Não recria `perm * fornecedor_conta` sem escopo.
- Nunca reabre leitura cross-empresa.

---

## 5. Itens fora do escopo (registrados para B1.6)

- `forn_insert` em `public.fornecedor` sem `WITH CHECK` — risco de inserir fornecedor com `is_global=true` ou `empresa_id` arbitrário.
- `forn_delete` em `public.fornecedor` sem escopo por empresa/admin.
- Banner UI em `ContasBancariasGenericTab` ("conta visível apenas para a empresa X").
- Consolidação dos dois dialogs (`ContaBancariaDialog` legado vs `ContaBancariaGenericDialog`).
- Eventual `cb.is_global` formal para conta bancária compartilhada entre empresas (decisão de produto, hoje não existe).

Nenhum desses itens entra na migration B1.5 v3.

---

## 6. Confirmação

**Nada executado.** Nenhuma migration criada. Nenhum `DROP POLICY` ou `CREATE POLICY` rodado no banco. Frontend, Storage, RouteGuard, Sidebar, app_menu, Triagem, centros_custo, pre_titulo_promover, DRE/Fluxo, conferências e orçamento/faturamento permanecem intocados.

---

## 7. Próximas opções (aguardando aprovação humana)

1. **Aprovar B1.5 v3** e autorizar a geração da migration `*_b15v3_fcb_escopo_empresa.sql` exatamente como §1. Eu crio o arquivo e paro novamente antes de aplicar.
2. **Aprovar B1.5 v3 + B1.6** juntos no próximo plano (sem executar) para revisar `forn_insert` e `forn_delete` em `public.fornecedor`.
3. **Pedir ajustes em §1** (ex.: incluir `diretor_operacional` no SELECT independentemente de permissão; permitir DELETE apenas para admin+controladoria; adicionar checagem `cb.ativa=false` antes de DELETE; logar via trigger de auditoria). Eu reescrevo §1 e §3.
4. **Rodar antes os testes T1–T13 em ambiente** read-only com usuários reais que você indicar. Diga os UUIDs e eu monto o script de verificação (somente SELECT).
5. **Pausar B1.5** e voltar para B1 ou outro bloco.

Pare aqui. Aguardando aprovação humana.
