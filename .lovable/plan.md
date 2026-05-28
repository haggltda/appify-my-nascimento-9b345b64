# Bloco F4 — Hardening RLS CUD/SELECT (migration única)

Aplicar a migration já revisada e aprovada, sem alterar uma vírgula em relação ao script auditado.

## Escopo (3 tabelas)

1. **`public.orcamento_contrato_linha_audit`** — substitui `ocla_insert` (INSERT `WITH CHECK true`) por regra que exige `alterado_por = auth.uid()` E (`admin` OU `user_pode_atuar_empresa(auth.uid(), empresa_id)`).
2. **`public.pre_titulo_anexo`** — remove policies abertas (SELECT e ALL `USING true`) e cria 4 policies granulares (SELECT/INSERT/UPDATE/DELETE) que herdam o escopo de empresa via `EXISTS` em `pre_titulo_pagar`. Papéis:
   - SELECT/UPDATE: `financeiro` | `controladoria` | `diretor_adm`
   - INSERT: idem + `gestor_cc` (e `uploaded_by = auth.uid()`)
   - DELETE: `financeiro` apenas
   - `admin` sempre passa.
3. **`public.pre_titulo_rateio`** — mesmo padrão do anexo (sem trava `uploaded_by`, que não existe na tabela).

## Execução

- 1 chamada de `supabase--migration` contendo os 3 blocos (F4.1 + F4.2 + F4.3) na ordem acima.
- Sem alterações de schema, sem novos GRANTs (tabelas já existentes), sem mudanças no frontend.
- `SECURITY DEFINER` reaproveitado: `public.has_role` e `public.user_pode_atuar_empresa` (já em produção).

## Pós-execução

1. Rodar `supabase--linter` e reportar apenas regressões deste bloco (warnings legados ficam fora).
2. Read-only check em `pg_policies` confirmando:
   - `orcamento_contrato_linha_audit`: 1 policy `ocla_insert` com `with_check` não-trivial.
   - `pre_titulo_anexo`: 4 policies (`pretit_anexo_select/insert/update/delete`), nenhuma com `qual = true`.
   - `pre_titulo_rateio`: 4 policies análogas.
3. Entregar relatório de sucesso com: SQL aplicado, contagem de policies antes/depois, riscos residuais (R1 do trigger de auditoria assumido pelo arquiteto), e link do SQL Editor para inspeção.

## Rollback (pronto, não executado)

Já documentado no relatório anterior — 3 blocos `DROP POLICY` + `CREATE POLICY ... USING(true)` restaurando o estado original. Acionado apenas sob ordem expressa.

## Trava

Nada além das 3 tabelas listadas será tocado. Sem mudanças em código TS/TSX. Sem alterações no `app_menu`, RPCs ou views.
