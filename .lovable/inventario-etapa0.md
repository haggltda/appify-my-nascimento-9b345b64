# Inventário Etapa 0 — Estado real (read-only)

Snapshot: 2026-05-20. Schema `public`. Modo somente leitura — nenhuma migration, RLS ou código alterado.

## 1. Resumo executivo

- **Banco:** 138 funções, ~17 views, >180 tabelas em `public`, **100% com RLS habilitada** (zero tabelas sem RLS).
- **Migrations:** 60 arquivos entre 2026-05-08 e 2026-05-19 (última: `20260519210356` — multiempresa `acessa_todas_empresas`).
- **Edge functions:** 13 (admin-user x3, copiloto x4, dump-regras, fcr-load, mz-load, nf-consultar-sefaz, nf-import-xml, pacote02-load).
- **App:** 1 shell (`/app`) com **~95 rotas** internas + Login + TrocarSenha + NotFound. Gates: `ProtectedRoute` (auth), `RouteGuard`, `RoleGate`, `ScreenGate`, `PermissoesProvider`, `EmpresaAtivaProvider`.
- **Estado da migração de dados:** contratos já promovidos (56 linhas), cronograma de faturamento populado (672), demais fatos produtivas (títulos, razão, fluxo) **ainda vazias** — staging `mz_*` carregada.
- **Bloqueador V3 conhecido:** títulos a pagar/receber e razão contábil produtivos zerados; promoção via `integration_*` ainda não rodada em produção.

## 2. Volumetria — fatos críticas vs staging

| Domínio | Produtiva | Linhas | Status |
|---|---|---:|---|
| Empresas | `empresas` | 6 | ✅ |
| Centros de custo | `centros_custo` | 742 | ✅ |
| Plano de contas | `conta_contabil` | 1.194 | ✅ |
| Linhas DRE | `dre_linhas` | 28 | ✅ |
| Colaboradores | `colaborador` | 8.847 | ✅ |
| Contratos | `contrato` | **56** | ⚠️ parcial (antes 0, agora promovidos) |
| Cronograma faturamento | `cronograma_faturamento` | 672 | ⚠️ parcial |
| Títulos a receber | `titulo_receber` | (a confirmar — não consultado neste lote) | ❓ |
| Títulos a pagar | `titulo_pagar` | (idem) | ❓ |
| Razão contábil | `lancamento_contabil` | (idem) | ❓ |
| Pré-títulos | `pre_titulo` | (idem) | ❓ |
| Audit log | `audit_log_2026_04/05/06` | 728 / 3.177 / 0 | ✅ particionado |
| FCR cargas | `fcr_raw_excel` | 857 | ✅ |
| Integração batches | `integration_batches` | 3 | ✅ |

> Pendência mensurável dentro do teto: 4 contadores não consultados (titulo_pagar, titulo_receber, lancamento_contabil, pre_titulo). Veja §8.

## 3. Segurança / RLS — visão geral

- **0 tabelas sem RLS.** Não há exposição estrutural.
- Distribuição típica de policies: 1 a 8 por tabela; média ~3.
- Tabela com mais policies: `fornecedor_conta_bancaria` (8) — dado sensível (chave Pix, conta bancária).
- Auditoria estruturada presente: `access_audit_log` (4) + `audit_log_2026_*` particionado por mês.
- **Não auditado nesta etapa (read-only):** conteúdo lógico das policies (apenas contagem). Revisão semântica fica para Etapa 1.

## 4. Funções / RPCs reaproveitáveis (138 totais)

Confirmadas e prontas para os fluxos V3 (já listadas em `.lovable/auditoria-v2.md` §3):

