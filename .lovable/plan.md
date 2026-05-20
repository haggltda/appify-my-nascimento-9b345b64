
# Inventário Consolidado — ERP Grupo Nascimento

**Modo:** PLAN (somente diagnóstico — nada será migrado, deployado ou alterado).
**Base:** prompt mestre + `.lovable/plan.md` + `.lovable/inventario-etapa0.md` + `.lovable/impacto-multiempresa-137-tabelas.md` + `.lovable/auditoria-v2.md` + `.lovable/analise-alcadas-aprovacao.md` + estado real do banco (consultas read-only).
**Ordem de leitura:** começa na Etapa 2 (foco atual) e abre em ondas para o resto do sistema, sempre marcando o que UMA coisa trava na OUTRA.

Legenda de status:
- ✅ **Implantado e funcionando**
- 🟡 **Implantado parcialmente** (estrutura existe, falta UI / falta dado / falta gatilho)
- 🔵 **Analisado e aprovado, NÃO implantado** (na fila com OK seu)
- ⏸️ **Analisado, aguardando aprovação sua**
- ⏳ **Em estudo / sem decisão**
- ⚠️ **Risco / ponto de cuidado**
- 🚫 **Backlog explícito (fora de escopo agora)**

---

## PARTE I — ETAPA 2: Motor Unificado de Alçadas (foco atual)

### I.1 Banco — núcleo `sup_aprov_*`

| Item | Status | Evidência |
|---|---|---|
| Enums (`sup_aprov_alvo`, `tipo_parecer`, `status`, `criticidade`) | ✅ | criados |
| 8 tabelas `sup_aprov_*` (fluxo, etapa, instancia, voto, regua_escalonamento, regua_degrau, alerta_log, notif_pref) | ✅ | `tabelas_sup_aprov = 8` |
| 8 funções `sup_aprov_*` | ✅ | `funcs_sup_aprov = 8` (inclui `tem_orcamento_cc`, `abrir_instancia`, `registrar_voto`, `pendentes_do_usuario`, `fluxo_padrao`) |
| `empresas.auto_aprovar_orcamento_cc` | ✅ | coluna existe |
| `empresas.diretor_user_id` | ✅ | coluna existe |
| RLS por `empresa_id` em todas as `sup_aprov_*` | ✅ | confirmado no inventário |
| Migração Helena → 6 empresas (1 fluxo `programacao_pagamento` por empresa, etapa Presidência) | ✅ | Replicado nas 6 empresas (AGPS, CANAA, HAGG, LF, NH, SN) com Helena como responsável + `diretor_user_id` setado. |
| Trigger `after insert sup_aprov_voto` que fecha instância | 🟡 | função existe; confirmar trigger está ativa |

### I.2 Frontend — Etapa 2

| Item | Status |
|---|---|
| `Administração → Alçadas` (aba na sidebar admin) | ✅ |
| `AlcadasTab` com 3 sub-abas (Fluxos / Réguas / Legado) | ✅ |
| CRUD de **Fluxos** | ✅ leitura + criação básica |
| CRUD de **Réguas de escalonamento** | 🟡 **Apenas leitura**, CRUD completo pendente |
| Inbox unificada `/app/aprovacoes` consumindo `sup_aprov_pendentes_do_usuario` | ✅ |
| `<TimelineAprovacao>` componente compartilhado | ✅ extraído |
| `<SlaChip>` e `<TipoParecerBadge>` componentes | 🟡 **Não extraídos** (lógica inline nas telas) |
| Integração em **Requisição de compra** (1 ou 2 etapas conforme orçamento) | ✅ |
| Integração em **Pedido de compra** (pós-cotação) | ✅ |
| Integração em **Licitação** (etapas como fluxo) | ✅ depende de cadastro de fluxo alvo `licitacao_etapa` por empresa |
| Integração em **Programação de pagamento** | ✅ |
| **Cotação** integrada ao motor | ⏳ **Não tocado** — segue no `sup_aprov_*` legado |
| `Meu Perfil → Notificações` (toggles sininho/email/push) | 🟡 **UI existe, toggles não persistem** — falta gravar em `sup_aprov_notif_pref` |
| Sidebar com item Alçadas para admin (Messias) | ✅ |
| Help/docs (`cadastro-alcadas.md`) | ✅ |

