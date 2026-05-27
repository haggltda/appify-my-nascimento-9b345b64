# B2.1 — Gating fino dos botões Fase 1–7

## Diagnóstico (read-only, já feito)

**Infra existente e suficiente:**
- `usePermissoes().can(acao, modulo, menu)` lê `role_permissions` (matriz ERP).
- `<RoleGate acao modulo menu>` esconde children quando `can()` falha.
- Ações: `visualizar | incluir | alterar | excluir | aprovar | exportar | executar_ia`.
- Admin sempre passa.

**Estado atual das 14 telas do fluxo de Licitações: ZERO gates.**
Qualquer usuário que enxerga a tela executa qualquer ação (front não consulta permissão; só RLS, que quebra com erro feio).

| Fase | Tela(s) | Módulo | menu_codigo | Ações críticas |
|---|---|---|---|---|
| 1 Captação | Pipeline, CadastroEdital | `licitacoes` | `pipeline`, `editais` | incluir/alterar/excluir |
| 2 Documentação | Documentos | `licitacoes` | `documentos` | incluir/alterar/excluir/exportar |
| 3 Análise | Composicao, CustosBDI | `licitacoes` | `composicao`, `custos-bdi` | incluir/alterar/aprovar |
| 4 Pareceres | Parecer (téc), SST, Jurídico, Controladoria, DirOp, DirAdm | `licitacoes` | `parecer-tecnico`, `parecer-sst`, `parecer-juridico`, `parecer-controladoria`, `parecer-dir-operacional`, `parecer-dir-administrativo` | incluir/alterar/aprovar |
| 5 Consolidação | Parecer Gerencial + Aprovações | `licitacoes` | `parecer-gerencial`, `aprovacoes` | aprovar |
| 6 Disputa | Pregao | `licitacoes` | `pregao` | alterar/executar_ia |
| 7 Encaminhamento | Resultado, ProntasContrato | `licitacoes` | `resultado`, `prontas-contrato` | alterar/aprovar |

Triagem IA fica fora (decisão do B2).

## Convenção de aplicação

- **Esconder** botões destrutivos/criativos (incluir, alterar, excluir) → `<RoleGate>`.
- **Desabilitar + tooltip** botões de fluxo (aprovar, exportar, executar_ia) → `disabled={!can(...)}` + `title="Sem permissão para X nesta fase"`.

## Execução fatiada (7 sub-PRs, uma aprovação por fase)

Ordem do mais leve ao mais pesado, para validar o padrão antes de tocar telas grandes:

1. **B2.1.a** — Fase 1 (Pipeline 371l + CadastroEdital 211l)
2. **B2.1.b** — Fase 2 (Documentos 121l)
3. **B2.1.c** — Fase 6 (Pregao 107l)
4. **B2.1.d** — Fase 7 (Resultado 108l + ProntasContrato 90l)
5. **B2.1.e** — Fase 4 (6 telas de Pareceres)
6. **B2.1.f** — Fase 5 (Parecer Gerencial + Aprovações)
7. **B2.1.g** — Fase 3 (Composicao 750l + CustosBDI 309l) — mais pesado, por último

Cada sub-PR: lista de botões mapeados → wrapper `<RoleGate>` ou `disabled || !can()` → tooltip → teste manual com Renan Bahr → segue.

## Proibições (do bloco original)

- Não criar terceiro sistema de permissões (só `can()` + `RoleGate`).
- Não alterar `role_permissions`, `app_menu`, `has_permissao` aqui.
- Não apagar Triagem IA nem nenhum arquivo.
- Não mexer em RLS/banco.

## Rollback

Por sub-PR: revert do commit do front. Zero impacto em DB.

## Aceite por sub-PR

1. Usuário sem `incluir` no menu da fase: não vê "Novo X".
2. Sem `alterar`: não vê "Editar"; ícones inline somem.
3. Sem `excluir`: não vê "Excluir".
4. Sem `aprovar`: vê "Aprovar/Rejeitar" disabled com tooltip.
5. Admin enxerga tudo.

## Fora do escopo

- Validação dupla server-side (RLS fina por ação) — proposta separada.
- Auditoria de cliques negados — backlog.
- Consolidação da tela de Permissões em Configurações do ERP — vira **B2.2** depois.

## Confirmações antes de executar B2.1.a

1. Mapeamento Fase 1–7 acima está correto (especialmente Fase 3 = Composição+BDI e Fase 5 = Gerencial+Aprovações)?
2. Convenção "esconder destrutivos / desabilitar fluxo" ok?
3. Ordem 1→2→6→7→4→5→3 ok, ou prefere outra (ex.: pareceres primeiro)?

Após o "ok", entro em build mode e abro **B2.1.a** (Fase 1).
