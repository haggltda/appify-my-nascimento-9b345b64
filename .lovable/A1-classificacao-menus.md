# A1 — Classificação de menus (Bloco V4)

**Data:** 2026-05-28
**Fonte:** snapshot read-only de `public.app_menu` (filtro `ativo = true`) em 2026-05-28, com join em `app_modulo` para o código de módulo.
**Objetivo:** rotular cada `app_menu.codigo` em uma de quatro classes de governança, conforme exigido pelo PACOTE A1 V2 §1.4.X. Pré-requisito para qualquer alteração futura em `useAccessibleMenus`, `RouteGuard`, `can_access` ou `list_accessible_menus`.

## Classes

| Classe | Definição | Comportamento esperado do guard |
|---|---|---|
| **EMPRESARIAL** | Dados/decisões pertencem a 1 empresa por vez. RLS filtra por `empresa_id`. | Honrar `empresaId` ativo no `_empresa` do RPC. Override por empresa em SPU vale. |
| **CORPORATIVO** | Visão consolidada multi-empresa por natureza (BI, painéis, controladoria de grupo, presidência, estrutura organizacional, plano de contas/regras globais). | **Não** filtrar pela empresa ativa. Override global em SPU (`empresa_id=null`) é o esperado. Travar tentativa de bloqueio por empresa ativa. |
| **ADMINISTRATIVO_GLOBAL** | Pertence à administração do ERP (usuários, permissões, integrações, migrações, ajuda). Governado por role/perfil, não por empresa. | Acesso por role admin (ou roles administrativos delegados). Empresa ativa é irrelevante. |
| **INDEFINIDO** | Comportamento ambíguo ou ainda não decidido. **Trava em PLAN MODE** até classificação humana. | Não alterar lógica de menu sem decisão registrada aqui. |

## Matriz oficial

### Módulo `admin` — ADMINISTRATIVO_GLOBAL

| codigo | rota | classe | nota |
|---|---|---|---|
| administracao | /app/administracao | ADMINISTRATIVO_GLOBAL | Configurações do ERP |
| acessos-permissoes | /app/admin/permissoes | ADMINISTRATIVO_GLOBAL | Governança de acessos |
| migracao-zero | /app/admin/migracao-zero | ADMINISTRATIVO_GLOBAL | Migração técnica |
| integracao | /app/integracao | ADMINISTRATIVO_GLOBAL | Integrações técnicas |
| integracao-aliases | /app/integracao/aliases | ADMINISTRATIVO_GLOBAL | Aliases de integração |
| ajuda | /app/ajuda | ADMINISTRATIVO_GLOBAL | Central de ajuda (público interno) |

### Módulo `bi` — CORPORATIVO

| codigo | rota | classe | nota |
|---|---|---|---|
| principal (bi) | /app/bi | CORPORATIVO | Painel consolidado de BI |

### Módulo `licitacoes` — CORPORATIVO (executivos) + EMPRESARIAL (operação)

| codigo | rota | classe | nota |
|---|---|---|---|
| painel-executivo | /app/painel-executivo | CORPORATIVO | Visão executiva multi-empresa |
| presidencia | /app/presidencia | CORPORATIVO | Presidência (visão consolidada) |
| pipeline | /app/pipeline | EMPRESARIAL | Pipeline por empresa licitante |
| editais | /app/editais | EMPRESARIAL | Cadastro por empresa |
| documentos | /app/documentos | EMPRESARIAL | Documentos por edital/empresa |
| triagem | /app/triagem | INDEFINIDO | **Bloqueado por flag soberana `triagemIA` (Bloco V3).** Fora da Fase 1. Não reclassificar enquanto fase estiver fechada. |
| composicao | /app/composicao | EMPRESARIAL | Composição por proposta |
| custos-bdi | /app/custos-bdi | EMPRESARIAL | Custos por proposta |
| aprovacoes | /app/aprovacoes | EMPRESARIAL | Aprovações de propostas |
| aprovacoes-inbox | /app/aprovacoes/inbox | EMPRESARIAL | Inbox por usuário, escopo empresa |
| parecer-tecnico | /app/parecer-tecnico | EMPRESARIAL | Por proposta |
| parecer-sst | /app/parecer-sst | EMPRESARIAL | Por proposta |
| parecer-juridico | /app/parecer-juridico | EMPRESARIAL | Por proposta |
| parecer-controladoria | /app/parecer-controladoria | EMPRESARIAL | Por proposta |
| parecer-dir-operacional | /app/parecer-dir-operacional | EMPRESARIAL | Por proposta |
| parecer-dir-administrativo | /app/parecer-dir-administrativo | EMPRESARIAL | Por proposta |
| parecer-gerencial | /app/parecer-gerencial | EMPRESARIAL | Por proposta |
| controladoria-licit | /app/controladoria | EMPRESARIAL | Controladoria de licitação por proposta |
| resultado | /app/resultado | EMPRESARIAL | Resultado por proposta |
| prontas-contrato | /app/prontas-contrato | EMPRESARIAL | Pré-contrato por empresa |
| historico | /app/historico | EMPRESARIAL | Histórico por empresa |