- **Títulos:** `emitir_titulo_de_cronograma`, `emitir_titulos_cronograma_lote`, `faturar_contrato_competencia`, `titulo_baixar`, `titulo_agendar`, `titulo_receber_atualizar_status`, `titulo_receber_marcar_vencidos`.
- **Contabilização:** `contabilizar_baixa_pagar`, `contabilizar_baixa_receber`, `contabilizar_nota_fiscal` + triggers `trg_baixa_receber_contabiliza`, `trg_titulo_pagar_contabiliza`, `trg_nf_autorizada_contabiliza`.
- **Relatórios:** `dre_realizado`, `balancete`, `balanco_patrimonial`, `apurar_impostos_competencia`.
- **Bancário:** `extrato_importar`, `conciliacao_auto_match`, `cnab_gerar_remessa`, `cnab_processar_retorno`, `cobranca_gerar_boleto`, `cobranca_gerar_pix`.
- **Integração:** `integration_approve_batch`, `integration_promote_batch`, `integration_reject_batch`, `integration_materialize_staging`, `integration_resolve_alias`.
- **Multiempresa (novo, migração 2026-05-19):** `user_pode_atuar_empresa`, `has_role`, `get_user_empresa` + trigger `profiles_validate_empresa_atual`.

## 5. Enums críticos para os 21 fluxos

- **Papéis (`app_role`, 17 valores):** admin, controladoria, comercial, operacional, juridico, sst, diretor_adm, diretor_op, visitante, comprador, almoxarife, gestor_cc, fiscal_recebedor, financeiro, fiscal, **presidencia**, usuario. Cobre Helena (diretor_adm/presidencia), Maiara (operacional/financeiro), Financeiro.
- **Ações (`app_acao`, 8):** visualizar, incluir, alterar, excluir, **aprovar**, exportar, executar_ia, alterar_dre. Suficiente para a matriz pessoa × tela × ação da Onda 4.
- **Pagamento — pré-título (`pre_titulo_status`):** rascunho → em_aprovacao → aprovado → promovido / rejeitado / cancelado.
- **Malote (`malote_status`):** rascunho → enviado → **aprovado** → executado / cancelado. ✅ separa aprovação (Helena) de execução (Financeiro), como confirmado.
- **Aprovação genérica (`aprov_decisao`):** pendente, aprovado, rejeitado, devolvido.
- **CNAB/Conciliação:** `extrato_status_conciliacao` (pendente/sugerido/conciliado/ignorado/divergente), `banco_layout_tipo` (cnab240/400 remessa+retorno, api_rest, ofx, csv).

## 6. Mapa de rotas do app (95 rotas em `/app`)

Agrupamento por módulo (página única por rota, exceto onde indicado):

- **Núcleo:** `/app` (Início), `painel-executivo`, `presidencia`, `aprovacoes`, `aprovacoes/inbox`, `historico`, `administracao`, `ajuda` (+ `:modulo/:slug`).
- **Comercial / Licitação:** `pipeline`, `editais`, `documentos`, `triagem`, `composicao`, `custos-bdi`, `pregao`, `resultado`, `prontas-contrato`.
- **Pareceres:** `parecer-tecnico`, `parecer-sst`, `parecer-juridico`, `parecer-controladoria`, `parecer-dir-operacional`, `parecer-dir-administrativo`, `parecer-gerencial`.
- **Contratos (9):** implantacao, ativos, empenhos, postos, faturamento, medicoes, reajustes, encerramentos, `:id`.
- **Controladoria (8):** empresas, centros-custo, estrutura-organizacional, dre, classificadores, obz, obz-versoes, dre-gerencial.
- **Suprimentos (13):** fornecedores, produtos-servicos, produtos, categorias, almoxarifados, estoque, movimentos, nf-entrada, requisicoes, pedidos, aprovacoes, recebimentos, cotacoes.
- **Financeiro (12):** contas-pagar, contas-receber, fluxo-caixa, fluxo-caixa-diario, capital-giro, conciliacao-fluxo-caixa, contas-bancarias, movimentos, integracao-bancaria (+builder/:contaId), programacao-pagamentos, validacao-pos-pagamento.
- **Contábil (8):** lancamentos, plano-contas, avancada, aprovacao-contas, balancete, razao, dre-gerencial-real, conciliacao-eventos.
- **Fiscal:** `fiscal`.
- **RH (3):** colaboradores, alocacoes, folha.
- **BI:** `bi`.
- **Integração/Migração:** integracao, integracao/aliases, integracao/:id, admin/migracao-zero, admin/permissoes.
- **Plano de Ações (8):** lista, dashboard, kanban, importar, aprovacoes, configuracoes, copiloto, `:id`.
- **Orçamento:** `orcamento`.

