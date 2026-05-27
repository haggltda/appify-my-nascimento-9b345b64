# B1.5 v3.1 — PLAN MODE FINAL (pré-migration)

Ajuste único sobre o v3 aprovado: **DELETE restrito a admin + controladoria**. Demais políticas inalteradas. Nada executado.

## 1. SQL proposto (texto, não aplicado)

```sql
-- Pré-condição: as 4 policies "perm *" abertas e as "auth *" abertas
-- em public.fornecedor_conta_bancaria serão substituídas.

-- Limpeza
DROP POLICY IF EXISTS "perm select fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm insert fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm update fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm delete fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth select fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth insert fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth update fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth delete fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;

ALTER TABLE public.fornecedor_conta_bancaria ENABLE ROW LEVEL SECURITY;

-- SELECT: admin OU (permissão + empresa do usuário == empresa_id da conta)
CREATE POLICY fcb_select
ON public.fornecedor_conta_bancaria
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_permissao('suprimentos','visualizar','fornecedor.conta_bancaria')
    AND empresa_id = public.empresa_do_usuario(auth.uid())
  )
);

-- INSERT: admin OU (permissão incluir + empresa do usuário == empresa_id
-- + fornecedor global OU pertencente à mesma empresa)
CREATE POLICY fcb_insert
ON public.fornecedor_conta_bancaria
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_permissao('suprimentos','incluir','fornecedor.conta_bancaria')
    AND empresa_id = public.empresa_do_usuario(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fornecedor f
      WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
        AND (f.is_global = true OR f.empresa_id = fornecedor_conta_bancaria.empresa_id)
    )
  )
);

-- UPDATE: USING (linha atual da empresa) + WITH CHECK (linha nova continua na empresa
-- e fornecedor ainda válido)
CREATE POLICY fcb_update
ON public.fornecedor_conta_bancaria
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_permissao('suprimentos','alterar','fornecedor.conta_bancaria')
    AND empresa_id = public.empresa_do_usuario(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_permissao('suprimentos','alterar','fornecedor.conta_bancaria')
    AND empresa_id = public.empresa_do_usuario(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fornecedor f
      WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
        AND (f.is_global = true OR f.empresa_id = fornecedor_conta_bancaria.empresa_id)
    )
  )
);

-- DELETE: AJUSTE v3.1 — apenas admin OU controladoria, e ainda assim
-- só na empresa da conta. Permissão excluir deixa de bastar.
CREATE POLICY fcb_delete
ON public.fornecedor_conta_bancaria
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'controladoria')
    AND empresa_id = public.empresa_do_usuario(auth.uid())
  )
);
```

Observação: `empresa_do_usuario(uuid)` e `has_permissao(text,text,text)` já existem (confirmadas no B0/B1). Se `empresa_do_usuario` não estiver marcada SECURITY DEFINER stable, a migration falhará — a verificação será feita antes de gerar o arquivo.

## 2. Impacto

- **Financeiro / suprimentos com permissão `fornecedor.conta_bancaria`:** vê/edita só contas da própria empresa.
- **Sem permissão:** sem acesso.
- **Admin:** total.
- **Controladoria:** SELECT/INSERT/UPDATE se tiver permissão; DELETE permitido pelo papel + escopo de empresa.
- **DELETE por outros perfis (financeiro, comprador, etc.):** **bloqueado**, mesmo com permissão `excluir`. Mudança em relação ao v3.
- **Fornecedor global:** continua selecionável em qualquer empresa (PreTitulos, NF, etc. intocados).
- **PreTitulos, NF, Contas a Pagar, Programação, Malotes/CNAB, Conciliação, Receber:** sem efeito (não usam a tabela).
- **`ContasBancariasGenericTab` / `ContaBancariaDialog`:** o botão "Excluir" continua visível para quem tem permissão, mas a operação falhará com erro RLS para perfis fora de admin/controladoria. Isso é aceitável agora; ajuste de UI fica para bloco posterior.

## 3. Checklist de testes (T1–T13, pós-migration, janela controlada)

Usuário-piloto: **Renan Bahr** (`financeiro2@haggltda.com.br`).

| # | Cenário | Esperado |
|---|---------|----------|
| T1 | Renan SELECT conta da empresa dele | OK |
| T2 | Renan SELECT conta de outra empresa | 0 linhas |
| T3 | Renan INSERT conta na empresa dele, fornecedor global | OK se tiver permissão `incluir` |
| T4 | Renan INSERT conta apontando outra empresa | bloqueado |
| T5 | Renan INSERT em fornecedor local de outra empresa | bloqueado |
| T6 | Renan UPDATE conta da empresa dele | OK |
| T7 | Renan UPDATE tentando trocar `empresa_id` | bloqueado pelo WITH CHECK |
| T8 | Renan UPDATE conta de outra empresa | 0 linhas afetadas |
| T9 | Renan DELETE conta da empresa dele | **bloqueado** (não é admin/controladoria) — mudança v3.1 |
| T10 | Usuário controladoria DELETE conta da empresa dele | OK |
| T11 | Usuário controladoria DELETE conta de outra empresa | bloqueado |
| T12 | Admin DELETE qualquer conta | OK |
| T13 | Usuário sem permissão `fornecedor.conta_bancaria` SELECT | 0 linhas |

Decisão prévia: testes rodam **após** a migration, em janela controlada. Antes de gerar a migration eu vou montar (somente leitura) uma consulta que confirma o uid do Renan, a empresa dele, e quais policies/perms ele possui hoje, para servir de baseline.

## 4. Rollback

- **Seguro:** `DROP POLICY` das 3 de escrita (`fcb_insert`, `fcb_update`, `fcb_delete`). `fcb_select` permanece. Escrita fica travada para todos exceto admin (sem policy = bloqueado).
- **Emergencial controlado:** recriar `fcb_insert`/`fcb_update` originais do v3 (sem o `EXISTS`), mas **nunca** recriar `perm *` ou `auth *` abertas. Reservado a admin via SQL Editor.
- **Proibido:** reabrir SELECT global.

## 5. Fora deste bloco

- `forn_insert` / `forn_delete` em `public.fornecedor` → **B1.6** (PLAN separado, depois).
- Banner UI em `ContasBancariasGenericTab` informando escopo de empresa → bloco UI futuro.
- Ocultar botão "Excluir" para perfis fora de admin/controladoria → bloco UI futuro.
- Consolidação dos dois diálogos legados de conta bancária → backlog.
- Formalizar `cb.is_global` → fora.
- RouteGuard, Sidebar, app_menu, Triagem, centros_custo, pre_titulo_promover, DRE/Fluxo, conferências, orçamento/faturamento → fora.

## 6. Próximos passos (aguardando aprovação humana)

1. Você aprova este v3.1.
2. Eu gero o arquivo `*_b15v31_fcb_escopo_empresa.sql` com o SQL acima exatamente.
3. **Paro de novo** antes de aplicar — você decide a janela.
4. Aplicada a migration, rodo T1–T13 read-only com o uid do Renan e reporto.
5. Em seguida abro PLAN do B1.6.

**Nada foi executado. Nada foi alterado no banco, no Storage ou no frontend.**
