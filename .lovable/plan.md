
# K/O-1B REV. C.1 — Execução autorizada (WAIVER A-1, MODO-A)

Estou em plan mode. Esta é a janela de execução proposta. Após aprovação ("Implement plan"), passo a build mode e executo **na ordem abaixo**, parando imediatamente em qualquer falha.

## Escopo
- Substituir exclusivamente as 3 policies legadas em `storage.objects` para `bucket_id='pre-titulos-fiscal'` pelas 3 novas: `pretit_fiscal_select`, `pretit_fiscal_insert`, `pretit_fiscal_delete`.
- Nada mais é tocado.

## Ordem de execução

### 1. Pré-flight PF-B1..PF-B11 (read-only via `supabase--read_query`)
Imediatamente antes da migration:
- PF-B1: bucket `pre-titulos-fiscal` existe e `public=false`.
- PF-B2: exatamente 3 policies legadas no bucket em `pg_policies` (schema `storage`, table `objects`, qualificadas por `bucket_id='pre-titulos-fiscal'`).
- PF-B3: nenhuma policy `pretit_fiscal_*` pré-existente.
- PF-B4: `public.user_pode_atuar_empresa(uuid,uuid)` com assinatura confirmada em `pg_proc`.
- PF-B5: colunas `pre_titulo_pagar.id`, `pre_titulo_pagar.empresa_id` presentes.
- PF-B6: colunas `pre_titulo_anexo.pre_titulo_id`, `pre_titulo_anexo.storage_path` presentes.
- PF-B7: amostra de paths em `storage.objects` (bucket pre-titulos-fiscal) começa com UUID v4.
- PF-B8: baseline `B0 = count(*) storage.objects WHERE bucket_id='pre-titulos-fiscal'`.
- PF-B9: K/O-1A preservado — 8 policies em `pre_titulo_anexo`/`pre_titulo_rateio`, 4 abertas removidas, contagens 25/41.
- PF-B10: `app_role` enum contém `admin`, `financeiro`, `controladoria`, `diretor_adm`, `gestor_cc`.
- PF-B11: `public.has_role(uuid, app_role)` existe e é `STABLE SECURITY DEFINER`.

**Se qualquer PF falhar → não aplico a migration. Retorno `BLOQUEADO_POR_PRE_FLIGHT` com o item que falhou.**

### 2. Aplicar migration REV. C (via `supabase--migration`)
Conteúdo exato (sem `IF EXISTS` nos DROP, sem `USING true`, sem `WITH CHECK true`, sem UPDATE):

```sql
DROP POLICY "<legacy_select_name>" ON storage.objects;
DROP POLICY "<legacy_insert_name>" ON storage.objects;
DROP POLICY "<legacy_delete_name>" ON storage.objects;

CREATE POLICY pretit_fiscal_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pre-titulos-fiscal'
  AND EXISTS (
    SELECT 1
    FROM public.pre_titulo_anexo a
    JOIN public.pre_titulo_pagar p ON p.id = a.pre_titulo_id
    WHERE a.storage_path = storage.objects.name
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND (
            public.has_role(auth.uid(), 'financeiro'::public.app_role)
            OR public.has_role(auth.uid(), 'controladoria'::public.app_role)
            OR public.has_role(auth.uid(), 'diretor_adm'::public.app_role)
            OR public.has_role(auth.uid(), 'gestor_cc'::public.app_role)
          )
        )
      )
  )
);

CREATE POLICY pretit_fiscal_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pre-titulos-fiscal'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND (
            public.has_role(auth.uid(), 'financeiro'::public.app_role)
            OR public.has_role(auth.uid(), 'controladoria'::public.app_role)
            OR public.has_role(auth.uid(), 'diretor_adm'::public.app_role)
            OR public.has_role(auth.uid(), 'gestor_cc'::public.app_role)
          )
        )
      )
  )
);

CREATE POLICY pretit_fiscal_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pre-titulos-fiscal'
  AND EXISTS (
    SELECT 1
    FROM public.pre_titulo_anexo a
    JOIN public.pre_titulo_pagar p ON p.id = a.pre_titulo_id
    WHERE a.storage_path = storage.objects.name
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND public.has_role(auth.uid(), 'financeiro'::public.app_role)
        )
      )
  )
);
```

