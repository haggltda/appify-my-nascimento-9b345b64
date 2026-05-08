## Módulo: Gerenciador de Tarefas / Plano de Ações Nascimento

Plano técnico para aprovação **antes** da implementação. Após o "ok", crio migrations, frontend e carrego as 123 ações.

### 1. Verificações já feitas

- `profiles` (id, empresa_id, display_name, email, ativo) ✅
- `empresas`, `user_roles`, `centros_custo`, `contrato` ✅
- Funções `has_role(user, role)` e `get_user_empresa(user)` ✅
- **Erica, Yuri e Helena localizados sem ambiguidade**, todos na empresa HAGG (`5a61c769-…bce8`):
  - Érica Souza Ávila — `ab761a12-…16e2`
  - Yuri Rosa — `3baeb855-…b288e`
  - Helena Nascimento — `60e5bb0a-…1ea7`
- Bucket privado `anexos` será reutilizado.

### 2. Frontend — arquivos a criar

```
src/pages/plano-acoes/
  Dashboard.tsx          (/app/plano-acoes/dashboard)
  Lista.tsx              (/app/plano-acoes)
  Kanban.tsx             (/app/plano-acoes/kanban)
  Detalhe.tsx            (/app/plano-acoes/:id  e  /nova)
  Importar.tsx           (/app/plano-acoes/importar)
  Aprovacoes.tsx         (/app/plano-acoes/aprovacoes)
  Configuracoes.tsx      (/app/plano-acoes/configuracoes)
  components/
    AcaoForm.tsx
    AcaoStatusBadge.tsx
    AcaoFiltros.tsx
    AcaoComentarios.tsx
    AcaoAnexos.tsx
    AcaoHistorico.tsx
    KanbanColuna.tsx
    PendenciaChip.tsx
  hooks/
    usePlanoAcoes.ts
    usePlanoAcaoPermissao.ts
```

Edição:
- `src/App.tsx` — registro das 7 rotas dentro do shell autenticado.
- `src/components/layout/Sidebar.tsx` — novo grupo "Plano de Ações" (renderizado só se `pode_visualizar` ou admin).

### 3. Banco — novas tabelas

Todas com `empresa_id`, `created_at`, `updated_at`, RLS habilitada:

| Tabela | Função |
|---|---|
| `plano_acao` | ação principal (todos os campos do prompt §4.1, incluindo originais preservados, `pendencias_iniciais text[]`, `hash_origem`, `metadata_origem jsonb`, `deleted_at`) |
| `plano_acao_comentario` | comentários por ação |
| `plano_acao_anexo` | metadados dos arquivos no bucket `anexos` |
| `plano_acao_historico` | auditoria por evento/campo |
| `plano_acao_import_batch` | cabeçalho de importação |
| `plano_acao_import_item` | linhas com `payload_original jsonb` e pendências |
| `plano_acao_usuario_permissao` | ACL específica do módulo (8 flags booleanas) |

Idempotência:
- `UNIQUE (empresa_id, id_importacao)` em `plano_acao` → upsert por chave natural.
- `UNIQUE (empresa_id, profile_id)` em `plano_acao_usuario_permissao`.

### 4. Segurança / RLS

Função `SECURITY DEFINER`:

```sql
plano_acao_can_access(p_user uuid, p_empresa uuid, p_perm text) RETURNS boolean
```

Lógica:
1. Admin global (`has_role(p_user,'admin')`) → true.
2. Mesma empresa (`get_user_empresa(p_user) = p_empresa`).
3. Lê a flag correspondente de `plano_acao_usuario_permissao`.

Policies (todas as tabelas):
- SELECT → `pode_visualizar`
- INSERT → `pode_criar`
- UPDATE → `pode_editar`
- DELETE físico → bloqueado (apenas `deleted_at` via UPDATE com `pode_excluir`)
- Importação → `pode_importar`
- Aprovação → `pode_aprovar`
- Configuração/ACL → `pode_administrar`

Tabelas filhas (`comentario`, `anexo`, `historico`, `import_*`) herdam a mesma checagem via `plano_acao` ou `empresa_id`.

### 5. Storage

