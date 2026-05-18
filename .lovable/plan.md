## Diagnóstico

O enum `app_role` já contém `'usuario'` (migração anterior). Porém as telas de Administração (Perfis, Permissões por perfil, Alçadas, contadores) **não listam** o novo perfil porque todas leem da tabela `public.perfil_metadata` — e essa tabela **não tem** registro para `'usuario'`.

Estado atual no banco:
- `perfil_metadata`: 16 perfis cadastrados, incluindo `visitante` (cinza, "Acesso somente leitura"). **Sem linha para `usuario`.**
- `role_permissions`: `usuario` tem apenas 1 permissão; `visitante` também tem 1 (a cópia anterior copiou pouca coisa porque visitante já tinha pouco).
- `user_roles`: 2 usuários em `usuario`, 2 ainda em `visitante`.

Impacto hoje:
1. Aba **Perfis de acesso** → não mostra card de "Usuário".
2. Aba **Permissões por perfil** → seletor não oferece `usuario`, impossibilitando configurar acessos.
3. Aba **Alçadas** → idem (deriva de `perfil_metadata`).
4. Aba **Usuários** → o select de role já oferece "usuario" (corrigido), mas o badge de contagem por perfil em outras telas ignora `usuario`.
5. `visitante` continua visível e selecionável, gerando confusão (dois perfis equivalentes).

## Objetivo

Tornar `usuario` um perfil de primeira classe (visível, editável, configurável em permissões e alçadas) e aposentar `visitante` da UI sem quebrar quem ainda está nele.

## Mudanças

### 1. Banco (migração — dados, via INSERT/UPDATE em `perfil_metadata`)
- **Inserir** linha em `perfil_metadata` para `role = 'usuario'`:
  - descrição: "Usuário padrão do sistema (acesso liberado por permissão)"
  - cor: `#3b6fa0` (azul neutro) — ajustável depois pelo admin
  - ícone: `User`
- **Copiar permissões base** de `visitante` → `usuario` em `role_permissions` (idempotente, `ON CONFLICT DO NOTHING`) — garante que `usuario` parta de uma base mínima de visualização.
- **Migrar usuários** restantes de `visitante` → `usuario` em `user_roles` (idempotente).
- **Marcar `visitante` como depreciado** em `perfil_metadata`: alterar descrição para "(Depreciado — use 'Usuário')" e cor cinza claro. Não remover do enum (mudança destrutiva).

### 2. Frontend — esconder `visitante` da UI
Filtrar `visitante` nas listagens das abas que iteram `perfil_metadata`:
- `src/pages/admin/tabs/PerfisTab.tsx` — não renderiza card de visitante.
- `src/pages/admin/tabs/PermissoesTab.tsx` — remove do seletor.
- `src/pages/admin/tabs/AlcadasTab.tsx` — remove do seletor (se aplicável).

`visitante` continua existindo no enum e no banco (compatibilidade), mas some das telas. Quem ainda estiver com o role antigo já terá sido migrado pelo passo 1.

### 3. Sem mudanças
- `PermissoesContext.tsx`, `Login.tsx`, `UsuariosReal.tsx` já tratam `usuario` (entregue antes).
- Edge functions e RLS não precisam mudar (usam o enum, que já tem `usuario`).

## Ordem de execução
1. Migração SQL (precisa de sua aprovação).
2. Edits de frontend para esconder `visitante`.
3. Verificar nas 3 abas que `Usuário` aparece e é configurável.

## Riscos
- Baixo. A migração é idempotente; o enum permanece intacto; `visitante` continua funcional caso algum código externo referencie.

Aprova para eu executar?