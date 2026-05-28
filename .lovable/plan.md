# Plano — Desativação dos menus IA (Fase 1) + Bloco V5

## Parte 1 — Migration: desativar `triagem` e `copiloto_ia` em `app_menu`

### Estado atual (apurado read-only)
- `app_menu.codigo='triagem'` → `/app/triagem`, `ativo=true`
- `app_menu.codigo='copiloto_ia'` → `/app/plano-acoes/copiloto`, `ativo=true`
- `screen_permission_profile`: 8 linhas para `triagem`, 8 para `copiloto_ia` (perfis × ações)
- `screen_permission_user`: **0** linhas (nenhum override individual)
- `RouteGuard` já bloqueia ambas as rotas pela flag soberana `triagemIA` (default `false`) — Bloco V3 + V4

### Objetivo
Remover os dois itens da barra lateral e de qualquer listagem governada por `app_menu.ativo=true`, sem destruir histórico de permissões nem o registro do menu (auditoria e reversão simples).

### Estratégia — **soft deactivation reversível**
```text
1) UPDATE public.app_menu
     SET ativo = false, updated_at = now()
   WHERE codigo IN ('triagem','copiloto_ia');

2) (Sem DELETE) Linhas em screen_permission_profile e screen_permission_user
   permanecem como estão — servem como histórico. Como o menu fica ativo=false,
   list_accessible_menus / useAccessibleMenus já não retornam o código, e o
   RouteGuard continua barrando pela flag soberana mesmo se algo tentar burlar.
```

### Por que não DELETE
- Preserva histórico de quem tinha acesso (auditoria/compliance).
- Reversão = `UPDATE ... SET ativo = true` (1 linha SQL), sem reconstruir permissões.
- Evita efeito colateral em FKs ou em RPCs que ainda referenciem os códigos.

### Por que não remover do `App.tsx` agora
Fora de escopo. As rotas continuam registradas, mas:
- Sidebar não exibe (menu inativo).
- `RouteGuard` nega por flag soberana mesmo para admin.
- Acesso direto pela URL → tela "Acesso negado" com log em `access_audit_log` (`route_guard_phase_flag_off:triagemIA`).

### Riscos e mitigações (modo guardião)
| Risco | Mitigação |
|---|---|
| Algum cache em cliente ainda mostra o item por minutos | `useAccessibleMenus` re-busca em foco/intervalo; aceitável. Comunicar timing. |
| RPC `list_accessible_menus` filtra por `ativo=true`? | **Confirmar no Bloco V5** (introspecção). Hoje a assunção é sim; se não for, reabro o plano. |
| Reativação acidental via SPU | SPU referencia `menu_codigo`, mas `useAccessibleMenus` cruza com `app_menu.ativo`. Mesmo com SPU `allow=true`, menu inativo não retorna. **Validar no V5.** |
| Algum link estático na UI aponta para `/app/triagem` ou `/app/plano-acoes/copiloto` | Não removido neste passo. RouteGuard nega. Item separado para varredura futura. |

### Smoke pós-migration (manual, 2 min)
1. Recarregar `/app` como admin → sidebar não mostra "Triagem" nem "Copiloto IA".
2. Acessar `/app/triagem` direto → "Acesso negado" + linha em `access_audit_log` com motivo `route_guard_phase_flag_off:triagemIA`.
3. Acessar `/app/plano-acoes/copiloto` direto → idem.
4. Verificar que demais menus do módulo `licitacoes` e `plano_acoes` continuam acessíveis.

### Rollback
```sql
UPDATE public.app_menu SET ativo = true, updated_at = now()
WHERE codigo IN ('triagem','copiloto_ia');
```
(Permissões em SPP/SPU permanecem intactas, então o acesso é restaurado idêntico.)

---

## Parte 2 — Bloco V5: introspecção read-only de governança

### Objetivo
Produzir um único documento `.lovable/A2-introspeccao-governanca.md` com a **fotografia atual** das regras de acesso aplicadas pelo banco, sem alterar nada. Insumo obrigatório antes de qualquer hardening de RLS/RPC.

### Escopo (estritamente read-only)
1. **`pg_policies`** — listar todas as policies do schema `public`, agrupadas por tabela: nome, comando, roles, `qual`, `with_check`. Marcar tabelas sem policy + sem RLS habilitada como **risco**.
2. **RPCs de governança** — código completo de:
   - `public.has_role`
   - `public.can_access`
   - `public.list_accessible_menus`
   - Quaisquer funções `SECURITY DEFINER` em `public` (listar e marcar `search_path`, owner, `volatile/stable`).
3. **Cruzamento com A1** — para cada tabela `EMPRESARIAL` da matriz V4, conferir se há policy que filtre por `empresa_id`. Listar lacunas.
4. **Tabelas-pivô de permissão** (`screen_permission_profile`, `screen_permission_user`, `user_roles`, `app_menu`, `app_modulo`) — schema + grants + policies. Confirmar premissa "menu inativo nunca aparece".
5. **GRANTs no schema public** — listar quais tabelas concedem o quê para `anon` / `authenticated` / `service_role`. Sinalizar `anon` em tabelas sensíveis.
6. **Findings** — lista classificada (BLOQUEANTE / ALERTA / OK) com recomendação curta. **Nenhuma alteração proposta como execução** — apenas registro.

### O que **não** entra no V5
- Nenhuma migration.
- Nenhuma alteração de policy, GRANT, RPC ou código frontend.
- Nenhuma decisão de reescrita — apenas inventário e gaps.

### Entregável
Arquivo `.lovable/A2-introspeccao-governanca.md`, formato compatível com A1, pronto para virar input do próximo bloco de hardening (a ser planejado depois com sua aprovação).

### Ferramentas
- `supabase--read_query` para introspeção (`pg_policies`, `pg_proc`, `information_schema.role_table_grants`, etc.).
- `code--view` em `useAccessibleMenus`, `RouteGuard`, `PermissoesContext` para confirmar como o frontend consome cada RPC.

---

## Ordem de execução proposta

1. **Aguardo seu OK** neste plano (tanto da migration quanto do escopo V5).
2. Disparar a migration (ferramenta de migration pedirá sua aprovação explícita antes de rodar).
3. Após confirmação de que a migration rodou, executar smoke (1 min).
4. Em seguida, executar V5 (read-only, sem nova aprovação necessária por ser inventário).
5. Entregar A2 e parar — qualquer ação derivada exige novo plano.

**Nada será executado sem sua autorização explícita.**