## 7. Matriz fluxos V3 × estado atual

Legenda: ✅ pronto / 🟡 parcial / ⚠️ ausente.

| # | Fluxo V3 | Banco | UI | Observação |
|---|---|---|---|---|
| 1 | Licitação | 🟡 | ✅ | `licitacao_*` + pipeline/edital/pregão prontos |
| 2 | Análise multiárea (pareceres) | 🟡 | ✅ | 6 telas de parecer; `comite`, `area` populados |
| 3 | Vitória/Empenho/Contrato | 🟡 | ✅ | `contrato` agora com 56; `empenhos` UI ok |
| 4 | Cadastro do contrato | 🟡 | ✅ | `contrato_posto`, `contrato_dissidio` vazios |
| 5 | Mobilização (RH+SST) | ⚠️ | 🟡 | `alocacao_colaborador` vazio |
| 6 | Orçamento por competência | 🟡 | ✅ | `orcamento_*` estrutura ok; dados parciais |
| 7 | Fluxo de caixa | ⚠️ | ✅ | `fluxo_caixa_projetado` vazio; mz_41 carregada |
| 8 | DRE | 🟡 | ✅ | `dre_linhas` 28; realizado depende de razão |
| 9 | Execução mensal | ⚠️ | ✅ | depende de §10–14 |
| 10 | Compras/Estoque | 🟡 | ✅ | `cotacao_*`, `estoque_*` vazios; UI completa |
| 11 | NF e pré-títulos | 🟡 | ✅ | edge `nf-import-xml` + `nf-consultar-sefaz` prontos |
| 12 | Faturamento/AR | 🟡 | ✅ | RPC `faturar_contrato_competencia` ok |
| 13 | **Programação de pagamento (Helena/Fin.)** | 🟡 | ✅ | `pre_titulo`, `malote_status` ok; falta separar UX aprovar×executar |
| 14 | Conciliação bancária | 🟡 | ✅ | `extrato_*`, `conciliacao_auto_match` ok; sem dados |
| 15 | Fechamento mensal | 🟡 | 🟡 | `apuracao_imposto*` vazios |
| 16 | Relatórios | 🟡 | 🟡 | views `v_dre_*`, `vw_bi_*` ok; falta `vw_presidencia_*` |
| 17 | Matriz ponta a ponta | 🟡 | — | governança transversal |
| 18 | Inventário back-end | ✅ | — | **este documento** |
| 19 | UX | 🟡 | 🟡 | Onda 4 (permissões) planejada em `.lovable/plan.md` |
| 20 | Alertas | ⚠️ | ⚠️ | sem motor de notificação identificado |
| 21 | Critério de aprovação | 🟡 | ✅ | `aprov_etapa` (18), `alcada_aprovacao` (1) — alçada precisa popular |

## 8. Bloqueadores / pendências mensuráveis

1. **Fatos produtivas vazias** (títulos pagar/receber, razão, pré-títulos): bloqueia fluxos 7–14. Resolver via promoção `integration_*` (Bloco 2 da auditoria V2).
2. **`contrato_posto` / `contrato_dissidio` vazios**: bloqueia mobilização e dissídio (fluxos 4–5).
3. **`alcada_aprovacao` com 1 linha**: bloqueia fluxo 13 (Helena aprova malotes) — precisa popular alçadas reais por empresa/faixa de valor.
4. **`vw_presidencia_*` ausentes**: bloqueia Painel Executivo do Bloco 9 da V2.
5. **Motor de alertas/notificações ausente**: bloqueia fluxo 20.
6. **Revisão semântica de policies não feita** (apenas contagem nesta etapa) — necessária na Etapa 1.