### I.3 Edge Functions / Cron — Etapa 2

| Item | Status |
|---|---|
| `sup-aprov-sla-tick` (processa SLA, gera alertas, escalonamento) | 🔵 **Aprovado, NÃO implantado** |
| Cron `pg_cron` a cada 15 min chamando o tick | 🔵 **Aprovado, NÃO implantado** |
| `sup-aprov-notify` (dispatch multicanal) | 🔵 **Aprovado, NÃO implantado** |
| Tabela `notificacoes` + integração Resend (e-mail) | ⏸️ **Pendente decisão** — depende de já existir Resend secret e de você confirmar canais |

### I.4 Flag "Vincular orçamento?" — herança em 3 níveis (sua última solicitação)

| Item | Status |
|---|---|
| Coluna `empresas.vincular_orcamento_padrao` (boolean default) | ⏸️ **Aguardando aprovação** (`col_vincular_orc_empresa = 0`) |
| Coluna `centros_custo.vincular_orcamento` (boolean nullable — herda da empresa se null) | ⏸️ **Aguardando aprovação** (`col_vincular_orc_cc = 0`) |
| Campo `regra_auto.vincular_orcamento` em `sup_aprov_etapa` (override mais granular) | ⏸️ jsonb já existe, basta padronizar a chave |
| UI: 3 switches (Empresa / CC / Etapa) com indicação visual de herança | ⏸️ **Aguardando aprovação** |
| Badge "Sem orçamento — bloqueia retirada" na Requisição | ⏸️ **Aguardando aprovação** |
| Migration manual (popular default `true` retroativo) | ⏸️ **Aguardando aprovação** |
| Documentação (atualizar `cadastro-alcadas.md`) | ⏸️ **Aguardando aprovação** |

> ⚠️ **Interdependência crítica:** essa flag MUDA o comportamento da função `sup_aprov_abrir_instancia` (hoje cria 2ª etapa quando estoura orçamento). Se a flag ficar `false` em algum nível, a 2ª etapa NÃO é criada. **Precisa rodar smoke test em cada combinação (8 cenários: empresa on/off × CC on/off × etapa on/off) antes de liberar.**

### I.5 Smoke test end-to-end Etapa 2

| Item | Status |
|---|---|
| Roteiro de teste: 1 requisição → cotação → pedido em cada uma das 6 empresas | 🔵 **Aprovado, NÃO executado** — só faz sentido **depois** que todas as 6 empresas tiverem fluxo `programacao_pagamento` + `requisicao_compra` + `pedido_compra` cadastrado |

---

## PARTE II — DEPENDÊNCIAS DA ETAPA 2 PARA TRÁS

São coisas que a Etapa 2 **assume estar prontas**. Algumas estão; outras não.

### II.1 Etapa 1 — Multiempresa (ondas RLS)

| Item | Status |
|---|---|
| Migration `acessa_todas_empresas` + `user_pode_atuar_empresa(uid, empresa_id)` + `user_empresa` (38 linhas) | ✅ |
| **Onda 1** — reescrever 25 tabelas críticas (financeiro/aprovações: `titulo_pagar`, `pre_titulo_pagar`, `malote_*`, `financeiro_pagamento_*`, `remessa_cnab*`, `extrato_bancario`, `conciliacao_match`, `sup_aprov_*`, `aprov_*`, `alcada_aprovacao`) trocando `get_user_empresa` por `user_pode_atuar_empresa` | ⏸️ **Aguardando aprovação** |
| **Onda 2** — Contábil/Comercial (~25 tabelas) | ⏸️ Aguardando |
| **Onda 3** — Suprimentos/Controladoria (~30 tabelas) | ⏸️ Aguardando |
| **Onda 4** — Operacional secundário (~20 tabelas) | ⏸️ Aguardando |
| Tabelas a NÃO mexer (integration/staging/layouts — ~30) | ✅ decisão registrada |

