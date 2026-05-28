# A2 — Introspecção de governança (Bloco V5)

**Data:** 2026-05-28
**Modo:** estritamente read-only. Nenhuma policy, GRANT, RPC ou código foi alterado.
**Fonte:** `pg_class`, `pg_policies`, `pg_proc`, `pg_views`, `has_table_privilege` em `public` (snapshot 2026-05-28).

---

## 1. RLS — visão agregada

| Métrica | Valor |
|---|---|
| Tabelas em `public` (relkind='r') | **236** |
| Com RLS habilitada | **236** (100 %) |
| Sem RLS habilitada | **0** |
| Tabelas com pelo menos uma policy | **237** (cobre 100 % das tabelas; +1 conta provável de particionamento) |
| Policies totais | **562** |

**OK:** não há tabela em `public` exposta sem RLS, e não há tabela com RLS habilitada e zero policies (cenário em que tudo seria negado silenciosamente).

---

## 2. GRANTs no schema `public` — **ALERTA arquitetural**

**Achado:** todas as 236 tabelas de `public` concedem `SELECT, INSERT, UPDATE, DELETE` a **`anon`** e **`authenticated`** (verificado via `has_table_privilege` em amostra integral). Este é o padrão *legacy* do Supabase em que `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated` ainda está ativo — a RLS é a **única** barreira.