## 9. Pendências de inventário (não cobertas dentro do teto de 3 créditos)

- Contagem exata de `titulo_pagar`, `titulo_receber`, `lancamento_contabil`, `pre_titulo` (4 SELECTs).
- Conteúdo lógico de cada policy RLS (apenas quantidade foi medida).
- Lista detalhada de buckets de storage e suas policies.
- Auditoria de `aprov_etapa` (18 linhas — quais alçadas existem hoje).
- Mapa role → menus em `role_permissions` / `screen_permission_profile`.

Estimativa: cabe em **mais 1 a 2 créditos** numa Etapa 0.1 dedicada.

## 10. Próximos passos sugeridos (não executar agora)

1. **Etapa 0.1 (opcional):** fechar pendências do §9.
2. **Etapa 1 — Fundamentos:** popular `alcada_aprovacao` real + implementar Onda 4 (`screen_permission_*` já planejada em `plan.md`).
3. **Fluxo 13 + 14 (dor imediata Helena/Maiara/Financeiro):** separar UX de "aprovar malote" (Helena) vs "executar pagamento" (Financeiro) em `ProgramacaoPagamentos.tsx` + `MalotesTab.tsx`; ativar geração CNAB e conciliação no caminho feliz.

---

## 11. Etapa 0 — Fechamento (pendências §9 resolvidas)

### 11.1 Contadores fechados

| Tabela | Linhas | Implicação |
|---|---:|---|
| `titulo_pagar` | **3** | quase vazia → confirma bloqueador do fluxo 13 |
| `titulo_receber` | **0** | bloqueia fluxo 12 (faturamento/AR) |
| `lancamento_contabil` | **172** | há razão inicial; mas longe das 215k de `mz_32` (a promover) |
| `pre_titulo_pagar` | 3 | pipeline pagto começou a ser usado |
| `malote_pagamento` | 3 | idem |
| `malote_titulo` | 6 | idem |
| `profiles` | 39 | base de usuários ativa |
| `user_roles` | 59 | múltiplas roles por usuário em uso |
| `user_empresa` | 38 | vínculos explícitos empresa↔usuário |

### 11.2 Storage buckets (10)

| Bucket | Público | Uso esperado |
|---|---|---|
| `anexos` | privado | anexos genéricos |
| `nfe-xml` | privado | XMLs NF entrada |
| `integration-uploads` | privado | cargas batch |
| `colaboradores-fotos` | **público** | fotos RH |
| `migracao-zero` | privado | pacote zero |
| `pre-titulos-fiscal` | privado | docs fiscais do pré-título |
| `identidade-visual` | privado | logos por empresa |
| `avatars` | **público** | avatar usuário |
| `copiloto-audios` | privado | gravações do copiloto |
| `fcr-uploads` | privado | planilhas FCR |

- **38 policies** no schema `storage` (média ~4 por bucket). Revisão semântica fica para Etapa 1.

### 11.3 Alçada de aprovação real (hoje)

- **`aprov_etapa` (18 linhas) = 3 etapas × 6 empresas**, idênticas em todas:
  1. **Operacional** — `diretor_op` — valor_min 0, sem teto.
  2. **Controladoria** — `controladoria` — valor_min 0, sem teto.
  3. **Diretoria Adm** — `diretor_adm` — valor_min **R$ 500.000**, sem teto.
- **`alcada_aprovacao` (1 linha)** — somente "Presidência" (Helena Nascimento), empresa única `5a61c769…`, ordem 0, sem faixa de valor.
- **Gap fluxo 13:** Helena hoje só está cadastrada em 1 das 6 empresas. Para aprovar malotes do grupo inteiro, **falta replicar a alçada "Presidência" para as outras 5 empresas** (ou ativar `acessa_todas_empresas` + permitir alçada cross-empresa).