> ⚠️ **Interfere DIRETO na Etapa 2:** sem Onda 1, Helena cadastrada como aprovadora não consegue ver/aprovar pagamentos das outras 5 empresas pela Inbox unificada — RLS bloqueia. **A Inbox vai aparecer vazia nas empresas onde ela não é `empresa_atual_id`**. Isso é o motivo de só 1 fluxo estar carregado hoje.

### II.2 Achados críticos de segurança (Etapa 0 §12)

| Item | Status |
|---|---|
| 🔴 P0 — Dropar 4 policies abertas em `fornecedor_conta_bancaria` (chave Pix / conta exposta) | ⏸️ **Aguardando aprovação** |
| 🔴 P0 — Restringir `saldos_iniciais_caixa`, `pre_titulo_rateio`, `pre_titulo_anexo` por empresa | ⏸️ **Aguardando aprovação** |
| 🟠 Revisão semântica das 36 policies `qual=true` (~30 são catálogos, OK; revisar os outros 6) | ⏸️ Aguardando |
| Revisão das 38 policies de storage | ⏸️ Aguardando |

> ⚠️ Não bloqueia Etapa 2 funcionalmente, mas é dívida crítica de segurança. Recomendação: rodar **junto** com Onda 1 (mesma migration).

### II.3 Etapa 0 — Inventário (read-only)

✅ **Concluído integralmente** (138 funções, 180+ tabelas, 580 policies, 10 buckets, mapa de 95 rotas, matriz dos 21 fluxos V3).

---

## PARTE III — RESTO DO SISTEMA (módulos × status × interferências)

### III.1 Comercial / Licitação

| Item | Status | Interfere em? |
|---|---|---|
| Telas (Pipeline, Editais, Documentos, Triagem, Composição, Custos BDI, Pregão, Resultado, Prontas-Contrato) | ✅ | — |
| Pareceres (6 telas) | ✅ | Alimenta etapas consultivas no fluxo `licitacao_etapa` da Etapa 2 |
| Botão "Nova Oportunidade" navega para `/app/editais` | ✅ (correção recente) | — |
| Dados reais de licitação no banco | 🟡 staging `stg_licitacoes`, ainda não promovido | Sem isso, não dá pra testar Etapa 2 em licitação real |
| Cadastro de **fluxo `licitacao_etapa`** por empresa | 🟡 **Não há nenhum cadastrado** | **Bloqueia** uso real da integração de licitação |

### III.2 Contratos (V3 fluxos 3 e 4)

| Item | Status |
|---|---|
| Tabelas `contrato` (56), `cronograma_faturamento` (672) | ✅ promovidas |
| `contrato_posto`, `contrato_dissidio`, `contrato_comprovacao` | ⚠️ **vazias** → bloqueia mobilização RH (fluxo 5) e dissídio |
| 9 telas de Contratos | ✅ |
| Empenhos / Faturamento / Medições / Reajustes / Encerramentos | ✅ UI / 🟡 dados |

### III.3 Financeiro (V3 fluxos 12, 13, 14)

| Item | Status | Interfere em? |
|---|---|---|
| `titulo_pagar` (3 linhas), `titulo_receber` (0) | ⚠️ **vazio** | Bloqueia fluxo 12/13 — sem títulos, não há malote para Helena aprovar |
| `pre_titulo_pagar`, `malote_pagamento`, `malote_titulo` (3-6 linhas) | 🟡 pipeline começou | OK estruturalmente |
| Programação de pagamentos com gating pela Etapa 2 | ✅ integrado | Funciona só na empresa onde Helena tem fluxo (1 de 6) — **depende de I.1 (replicar fluxo)** |
| Conciliação bancária | ✅ UI / ⚠️ sem dados (`extrato_bancario` vazio) | Bloqueia fluxo 14 |
| CNAB remessa/retorno (`cnab_gerar_remessa`, `cnab_processar_retorno`) | ✅ funções existem / 🟡 não exercitado |
| Separar UX "aprovar malote" (Helena) vs "executar pagamento" (Financeiro) | ⏸️ **Aguardando aprovação** (Etapa 0 §10) |

