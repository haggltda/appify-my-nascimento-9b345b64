# Plano: Permissões para Contas Bancárias (Fornecedor / Colaborador)

## Diagnóstico

- Sistema de permissões já existe: tabela `role_permissions` (role × módulo × ação × menu_codigo opcional), consumida via `PermissoesContext.can(acao, modulo, menu)` e `<RoleGate>`.
- Ações disponíveis: `visualizar | incluir | alterar | excluir | aprovar | exportar | executar_ia`.
- Hoje **não existe** menu específico para contas bancárias de fornecedores/colaboradores — quem tem permissão em `suprimentos` ou `rh` (menu_codigo NULL = módulo inteiro) acaba podendo tudo.
- Tabelas no banco (`fornecedor_conta_bancaria`, futura `colaborador_conta_bancaria`) hoje têm RLS aberta para qualquer authenticated. Isso precisa ser restringido por função SECURITY DEFINER que consulta `role_permissions`.

## Objetivo

Restringir criar/alterar/excluir contas bancárias de **fornecedores** e **colaboradores** a usuários com permissão dedicada, tanto no frontend (esconder botões) quanto no backend (RLS).

## 1. Novos menu_codigo em `role_permissions`

Cadastrar 2 escopos novos (granulares) usados pelas rotinas:

| módulo | menu_codigo | descrição |
|--------|-------------|-----------|
| suprimentos | fornecedor.conta_bancaria | Contas bancárias do fornecedor |
| rh | colaborador.conta_bancaria | Contas bancárias do colaborador |

Para cada um, semear linhas em `role_permissions` para as ações: `visualizar`, `incluir`, `alterar`, `excluir`. Roles default:

- `admin` — todas as ações (já é bypass implícito no `can`, mas semear por consistência)
- `controladoria` — visualizar
- `diretor_adm` — visualizar, incluir, alterar, excluir (fornecedor)
- Demais roles — sem permissão (precisam ser vinculadas pelo admin)

(O cadastro fica em `supabase--migration` via INSERT seed; o admin pode reajustar pela aba Permissões.)

## 2. Função SECURITY DEFINER para checar permissão no banco

Criar `public.has_permissao(_user_id uuid, _modulo text, _acao text, _menu text)` que retorna boolean:

- Admin (em `user_roles`) → true.
- Caso contrário, JOIN `user_roles` × `role_permissions` matching `modulo=_modulo AND acao=_acao AND (menu_codigo IS NULL OR menu_codigo=_menu) AND modulo='*' OR modulo=_modulo`.

A função roda em SECURITY DEFINER + `SET search_path = public` para uso em RLS sem recursão.

## 3. RLS endurecida nas tabelas de contas

### `fornecedor_conta_bancaria` (já existe — substituir policies)

- SELECT: `has_permissao(auth.uid(), 'suprimentos', 'visualizar', 'fornecedor.conta_bancaria')`
- INSERT: `... 'incluir' ...` (em WITH CHECK)
- UPDATE: `... 'alterar' ...`
- DELETE: `... 'excluir' ...`

### `colaborador_conta_bancaria` (a criar)

Mesmo padrão com módulo `rh` e menu `colaborador.conta_bancaria`.

## 4. Frontend — gates

- `src/pages/suprimentos/fornecedores/ContasBancariasTab.tsx`:
  - Botão "Nova conta" envolvido em `<RoleGate acao="incluir" modulo="suprimentos" menu="fornecedor.conta_bancaria">`
  - Botões Editar/Excluir condicionados a `can("alterar"/"excluir", ...)`.
  - Aba só renderiza se `can("visualizar", ...)`.
- Equivalente na futura aba do colaborador (módulo `rh`, menu `colaborador.conta_bancaria`).

## 5. Tela de administração

A tela `PermissoesTab.tsx` já lê dinamicamente da `role_permissions`, então os novos menus aparecem automaticamente após o seed. Verificar se a UI lista menus do tipo `xxx.yyy` corretamente (se não, ajustar rótulos).

## 6. Auditoria

Toda alteração já passa pelo trigger `updated_at`. Opcional (fora deste plano): inserir registro em `audit_log` via trigger.

## Detalhes técnicos

```sql
-- Função
CREATE OR REPLACE FUNCTION public.has_permissao(_user uuid, _modulo text, _acao text, _menu text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id=_user AND role='admin')
      OR EXISTS (
        SELECT 1
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role = ur.role
         WHERE ur.user_id = _user
           AND rp.acao = _acao
           AND (rp.modulo = '*' OR rp.modulo = _modulo)
           AND (rp.menu_codigo IS NULL OR rp.menu_codigo = _menu)
      );
$$;
```

Replace policies:

```sql
DROP POLICY "auth select fornecedor_conta" ON fornecedor_conta_bancaria;
-- ... idem insert/update/delete
CREATE POLICY "sel" ON fornecedor_conta_bancaria FOR SELECT TO authenticated
  USING (has_permissao(auth.uid(),'suprimentos','visualizar','fornecedor.conta_bancaria'));
-- etc.
```

## Fora de escopo

- Auditoria detalhada de leitura.
- Permissão por empresa específica (apenas por role).
- Reprocessar registros existentes.

## Confirmações antes de executar

1. **Roles default** que devem nascer com acesso a fornecedor.conta_bancaria — confirmar lista (sugeri: admin, diretor_adm, controladoria-só-leitura).
2. **Roles default** para colaborador.conta_bancaria (sugeri: admin, diretor_adm; RH se existir como role separado — hoje não há, podemos criar role `rh`).
3. Os usuários atuais sem essa permissão **perderão acesso** assim que a RLS for atualizada — confirmar OK.