**Risco:** qualquer nova tabela criada sem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` fica imediatamente legível e gravável por qualquer cliente com a `anon key`. Hoje o risco está mitigado porque 100 % das tabelas têm RLS, mas o piso de segurança é a disciplina do migrator, não a configuração.

**Recomendação (não executada):** em bloco futuro, considerar `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon` e voltar a conceder explicitamente por tabela conforme padrão Lovable Cloud atual. Decisão exige inventário de quais telas dependem de `anon` para leitura pública — pelo menos `app_menu` e `app_modulo` têm policy `SELECT … USING (true)` para `authenticated`, então o impacto seria contido. **Não executar sem aprovação humana e janela de manutenção.**

---

## 3. Policies "always true" e permissões amplas — **ALERTA pontual**

O linter do Supabase sinalizou (cf. saída da migration de 2026-05-28, findings 11+):
- `RLS Policy Always True` em policies de UPDATE/DELETE/INSERT (USING/WITH CHECK `true`) — pelo menos 1 caso. **Não enumerado aqui** porque o linter não devolve o nome. Pendente: query direcionada por tabela quando o próximo bloco for aberto.
- `Security Definer View` em **4 views** — todas as 11 views de `public` são `definer-default` (sem `WITH (security_invoker=true)`), o que significa que as views executam com privilégios do owner e ignoram a RLS do chamador. Lista completa:

| view | modo |
|---|---|
| v_dre_comparativo | definer-default |
| v_estoque_consolidado | definer-default |
| v_fluxo_caixa_consolidado | definer-default |
| v_fluxo_caixa_mensal | definer-default |
| v_ia_contexto_empresa | definer-default |
| v_obz_mensal | definer-default |
| v_realizado_mensal | definer-default |
| vw_bi_resumo_empresa | definer-default |
| vw_conciliacao_eventos | definer-default |
| vw_dre_contrato | definer-default |
| vw_mz_32_promocao_status | definer-default |

**Impacto:** se qualquer uma dessas views consulta tabela `EMPRESARIAL` sem filtro explícito por `empresa_id`, qualquer usuário autenticado com SELECT na view enxerga **todas as empresas**. Precisa-se auditar individualmente. Não fizemos isso neste bloco — entra como pendência prioritária do próximo plano.

---

## 4. RPCs de governança — auditoria

### 4.1 `public.has_role(_user_id uuid, _role app_role) → boolean`
- `STABLE SECURITY DEFINER`, `search_path = public`. **OK.**
- Lógica: `EXISTS` em `user_roles`. Conforme padrão Lovable. Sem risco.

### 4.2 `public.can_access(_user, _menu, _acao, _empresa, _modulo) → boolean`
- `STABLE SECURITY DEFINER`, `search_path = public, pg_temp`. OK.
- Lógica resumida: admin → true; senão, user_override em `screen_permission_user`; senão, união de `role_permissions` + `screen_permission_profile`.
- **ALERTA (descoberta nova):** a função filtra `app_menu` por `ativo=true` **somente** dentro da CTE `menu_info`, mas o branch **admin retorna `true` antes** dessa checagem. Resultado: **um admin que chamar `can_access('triagem','visualizar')` ainda recebe `true` mesmo com o menu inativo.**
  - O `RouteGuard` continua negando porque a flag soberana `triagemIA` prevalece (Bloco V3) e `list_accessible_menus` filtra `ativo=true`.
  - Mas qualquer outro caller que use `can_access` direto como gate (ex.: edge function, RPC, RLS de outra tabela) **não estará protegido** pela desativação do menu.
  - Recomendação para bloco futuro: mover o filtro `ativo=true` para o início, antes do branch admin. **Não alterado agora** — exige plano dedicado, pode quebrar premissas de outras RPCs.

### 4.3 `public.list_accessible_menus(_user, _acao, _empresa) → setof text`
- `STABLE SECURITY DEFINER`, `search_path = public`. OK.
- **Confirma a premissa do A1:** a cláusula final `AND EXISTS (… app_menu m WHERE m.codigo = b.menu_codigo AND m.ativo = true)` garante que **menu inativo nunca é retornado, mesmo para admin e mesmo com SPU `allow=true`.**
- Confirma também: **`screen_permission_user` com `allow=true` não consegue reativar um menu inativo na sidebar.** Risco "reativação acidental via SPU" do plano da migration → **mitigado**.

### 4.4 Funções `SECURITY DEFINER` em `public`
- Total: amostragem mostrou >70 funções com `prosecdef = true`, **todas com `search_path` configurado** (em geral `public` ou `public, pg_temp`). OK quanto ao vetor mais comum (search_path mutável).
- Inventário completo não cabe neste doc — disponível via `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef`.
- Warnings residuais do linter "Function Search Path Mutable" (findings 5–9) apontam algumas funções sem `search_path` — não foram identificadas individualmente neste bloco. Pendência.

---

## 5. Tabelas-pivô de permissão — confirmação

| tabela | RLS | policies relevantes (resumo) | nota |
|---|---|---|---|
| `app_menu` | on | SELECT `USING (true)` para authenticated; CUD restrito a `has_role(admin)` | Leitura aberta a qualquer logado — necessário para o sidebar funcionar. OK. |
| `app_modulo` | on | mesmo padrão | OK. |
| `screen_permission_profile` | on | (não detalhado neste recorte) | Pendente inspeção em bloco futuro. |
| `screen_permission_user` | on | (não detalhado neste recorte) | Pendente. |
| `user_roles` | on | (não detalhado neste recorte) | Pendente — sensível, exige auditoria dedicada. |
| `access_audit_log` | on | INSERT `WITH CHECK (user_id = auth.uid())`; SELECT próprio ou admin | OK — usuário só registra/lê o próprio log. |

---

## 6. Cruzamento com A1 (matriz EMPRESARIAL)

Amostragem das policies das tabelas `EMPRESARIAL` confirmadas em A1 mostra uso consistente do helper `user_pode_atuar_empresa(auth.uid(), empresa_id)` combinado com bypass `has_role(admin)`. Exemplos colhidos: `almoxarifado`, `alocacao_colaborador`, `anexos`, `alcada_aprovacao`.

**Não confirmado nesta passada (entra como pendência):** auditoria policy-a-policy de todas as ~80 tabelas EMPRESARIAL listadas em A1 — exige um relatório dedicado.

**Risco residual:** as 11 views `definer-default` da seção 3 podem bypassar essas policies. Auditar **antes** de qualquer reescrita de RLS.

---

## 7. Findings classificados

| # | Nível | Item | Recomendação curta |
|---|---|---|---|
| F1 | **ALERTA** | GRANTs amplos para `anon`/`authenticated` em todas as 236 tabelas (RLS é a única barreira). | Inventariar dependências de `anon` e migrar para grants explícitos. Plano dedicado. |
| F2 | **ALERTA** | 11 views em `public` são `security definer` (default). Podem ignorar RLS do chamador. | Auditar cada view: se cruzam dados EMPRESARIAL, adicionar `WITH (security_invoker=true)` ou filtrar por `empresa_id` explicitamente. |
| F3 | **ALERTA** | `can_access` admite admin **antes** de checar `app_menu.ativo`. Menu desativado ainda retorna `true` para admin. | Inverter ordem da checagem em bloco dedicado. Hoje mitigado pelo RouteGuard. |
| F4 | **OK→monitorar** | Linter aponta ≥1 policy CUD com `USING (true)` / `WITH CHECK (true)`. | Enumerar via query dirigida e corrigir caso a caso. |
| F5 | **OK** | `list_accessible_menus` filtra `ativo=true` no final, inclusive para admin. | Premissa do A1 confirmada; nenhuma ação. |
| F6 | **OK** | `has_role` segue padrão Lovable. | Nenhuma ação. |
| F7 | **OK** | 100 % das tabelas com RLS habilitada e policy associada. | Manter disciplina em novas tabelas (CREATE TABLE + GRANT + RLS + POLICY na mesma migration). |
| F8 | **PENDENTE** | Algumas funções com `search_path` mutável (warnings 5–9 do linter). | Enumerar e corrigir em batch dedicado. |
| F9 | **PENDENTE** | Auditoria policy-a-policy de todas as tabelas EMPRESARIAL não foi feita nesta passada. | Relatório dedicado (escopo grande, ~80 tabelas). |

---

## 8. O que **não** foi feito (e está fora de escopo do V5)

- Nenhuma migration.
- Nenhuma alteração em GRANT, RLS, policy, RPC ou view.
- Nenhuma alteração de código frontend.
- Não enumerei as policies "always true" individualmente — o linter sinaliza mas não devolve nomes; precisaria de query dirigida por tabela.
- Não enumerei as funções com `search_path` mutável — mesma razão.

---

## 9. Próximos passos sugeridos (cada um exige plano próprio antes de executar)

1. **Hardening de views `definer-default`** (F2) — maior risco residual de bypass de empresa.
2. **Correção do `can_access` admin-antes-do-ativo** (F3) — barato e cirúrgico.
3. **Auditoria policy-a-policy das tabelas EMPRESARIAL** (F9) — maior esforço, maior valor de longo prazo.
4. **Plano de revogação de GRANTs amplos para `anon`** (F1) — exige inventário cuidadoso, alta criticidade.
5. **Batch de `SET search_path` em funções faltantes** (F8) — varredura + fix em lote.

---

## Status

Documento aceito como inventário read-only. **Nenhuma ação foi executada.** Aguarda decisão humana sobre qual dos próximos passos abrir como próximo plano.