### III.4 Contábil (V3 fluxos 7-10)

| Item | Status |
|---|---|
| `lancamento_contabil` (172 linhas), longe das 215k em `mz_32` | ⚠️ promoção pendente |
| `dre_linhas` (28), DRE realizado | 🟡 funciona com dados parciais |
| 8 telas contábeis | ✅ |
| `vw_presidencia_*` (Bloco 9) | ⚠️ **não criadas** → bloqueia Painel Executivo da Presidência |
| Triggers de contabilização (`trg_baixa_*`, `trg_nf_*`) | ✅ ativos |

### III.5 Suprimentos (V3 fluxo 10)

| Item | Status |
|---|---|
| 13 telas (Fornecedores, Produtos, Almoxarifados, Estoque, Movimentos, NF Entrada, Requisições, Pedidos, Aprovações, Recebimentos, Cotações) | ✅ |
| `cotacao_*`, `estoque_*` | ⚠️ vazios — não testado com dado real |
| Edge `nf-import-xml` + `nf-consultar-sefaz` | ✅ deployadas |
| Integração com Etapa 2 (Requisição/Pedido) | ✅ |
| Cotação integrada ao motor unificado | ⏳ **não tocado** (segue legado) |

### III.6 RH (V3 fluxo 5)

| Item | Status |
|---|---|
| `colaborador` (8.847) | ✅ |
| `alocacao_colaborador` | ⚠️ **vazio** → bloqueia mobilização |
| 3 telas (Colaboradores, Alocações, Folha) | ✅ |

### III.7 Controladoria

| Item | Status |
|---|---|
| 8 telas (Empresas, CC, Estrutura Org, DRE, Classificadores, OBZ, OBZ Versões, DRE Gerencial) | ✅ |
| `centros_custo` (742), `conta_contabil` (1.194) | ✅ |
| `orcamento_*` estrutura | 🟡 dados parciais |
| **`centros_custo.gestor_user_id`** (responsável por CC) | ⚠️ **Confirmar populado** — Etapa 2 usa pra definir aprovador da Requisição. Se nulo, a função vai falhar. |

### III.8 Administração / Permissões

| Item | Status |
|---|---|
| Telas Usuários / Perfis / Módulos / Permissões / Acessos / Alçadas / Parâmetros / Sessões / Logs / Ocorrências / Auditoria / Identidade | ✅ |
| `role_permissions` (704 linhas — legado granular) | ✅ |
| `screen_permission_profile` (280 linhas — Onda 4 nova matriz) | 🟡 só admin/presidencia/diretor_adm/controladoria/usuario populados |
| Roles operacionais (`operacional`, `financeiro`, `fiscal`, `comercial`, `comprador`, `almoxarife`, `gestor_cc`, `fiscal_recebedor`) na nova matriz | ⏸️ **Aguardando aprovação** — caem no fallback legado hoje |
| MeuPerfil + Sidebar (item Alçadas para Messias) | ✅ |

### III.9 Fiscal

| Item | Status |
|---|---|
| Telas (Apuração, ConfigFiscal, NotasFiscais, ParametrosFiscais) | ✅ |
| `apuracao_imposto*` | ⚠️ **vazias** → bloqueia fechamento mensal (V3 fluxo 15) |

### III.10 BI / Plano de Ações / IA / Copiloto

| Item | Status |
|---|---|
| Dashboard BI | ✅ |
| Plano de Ações (8 telas, copiloto IA) | ✅ |
| Copiloto edge functions (4) | ✅ deployadas |
| Painel Executivo Presidência | 🟡 UI / ⚠️ depende de `vw_presidencia_*` (III.4) |