- Bucket privado existente `anexos`
- Prefixo `plano-acoes/{empresa_id}/{plano_acao_id}/`
- Policies validando `empresa_id` no path

### 6. Carga inicial das 123 ações

Não vou hardcodar 123 inserts no SQL. Estratégia:

1. Migration cria todas as tabelas/policies/funções e **uma RPC** `plano_acao_seed_inicial(_empresa uuid, _payload jsonb)`.
2. Após approve, faço **uma única chamada** à RPC com o JSON completo (extraído do prompt — 123 itens).
3. A RPC:
   - Cria batch em `plano_acao_import_batch`.
   - Itera o array, faz `INSERT ... ON CONFLICT (empresa_id, id_importacao) DO UPDATE` em `plano_acao`.
   - Insere `plano_acao_import_item` com `payload_original`.
   - Resolve responsável/líderes por `display_name` em `profiles` (best-effort, fica null + pendência se ambíguo).
   - Status original `Concluido` → `concluida_pendente_evidencia` (pendência `PENDENTE_EVIDENCIA_CONCLUSAO_LEGADA`).
   - Retorna JSON: `{recebidas, processadas, inseridas, atualizadas, pendentes}`.
4. Empresa alvo: HAGG (`5a61c769-…bce8`).

### 7. ACL inicial dos 3 usuários

Insert direto (data, não migration) em `plano_acao_usuario_permissao` para Erica, Yuri e Helena, todas as 8 flags = `true`. Ambiguidade: nenhuma — já localizados.

### 8. Regras de negócio aplicadas

- Concluir ação → move para `aguardando_validacao`; só `pode_aprovar` valida.
- `concluida_validada` exige ≥1 anexo (constraint via trigger).
- `custo_realizado > 0` exige `centro_custo_id` ou `contrato_id` para validar.
- Toda alteração relevante grava em `plano_acao_historico` (trigger).
- Reimportação não duplica (upsert por `id_importacao`).

### 9. Testes manuais pós-implementação

1. Login como Erica/Yuri/Helena → vê o menu, todas as rotas funcionam.
2. Login como outro usuário HAGG → menu oculto, rotas retornam 403.
3. Login de outra empresa → não lê nenhuma ação.
4. Carga inicial: 123 ações, dashboard bate (em_andamento 47, a_definir 43, concluida_pendente_evidencia 30, atrasada 2, nao_iniciada 1).
5. Reexecução do seed → 0 inseridas, 123 atualizadas.
6. Tentar `concluida_validada` sem anexo → bloqueado.
7. Alterar status/responsável → registro em `plano_acao_historico`.
8. Exclusão lógica → linha some das listas mas histórico permanece.
9. Anexo só acessível com permissão.

### 10. Rollback

- Migration reversa (drop tabelas, função, policies) enquanto não houver dado.
- Após carga: desativar menu+rotas e usar `deleted_at`. Anexos e histórico preservados.
- **Sem impacto em financeiro/contábil/fiscal/BI/migração.**

### 11. Riscos identificados

| Risco | Mitigação |
|---|---|
| Datas ambíguas no CSV | Preservadas como texto em `_original`; `date` fica null + pendência |
| Match de responsável por nome | Best-effort; fica null + `PENDENTE_RESPONSAVEL_ORIGEM` se não bater |
| Volume de policies | 7 tabelas × ~5 policies — ok, padronizadas via função única |
| Bucket `anexos` policy existente pode ser permissiva | Adiciono policy específica para o prefixo `plano-acoes/` |
| ACL hardcoded | Evitada — fica em `plano_acao_usuario_permissao`, editável na tela Configurações |

### 12. Itens **fora** desta entrega (conforme prompt)

- Sem lançamentos contábeis, títulos, DRE, fluxo de caixa.
- Sem alteração em módulos financeiro/contábil/fiscal/BI/migração zero.
- Sem refactor fora do escopo.

---

**Aguardando seu OK explícito para implementar.** Após aprovação executo nesta ordem:
1. Migration (tabelas + RLS + função `can_access` + RPC `seed_inicial`).
2. Frontend (rotas, telas, hooks, sidebar).
3. Chamada da RPC com o JSON dos 123 itens + insert ACL dos 3 usuários.
4. Reconciliação final reportando totais.