### Módulo `contratos` — EMPRESARIAL

| codigo | rota | classe |
|---|---|---|
| ativos | /app/contratos/ativos | EMPRESARIAL |
| implantacao | /app/contratos/implantacao | EMPRESARIAL |
| empenhos | /app/contratos/empenhos | EMPRESARIAL |
| medicoes | /app/contratos/medicoes | EMPRESARIAL |
| postos | /app/contratos/postos | EMPRESARIAL |
| faturamento | /app/contratos/faturamento | EMPRESARIAL |
| reajustes | /app/contratos/reajustes | EMPRESARIAL |
| encerramentos | /app/contratos/encerramentos | EMPRESARIAL |
| contrato-detalhe | /app/contratos/:id | EMPRESARIAL |

### Módulo `financeiro` — EMPRESARIAL (todas)

| codigo | rota | classe | nota |
|---|---|---|---|
| contas-pagar | /app/financeiro/contas-pagar | EMPRESARIAL | RLS por empresa |
| contas-receber | /app/financeiro/contas-receber | EMPRESARIAL | |
| fluxo | /app/financeiro/fluxo-caixa | EMPRESARIAL | |
| fluxo-caixa-diario | /app/financeiro/fluxo-caixa-diario | EMPRESARIAL | |
| capital-giro | /app/financeiro/capital-giro | EMPRESARIAL | |
| programacao | /app/financeiro/programacao-pagamentos | EMPRESARIAL | Pipeline pagamento → presidência |
| conciliacao-fluxo | /app/financeiro/conciliacao-fluxo-caixa | EMPRESARIAL | |
| contas-bancarias | /app/financeiro/contas-bancarias | EMPRESARIAL | |
| validacao | /app/financeiro/validacao-pos-pagamento | EMPRESARIAL | |
| movimentos-bancarios | /app/financeiro/movimentos | EMPRESARIAL | |
| integracao-bancaria | /app/financeiro/integracao-bancaria | EMPRESARIAL | |

### Módulo `fiscal` — EMPRESARIAL

| codigo | rota | classe |
|---|---|---|
| principal (fiscal) | /app/fiscal | EMPRESARIAL |

### Módulo `contabil` — misto

| codigo | rota | classe | nota |
|---|---|---|---|
| lancamentos | /app/contabil/lancamentos | EMPRESARIAL | Lançamento por empresa |
| aprovacao-contas | /app/contabil/aprovacao-contas | EMPRESARIAL | |
| balancete | /app/contabil/balancete | EMPRESARIAL | Por empresa |
| razao | /app/contabil/razao | EMPRESARIAL | Por empresa |
| dre-gerencial-real | /app/contabil/dre-gerencial-real | EMPRESARIAL | Por empresa |
| conciliacao-eventos | /app/contabil/conciliacao-eventos | EMPRESARIAL | |
| plano-contas | /app/contabil/plano-contas | CORPORATIVO | Plano de contas é estrutura global do grupo |
| avancada | /app/contabil/avancada | CORPORATIVO | Regras globais de contabilização |

### Módulo `controladoria` — CORPORATIVO

| codigo | rota | classe | nota |
|---|---|---|---|
| empresas | /app/co/empresas | CORPORATIVO | Cadastro de empresas do grupo |
| cc | /app/co/centros-custo | CORPORATIVO | CC do grupo |
| dre | /app/co/dre | CORPORATIVO | Linhas DRE do grupo |
| estrutura-organizacional | /app/co/estrutura-organizacional | CORPORATIVO | |
| obz | /app/co/obz | CORPORATIVO | |
| classificadores | /app/co/classificadores | CORPORATIVO | |
| obz-versoes | /app/co/obz-versoes | CORPORATIVO | |
| dre-gerencial | /app/co/dre-gerencial | CORPORATIVO | Consolidado |
| orcamento | /app/orcamento | CORPORATIVO | Orçamento do grupo |

### Módulo `plano_acoes` — CORPORATIVO

| codigo | rota | classe |
|---|---|---|
| plano_acoes_lista | /app/plano-acoes | CORPORATIVO |
| plano_acoes_dashboard | /app/plano-acoes/dashboard | CORPORATIVO |
| plano_acoes_kanban | /app/plano-acoes/kanban | CORPORATIVO |
| plano_acoes_importar | /app/plano-acoes/importar | CORPORATIVO |
| plano_acoes_aprovacoes | /app/plano-acoes/aprovacoes | CORPORATIVO |
| plano_acoes_configuracoes | /app/plano-acoes/configuracoes | CORPORATIVO |
| copiloto_ia | /app/plano-acoes/copiloto | DEPRECATED | **Desativado permanentemente** (decisão 2026-05-28). Bloqueado pelo `RouteGuard` sob a mesma flag soberana `triagemIA`. Nenhum usuário final do ERP deve acessar. |