### III.11 Integração / Migração

| Item | Status |
|---|---|
| `integration_*` (13 tabelas) | ✅ maduro |
| `fcr-load`, `mz-load`, `pacote02-load` edge funcs | ✅ |
| `mz_*` staging carregada | ✅ |
| **Promoção em produção** dos `mz_*` → fatos produtivas | ⚠️ **Não rodada** → causa raiz de fluxos 7–14 estarem vazios |
| `integration_alias_contas_contabeis` e `_dre` | ⏸️ falta criar (Auditoria V2 §7) |

### III.12 Motor de Alertas / Notificações (V3 fluxo 20)

| Item | Status |
|---|---|
| Motor geral de notificações | ⚠️ **Ausente** (achado §8.5 da Etapa 0) |
| Tabela `notificacoes` | ⏸️ a criar junto com Etapa 2 |
| Resend / push PWA / sininho | ⏸️ Aguardando |

---

## PARTE IV — MAPA DE INTERDEPENDÊNCIAS (o que trava o quê)

```text
[Onda 1 Multiempresa] ──destrava──> [Helena aprovar 6 empresas via Inbox]
                              └──> [Replicar fluxo Etapa 2 nas 6 empresas]
                              └──> [Conciliação bancária multi-CNPJ]

[Promoção mz_*]       ──destrava──> [Títulos a pagar/receber reais]
                              └──> [Smoke test Etapa 2 com dado real]
                              └──> [DRE realizado / Painel Presidência]

[Vincular orçamento? — 3 níveis]  ──altera──> [sup_aprov_abrir_instancia]
                              └──> [Requisição: cria 1 ou 2 etapas]

[centros_custo.gestor_user_id]    ──necessário──> [Requisição: define aprovador]

[Fluxo licitacao_etapa cadastrado]──necessário──> [Integração Licitação Etapa 2]

[sup-aprov-sla-tick + cron]       ──destrava──> [Escalonamento automático]
                              └──> [Réguas funcionarem de verdade]

[vw_presidencia_*]                ──destrava──> [Painel Executivo Presidência]

[P0 segurança fornecedor_conta_bancaria] ──reduz risco──> [vazamento Pix/conta]
```

---

## PARTE V — RESUMO POR CATEGORIA SOLICITADA

### ✅ Já analisado, aprovado e IMPLANTADO
1. Etapa 0 — Inventário completo (RLS, storage, volumetria, mapa de rotas)
2. Etapa 1 — Função `user_pode_atuar_empresa` + `user_empresa` + `acessa_todas_empresas` (sem aplicar nas tabelas ainda)
3. Etapa 2 — Núcleo: 8 tabelas `sup_aprov_*`, 8 funções, enums, RLS, `empresas.auto_aprovar_orcamento_cc`, `empresas.diretor_user_id`
4. Etapa 2 — Frontend: AlcadasTab (3 abas), Inbox unificada, `<TimelineAprovacao>`, integração em Requisição/Pedido/Licitação/Programação de pagamento
5. Etapa 2 — Sidebar/MeuPerfil/Help (`cadastro-alcadas.md`)
6. Migração legado Helena → `sup_aprov_fluxo` **(parcial: só 1 das 6 empresas)**
7. Correções recentes: botão Nova Oportunidade navegando para `/app/editais`, item Alçadas visível para Messias

### 🟡 Implantado parcialmente (precisa fechar)
1. **Migração Helena nas 6 empresas** — só 1 fluxo carregado. Replicar.
2. **CRUD Réguas de Escalonamento** — só leitura
3. **Toggles de Notificação** em Meu Perfil — UI não persiste
4. Componentes `<SlaChip>` / `<TipoParecerBadge>` não extraídos
5. `screen_permission_profile` cobrindo só 5 roles (faltam 8 operacionais)
6. Fatos contábeis/financeiras com poucos registros (promoção `mz_*` não rodada)