Os nomes legados `<legacy_*>` serão obtidos em PF-B2 e substituídos literalmente antes do envio. **Nenhum** GRANT, trigger, função, type, bucket ou tabela `public.*` é alterado.

### 3. Pós-aplicação — releitura (`supabase--read_query`)
- `pg_policies` em `storage.objects` filtradas para bucket `pre-titulos-fiscal`: confirmar exatamente 3 policies `pretit_fiscal_select`, `pretit_fiscal_insert`, `pretit_fiscal_delete`; nenhuma `pretit_fiscal_update`; legadas removidas.
- `count(*) storage.objects WHERE bucket_id='pre-titulos-fiscal'` igual a `B0`.
- Releitura K/O-1A: 8 policies em anexo/rateio mantidas, contagens 25/41.

**Se qualquer item divergir → executar rollback fail-closed (passo 5) imediatamente.**

### 4. Testes funcionais T-1B (MODO-A)
- Negação (sem criar objeto): T-1B-1..T-1B-6, T-1B-8, T-1B-11 conforme REV. C.1 §2.3.
- Funcionais via `PreTitulosTab` real: T-1B-7 (upload financeiro/controladoria/gestor_cc/diretor_adm em P_A, negação cross-empresa e sem-role), T-1B-9 (DELETE negado para gestor_cc/controladoria/diretor_adm), T-1B-10 (DELETE permitido para financeiro autor e admin).
- Limpeza pelo fluxo real (delete pelo financeiro autor) ao fim de cada teste que criou objeto.
- T-1B-12: confirmar `count storage.objects == B0` e `count pre_titulo_anexo == N0_anexo (=25)`.

**Se MODO-A indisponível no ambiente:** marco `teste_funcional_nao_executado_falta_ambiente_seguro`, executo apenas os testes de negação, K/O-1B não fica funcionalmente homologado (apenas estrutural).

### 5. Rollback fail-closed (pronto, executado apenas se algum passo 3/4 falhar de forma crítica)
```sql
DROP POLICY IF EXISTS pretit_fiscal_select ON storage.objects;
DROP POLICY IF EXISTS pretit_fiscal_insert ON storage.objects;
DROP POLICY IF EXISTS pretit_fiscal_delete ON storage.objects;
```
Nunca recriar as policies legadas. Nunca usar `USING true` / `WITH CHECK true`. Bucket fica sem policy liberatória (fail-closed).

## Garantias (não-permitidos respeitados)
- Frontend: não tocado.
- Edge Functions: não tocadas.
- Types (`src/integrations/supabase/types.ts`): não tocado.
- Tabelas `pre_titulo_pagar`, `pre_titulo_anexo`, `pre_titulo_rateio`: não tocadas.
- Grants, triggers, outros buckets, estrutura de path: não tocados.
- Sem build amplo: apenas a migration de storage policies.

## Retorno obrigatório (entregado após execução)
1. Resultado PF-B1..PF-B11 (tabela).
2. Nome do arquivo de migration aplicado.
3. Diff/conteúdo SQL aplicado (igual ao bloco acima, com nomes legados resolvidos).
4. Confirmação: apenas 3 policies legadas substituídas no bucket.
5. Confirmação: UPDATE bloqueado (nenhuma policy `pretit_fiscal_update`).
6. Resultado de cada teste T-1B-1..T-1B-12.
7. `count storage.objects` antes/depois.
8. `count pre_titulo_anexo` antes/depois (quando MODO-A executado).
9. Confirmação: nenhum objeto órfão (`count == B0` ao final, ou flag de não-homologação).
10. Confirmação: rollback fail-closed disponível e não executado (ou executado, com motivo).
11. Confirmação: nada fora do escopo alterado.

Aguardando aprovação do plano para entrar em build mode e executar.