### Módulo `rh` — EMPRESARIAL

| codigo | rota | classe |
|---|---|---|
| colaboradores | /app/rh/colaboradores | EMPRESARIAL |
| alocacoes | /app/rh/alocacoes | EMPRESARIAL |
| folha | /app/rh/folha | EMPRESARIAL |

### Módulo `suprimentos` — EMPRESARIAL (compra/estoque) + CORPORATIVO (cadastros globais)

| codigo | rota | classe | nota |
|---|---|---|---|
| fornecedores | /app/suprimentos/fornecedores | CORPORATIVO | Cadastro de fornecedor é do grupo |
| produtos-servicos | /app/suprimentos/produtos-servicos | CORPORATIVO | Catálogo do grupo |
| produtos | /app/suprimentos/produtos | CORPORATIVO | |
| categorias | /app/suprimentos/categorias | CORPORATIVO | |
| almoxarifados | /app/suprimentos/almoxarifados | EMPRESARIAL | Estoque físico por empresa |
| estoque | /app/suprimentos/estoque | EMPRESARIAL | |
| movimentos | /app/suprimentos/movimentos | EMPRESARIAL | |
| nf-entrada | /app/suprimentos/nf-entrada | EMPRESARIAL | NF por empresa destinatária |
| requisicoes | /app/suprimentos/requisicoes | EMPRESARIAL | |
| pedidos | /app/suprimentos/pedidos | EMPRESARIAL | |
| aprovacoes (suprimentos) | /app/suprimentos/aprovacoes | EMPRESARIAL | |
| recebimentos | /app/suprimentos/recebimentos | EMPRESARIAL | |
| cotacoes | /app/suprimentos/cotacoes | EMPRESARIAL | |

## Itens DEPRECATED — desativados permanentemente

| codigo | rota | flag de bloqueio | decisão |
|---|---|---|---|
| triagem (licitacoes) | /app/triagem | `triagemIA` (default `false`) | Decisão 2026-05-28: Triagem IA não será mais ativada. Bloqueado no `RouteGuard`. |
| copiloto_ia (plano_acoes) | /app/plano-acoes/copiloto | `triagemIA` (mesma flag) | Decisão 2026-05-28: Copiloto IA não será mais ativado. Mesma natureza de IA Fase 1. Bloqueado no `RouteGuard`. |

> **Guardião — alerta residual:** os registros em `app_menu` para `triagem` e `copiloto_ia` ainda estão `ativo = true`, portanto ainda aparecem na barra lateral para quem tem permissão de menu. O `RouteGuard` impede o acesso, mas a presença visual pode gerar tentativas e ruído. **Recomendação:** migration futura para `UPDATE app_menu SET ativo = false WHERE codigo IN ('triagem','copiloto_ia')` — não executada agora porque foge do escopo do V4 (classificação) e exige confirmação para perder o histórico de menu. Aguarda aprovação humana explícita.

## Itens potencialmente faltantes em `app_menu` (gap não-bloqueante)

Detectados em `App.tsx` / `RouteGuard.allowlist` mas sem registro em `app_menu` ativo:

- `/app/admin/smoke-helena` (role-restricted admin, OK)
- `/app/meu-perfil`, `/app` (allowlist técnica, OK)
- `/app/co/orcamento-completo` — pendente cadastro (TODO B2.x já anotado em código)
- `/app/contabil/razao-detalhado` — pendente cadastro (TODO B2.x já anotado em código)

Esses gaps são técnicos e não invalidam a classificação. Devem migrar para `app_menu` em bloco futuro.

## Reclassificações confirmadas (decisão 2026-05-28)

Itens revisados e mantidos como **CORPORATIVO** por decisão de negócio:
`fornecedores`, `produtos`, `produtos-servicos`, `categorias` (suprimentos), `plano-contas`, `avancada` (contabilidade). Cadastros e regras tratados como estrutura global do grupo, não segregados por empresa.

## Regras operacionais derivadas

1. **Antes de bloquear um menu pela empresa ativa**, conferir se é `CORPORATIVO` — se for, **não filtrar**.
2. **Override por empresa em `screen_permission_user`** só faz sentido em menus `EMPRESARIAL`. Para `CORPORATIVO` e `ADMINISTRATIVO_GLOBAL`, exigir `empresa_id=null` (override global).
3. **Menus `DEPRECATED`** são tratados como negados por padrão. A flag soberana de fase prevalece sobre qualquer bypass (inclusive admin).
4. **Adição de novo menu em `app_menu`** deve vir acompanhada de classificação aqui, antes de ir para produção.

## Status

Documento aceito (decisões humanas 2026-05-28 incorporadas). Copiloto IA bloqueado no `RouteGuard` sob a flag `triagemIA`. Próximo bloco candidato: V1/V2 (smoke tests) ou V5 (introspecção read-only de `pg_policies` e RPCs).