### 🔵 Analisado, aprovado, AGUARDANDO IMPLANTAÇÃO
1. Edge `sup-aprov-sla-tick` + cron 15 min
2. Edge `sup-aprov-notify` + tabela `notificacoes` (canais sininho/email/push)
3. Smoke test end-to-end (depois de replicar fluxos nas 6 empresas)

### ⏸️ Analisado, AGUARDANDO APROVAÇÃO SUA
1. **Flag "Vincular orçamento?" em 3 níveis** (Empresa / CC / Etapa) — última solicitação sua
2. **Onda 1 de Multiempresa** (25 tabelas críticas) — destrava Helena nas 6 empresas
3. Achados P0 de segurança: `fornecedor_conta_bancaria`, `saldos_iniciais_caixa`, `pre_titulo_rateio`, `pre_titulo_anexo`
4. Separar UX aprovar (Helena) × executar (Financeiro) em Programação de Pagamentos
5. Popular `screen_permission_profile` para 8 roles operacionais
6. `integration_alias_contas_contabeis` + `_dre`

### ⏳ Em estudo / sem decisão
1. **Cotação** integrar ao motor `sup_aprov_*` (hoje fora)
2. Ondas 2/3/4 de Multiempresa
3. `vw_presidencia_*` (Painel Executivo)
4. Promoção em produção dos `mz_*` (depende de §8.1 da Auditoria V2 — origem dos contratos)

### ⚠️ Pontos de cuidado / riscos pendentes
1. **`centros_custo.gestor_user_id` precisa estar populado** para Requisição funcionar — confirmar cobertura nos 742 CCs
2. Sem Onda 1, Inbox da Helena aparece vazia em 5 das 6 empresas
3. Sem cron `sup-aprov-sla-tick`, escalonamento das réguas é decorativo
4. Flag "Vincular orçamento?" muda lógica de `sup_aprov_abrir_instancia` — exige smoke test em 8 combinações antes de liberar
5. Promoção `mz_*` em produção é destrutiva — exige snapshot antes
6. Fluxo `licitacao_etapa` não cadastrado em nenhuma empresa — integração de licitação só responde "cadastre antes"

### 🚫 Backlog explícito (fora de escopo)
- Aprovação em lote ("Selecionar tudo" na Inbox)
- WhatsApp/SMS como canal
- Aprovação por papel/cargo (só por usuário hoje)
- Co-aprovação obrigatória (quórum total)
- Outras regras automáticas além de `orcamento_cc`
- Delegação por férias/substituto

---

## PARTE VI — Recomendação de SEQUÊNCIA (para você decidir depois)

Sugestão de ordem que **minimiza retrabalho** e respeita as dependências:

1. **Flag "Vincular orçamento?" 3 níveis** + UI + badge Requisição (rápido, alto valor, já é seu pedido pendente)
2. **Replicar migração Helena nas 6 empresas** + popular `gestor_user_id` faltantes em CCs
3. **Onda 1 Multiempresa** + **P0 segurança** (mesma migration — destrava Helena de verdade)
4. **Edge `sup-aprov-sla-tick` + cron + `notificacoes`** (destrava escalonamento)
5. **Toggles MeuPerfil + CRUD Réguas** (fecha pontas da Etapa 2)
6. **Smoke test end-to-end** nas 6 empresas
7. Cadastro de **fluxo `licitacao_etapa`** nas empresas que usam licitação
8. **Separar aprovar × executar** em Programação de Pagamentos
9. Promoção `mz_*` em produção (após decisão §8.1 da Auditoria V2)
10. `vw_presidencia_*` + Onda 2 Multiempresa
11. Roles operacionais em `screen_permission_profile`
12. Onda 3 e 4 Multiempresa
13. Cotação no motor unificado

---

**Nada será executado até você dizer "ok, começa por X".** Posso detalhar qualquer um dos itens acima como sub-plano antes de mexer em código/banco.
