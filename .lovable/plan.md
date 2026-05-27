# Fase 0 — Diagnóstico (read-only)

Antes de tocar em qualquer SQL ou código, vou rodar um diagnóstico completo e **somente leitura** do estado atual de permissões, RLS e governança. Nada é alterado nesta fase.

## O que vou fazer

### 1. Inventário do banco (via supabase--read_query)
- Listar todas as tabelas do schema `public` e identificar quais **NÃO** têm RLS habilitada.
- Listar enums relevantes: `app_role`, `app_modulo`, `app_acao`, `app_menu_codigo`.
- Conferir tabelas-chave de governança: `user_roles`, `role_permissions`, `screen_permission_profile`, `screen_permission_user`, `perfil_metadata`, `app_menu`, `app_alcadas_*`.
- Contar registros (quantos perfis, quantas regras por perfil, quantos overrides por usuário, quantos usuários ativos).
- Listar todas as funções `SECURITY DEFINER` existentes: `has_role`, `has_screen_access`, `list_accessible_menus` etc., e ver seu corpo.

### 2. Auditoria de RLS
- Rodar `supabase--linter` para capturar:
  - Tabelas sem RLS
  - Policies permissivas demais (`USING (true)`)
  - Funções sem `search_path`
- Foco especial em `fornecedor_conta_bancaria` (piloto previsto na Fase 1).

### 3. Auditoria de código (frontend)
- Mapear todos os pontos que leem permissão: `PermissoesContext`, `useScreenAccess`, `useAccessibleMenus`, `ScreenGate`, `RoleGate`, `RouteGuard`.
- Identificar telas que **ainda usam role hardcoded** em vez de `has_screen_access`.
- Listar Edge Functions sensíveis (`admin-create-user`, `admin-reset-password`, `admin-revoke-session`) e validar se já checam role admin internamente.

### 4. Relatório consolidado
Vou gravar o diagnóstico em `.lovable/A1-fase0-diagnostico.md` com:
- Tabelas sem RLS (lista completa)
- Funções definer existentes vs. faltantes
- Gap entre perfis cadastrados em `perfil_metadata` e roles do enum `app_role`
- Linhas em `screen_permission_user` (overrides) — quantas, por usuário
- Pontos de código que fazem bypass de permissão
- Riscos identificados (com severidade: crítico / alto / médio)
- **Estimativa refinada de créditos para Fase 1 e Fase 2** com base nos números reais

## O que NÃO vou fazer nesta fase
- Nenhum `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`.
- Nenhuma alteração de código frontend ou Edge Function.
- Nenhuma migração.

## Entregável
Um único arquivo `.lovable/A1-fase0-diagnostico.md` + resposta no chat com:
1. Resumo executivo (3–5 bullets)
2. Tabela de riscos
3. Estimativa de créditos refinada para Fase 1
4. Pergunta de gate: **"Aprovar Fase 1 (SQL + RLS piloto)?"**

## Para leigo
É como um raio-X antes da cirurgia: eu olho o estado do sistema (quem tem acesso a quê, onde estão as portas destrancadas, quais regras já existem) e devolvo um relatório. Só depois do seu OK eu mexo em qualquer coisa.

Aprova rodar a Fase 0?