### 11.4 Mapa de permissões

- **`role_permissions` — 704 linhas** (legado, granular por menu × ação):
  - controladoria 297 · diretor_adm 166 · admin 76 · diretor_op 63 · presidencia 61 · usuario 23 · comercial 6 · sst 4 · juridico 4 · operacional 3 · visitante 1.
- **`screen_permission_profile` — 280 linhas** (Onda 4, nova matriz):
  - presidencia 90 · diretor_adm 86 · admin 86 · usuario 14 · controladoria 4.
- **`screen_permission_user` — 24 overrides** ativos por pessoa.
- **Gap:** roles operacionais (`operacional`, `financeiro`, `fiscal`, `comercial`, `comprador`, `almoxarife`, `gestor_cc`, `fiscal_recebedor`) **não estão na nova matriz** — caem no fallback `role_permissions` legado. Onda 4 precisa popular esses perfis.

### 11.5 Conclusão da Etapa 0

✅ **Entreguei tudo o que estava no escopo da Etapa 0 (incluindo as pendências do §9), dentro do teto adicional aprovado.**

Pendência semântica deliberadamente **adiada para Etapa 1** (não cabia em read-only):
- Revisão lógica de cada policy RLS (apenas contagem foi medida nas duas passagens).
- Revisão lógica das 38 policies de storage.

Estado pronto para decidir o próximo recorte: **Etapa 1 (fundamentos)** ou **Fluxo 13+14 (Helena/Financeiro/Conciliação)**.

---

## 12. Revisão semântica de RLS e Storage (Etapa 0 — fechamento total)

**Universo:** 580 policies (`public` + `storage`) classificadas por padrão lógico de `USING/WITH CHECK`.

### 12.1 Distribuição por padrão

| Padrão | Qtd | O que faz |
|---|---:|---|
| **EMPRESA_SCOPED** (`get_user_empresa`) | 319 | restringe à empresa única retornada pela função antiga |
| **USER_SCOPED** (`auth.uid()`) | 217 | restringe ao dono/criador do registro |
| **ROLE_ONLY** (`has_role`) | embutido em ~maioria | bypass admin/controladoria etc. |
| **OPEN_TRUE** | **36** | qualquer usuário autenticado lê/escreve |
| **EMPRESA_MULTI** (`user_pode_atuar_empresa`) | **0** | função nova **não está em uso em nenhuma policy** |
| OUTRO | 8 | regras específicas (joins) |

### 12.2 🔴 Achado crítico nº 1 — Incompatibilidade multiempresa

**137 tabelas** filtram por `empresa_id = get_user_empresa(auth.uid())`. Essa função retorna **uma única empresa** (a `empresa_atual_id` do `profiles`). A migração de 2026-05-19 introduziu `acessa_todas_empresas` e `user_pode_atuar_empresa(_user, _empresa)`, mas **nenhuma policy foi reescrita para usar a nova função**.

**Consequência prática para Helena/Maiara/Financeiro:**
- Mesmo com `acessa_todas_empresas = true`, ao trocar empresa no Topbar a UI vê os dados (porque o `EmpresaAtivaContext` já lê tudo), mas qualquer **escrita** continua sujeita ao filtro antigo. Em vários módulos, leitura também é negada se o `empresa_atual_id` ainda não foi atualizado no instante da query.
- **Bloqueador estrutural do fluxo 13** (Helena aprovar pagamentos de qualquer empresa) e de qualquer fluxo cross-empresa.

**Correção necessária (Etapa 1):** substituir `(empresa_id = get_user_empresa(auth.uid()))` por `user_pode_atuar_empresa(auth.uid(), empresa_id)` nas 137 tabelas. Migração mecânica, mas de alto volume — precisa script gerador.

### 12.3 🔴 Achado crítico nº 2 — Dados sensíveis com `qual = true`

Tabelas com policy aberta para qualquer authenticated, contendo dado financeiro/bancário sensível:

| Tabela | Policy(s) | Severidade |
|---|---|---|
| **`fornecedor_conta_bancaria`** | `auth read/insert/update/delete` (4× qual=true) | 🔴 Alta — chave Pix, agência/conta de fornecedores |
| `saldos_iniciais_caixa` | `auth read saldos iniciais` (SELECT true) | 🟠 Média — saldos por conta |
| `pre_titulo_rateio` | `auth read/write` (SELECT+ALL true) | 🟠 Média — valores e rateios |
| `pre_titulo_anexo` | `auth read/write` (SELECT+ALL true) | 🟠 Média — anexos fiscais |

Note: `fornecedor_conta_bancaria` tem **8 policies** (4 antigas abertas + 4 mais restritivas adicionadas depois). Como RLS é OR entre policies do mesmo `cmd`, **as 4 abertas anulam as restritivas**. Precisa dropar as antigas.

### 12.4 🟡 Aberturas aceitáveis (catálogo público interno)

36 policies `qual=true` SELECT, das quais ~30 são catálogos de leitura sem dado sensível e podem ficar como estão:
- `empresas`, `app_menu`, `app_modulo`, `area`, `setor`, `comite` — metadados de organização.
- `cfop`, `plano_contas_master`, `ia_provedores`, `perfil_metadata`, `centros_custo_sequencia` — referência.
- `role_permissions`, `screen_permission_profile` — necessárias para o front montar gates.
- `integration_layouts`, `integration_layout_columns`, `integration_layout_fingerprints`, `integration_validation_rules` — layouts de carga.
- 10× `stg_*_read` — staging de leitura para promoção.

### 12.5 Storage — 38 policies em 10 buckets

**Padrão aplicado e correto na maioria:**
- `storage_path_empresa(name) = get_user_empresa(auth.uid())` para isolar por empresa (anexos, nfe-xml, pre-titulos-fiscal, fcr-uploads, integration-uploads, migracao-zero, identidade-visual, copiloto-audios).
- `has_role(auth.uid(),'admin')` bypass.
- Buckets públicos (`avatars`, `colaboradores-fotos`) com SELECT `bucket_id=…` — esperado.

**Mesmo problema do §12.2 aparece aqui:** o helper `storage_path_empresa` é comparado com `get_user_empresa` (single-empresa). Quando uma policy de pagamentos/anexos for ativada para o grupo, será preciso trocar para `user_pode_atuar_empresa`.

**Sem aberturas inseguras detectadas no storage.** Apenas `avatars` e `colaboradores-fotos` são públicos por design (URLs assinadas/diretas para foto de perfil).

### 12.6 Resumo de ações para a Etapa 1

| Prioridade | Ação | Escopo |
|---|---|---|
| 🔴 P0 | Dropar 4 policies abertas em `fornecedor_conta_bancaria` | 1 tabela |
| 🔴 P0 | Restringir `saldos_iniciais_caixa`, `pre_titulo_rateio`, `pre_titulo_anexo` por empresa | 3 tabelas |
| 🔴 P1 | Reescrever 137 tabelas: `get_user_empresa` → `user_pode_atuar_empresa` | script gerador |
| 🟡 P1 | Reescrever policies de storage que dependem de `get_user_empresa` | 8 buckets privados |
| 🟢 P2 | Popular `screen_permission_profile` para roles operacionais (Onda 4) | 11 roles ausentes |

---

## 13. Encerramento definitivo da Etapa 0

✅ **Etapa 0 100% concluída.** Nada ficou pendente.

Total entregue: inventário estrutural (§1–§7), bloqueadores (§8), fechamento dos contadores e storage (§11), e **revisão semântica completa de RLS e storage (§12)** com 2 achados críticos.

**Próximo passo natural:** Etapa 1 começa pelo §12.6 (P0 + P1), que **destrava ao mesmo tempo** o caso Helena/Maiara/Financeiro (fluxo 13) e fecha a brecha de dados bancários sensíveis.
