# Etapa 2 — Motor unificado de Alçadas de Aprovação

Objetivo: substituir os 3 mecanismos atuais (`alcada_aprovacao`, `financeiro_pagamento_aprovacao`, `aprov_etapa`) por um motor único `sup_aprov_*` que cobre Requisição de compra, **Pedido de compra (pós-cotação)**, Licitação e Programação de pagamento — com 3 tipos de parecer (bloqueante / consultivo / ciência), regra automática de orçamento de CC, delegação, SLA com escalonamento, e migração automática dos registros legados.

> **Fluxo Suprimentos completo considerado:**
> Requisição → (a) **se há saldo no almoxarifado**: retira material e **encerra sem aprovação de compra**; (b) **se não há**: vai para **cotação** → após cotação recebida, gera **Pedido de compra** → **o Pedido entra em aprovação** (é aqui que a alçada de valor + regra de orçamento de CC atuam, não na requisição em si).
>
> A regra automática de orçamento de CC é controlada por **flag por empresa/processo** (`auto_aprovar_se_orcamento_cc`) e respeita a **vigência do orçamento** (período em curso). Se a flag estiver ativa e houver saldo no CC dentro do período: etapa marcada `auto_aprovado` e o fluxo avança. Caso contrário: vai para o aprovador humano.

---

## 1. Mudanças de banco (migration)

### 1.1 Novos enums
- `sup_aprov_alvo`: `requisicao_compra`, `licitacao_etapa`, `programacao_pagamento`
- `sup_aprov_tipo_parecer`: `bloqueante`, `consultivo`, `ciencia`
- `sup_aprov_status`: `pendente`, `aprovado`, `reprovado`, `auto_aprovado`, `cancelado`
- `sup_aprov_criticidade`: `normal`, `urgente`, `critico`

### 1.2 Tabelas (todas com RLS por `empresa_id`)
- **`sup_aprov_fluxo`** — fluxo nomeado por empresa+alvo (ex.: "Requisição padrão"). Campos: `empresa_id`, `alvo`, `nome`, `ativo`, `regua_escalonamento_id`.
- **`sup_aprov_etapa`** — etapas ordenadas do fluxo. Campos: `fluxo_id`, `ordem`, `nome`, `tipo_parecer`, `responsavel_user_id` (FK profiles), `delegado_para_user_id`, `delegado_ate`, `valor_min`, `valor_max`, `criticidade`, `prazo_horas`, `regra_auto` (jsonb — ex.: `{"tipo":"orcamento_cc"}`), `ativo`.
- **`sup_aprov_instancia`** — uma execução do fluxo para um documento real. Campos: `fluxo_id`, `alvo`, `referencia_id` (uuid do doc), `referencia_codigo` (string p/ UI), `valor`, `centro_custo_id`, `status`, `aberta_em`, `fechada_em`, `solicitante_user_id`.
- **`sup_aprov_voto`** — voto de cada etapa. Campos: `instancia_id`, `etapa_id`, `usuario_id` (quem votou de fato, pode ser delegado), `parecer` (aprovado/reprovado/ciencia), `justificativa`, `votado_em`. Trilha imutável (sem update/delete).
- **`sup_aprov_regua_escalonamento`** + **`sup_aprov_regua_degrau`** — réguas reutilizáveis (Normal/Urgente/Crítico) com degraus `pct_prazo` ou `horas_extra`, `destinatarios` (jsonb: self/gestor/diretor/presidencia), `canais` (jsonb: sininho/email/push).
- **`sup_aprov_alerta_log`** — idempotência: 1 alerta por (instancia, etapa, degrau). Evita reenvio.
- **`sup_aprov_notif_pref`** — preferências por usuário: `email_ativo`, `push_ativo`, `sininho_ativo`.

### 1.3 Alterações em tabelas existentes
- `empresas`: nova coluna `diretor_user_id` (FK profiles, nullable).
- `centros_custo`: confirmar `gestor_user_id` (já existe; se não, criar).
- `alcada_aprovacao`: marcar como **legado** via comentário + RLS read-only (manter para auditoria; nova UI não escreve mais nela).

### 1.4 Funções e triggers
- `has_role(uuid, app_role)` — já existe, reutilizar.
- **`sup_aprov_tem_orcamento_cc(centro_custo_id, valor, periodo)`** — retorna boolean. Lê saldo do CC no período corrente.
- **`sup_aprov_abrir_instancia(fluxo_id, ref_id, ref_codigo, valor, cc_id, solicitante)`** — cria instância, processa primeira etapa: se regra `orcamento_cc` aprovar, marca etapa como `auto_aprovado` e avança; senão, mantém pendente e dispara notificação.
- **`sup_aprov_registrar_voto(instancia_id, etapa_id, parecer, justificativa)`** — valida que quem chama é o responsável (ou delegado dentro do prazo), grava em `sup_aprov_voto`, recalcula status da instância (só bloqueantes decidem; reprovado bloqueante encerra reprovado; todas bloqueantes aprovadas encerra aprovado).
- Trigger **`after insert sup_aprov_voto`** para fechar instância quando aplicável.
- **`sup_aprov_pendentes_do_usuario(uid)`** — view/RPC para Inbox unificada.

### 1.5 RLS (resumo)
- `SELECT` em todas as tabelas: por `empresa_id` do usuário (já há helper).
- `INSERT/UPDATE` em fluxos/etapas/réguas: só `admin`.
- `INSERT` em `sup_aprov_voto`: só responsável da etapa ou delegado vigente, validado em função `security definer`.

### 1.6 Cron (pg_cron + pg_net)
- Job a cada 15 min chama edge function `sup-aprov-sla-tick` que:
  - Lê instâncias pendentes.
  - Para cada etapa pendente, calcula `horas_paradas` vs `prazo_horas` e percorre degraus da régua.
  - Para cada degrau não logado em `sup_aprov_alerta_log`, monta lista de destinatários (self / gestor do CC / `empresas.diretor_user_id` / `presidencia`) e envia pelos canais ativos respeitando `sup_aprov_notif_pref`.

### 1.7 Migração automática (Helena → 6 empresas)
Script SQL idempotente dentro da migration:
- Para cada linha existente em `alcada_aprovacao` (escopo: Helena, alvo Programação de pagamento):
  - Cria/recupera `sup_aprov_fluxo` (empresa, alvo `programacao_pagamento`, nome "Aprovação Presidência (migrado)").
  - Cria `sup_aprov_etapa` única: bloqueante, responsavel_user_id = Helena, **valor_min = 0**, valor_max = mesmo do registro (ou nulo).
  - Associa régua "Normal" padrão.
- Marca `alcada_aprovacao` como legado (não apaga).

---

## 2. Edge functions

- **`sup-aprov-sla-tick`** — chamado pelo cron, processa SLA e enfileira notificações (insere em `notificacoes` + envia email via Resend se houver secret).
- **`sup-aprov-notify`** (opcional) — utilitário interno chamado pela tick function para dispatch multicanal.

(Se já existir `notificacoes` e função de envio, reutiliza. Caso contrário, criamos `notificacoes` simples com `user_id`, `tipo`, `payload`, `lido_em`.)

---

## 3. Frontend

### 3.1 Administração → Alçadas de aprovação (reescrita da `AlcadasTab`)
3 abas dentro do card:
- **Fluxos** — lista por empresa e alvo. Botão "Novo fluxo" abre wizard:
  1. Empresa + alvo + nome.
  2. Etapas (drag-to-reorder): nome, tipo de parecer (chip colorido), responsável (combobox de profiles), faixa de valor, criticidade, prazo (h), regra automática (checkbox "auto-aprovar se há saldo no CC").
  3. Régua de escalonamento (select).
  4. Revisão + "Copiar para outras empresas" (multi-select).
- **Réguas de escalonamento** — CRUD de réguas com tabela de degraus inline (% prazo / horas extra, destinatários, canais).
- **Legado** — leitura da `alcada_aprovacao` (banner explicando que está congelada).

### 3.2 Inbox de aprovações (`/app/aprovacoes`)
- Lista unificada via `sup_aprov_pendentes_do_usuario`.
- Filtros: alvo, criticidade, empresa.
- Cada card mostra: documento, valor, CC, etapa atual, tempo parado vs SLA (chip verde/âmbar/vermelho).
- Ações: **Aprovar** / **Reprovar** (justificativa obrigatória) / **Dar ciência** (só etapas ciência).
- Backlog: ainda **sem "Selecionar tudo"** (anotado para próxima iteração).

### 3.3 Meu perfil → Notificações
Toggles: sininho, e-mail, push PWA.

### 3.4 Integração nos 3 processos piloto
- **Requisição de compra** (`Requisicoes.tsx`): ao salvar, chama `sup_aprov_abrir_instancia`. Tela detalhe mostra timeline da instância.
- **Licitação**: idem em pontos definidos das etapas (SST/Controladoria como consultivos já existentes viram etapas do fluxo).
- **Programação de pagamento**: substituir gating atual pela instância nova.

### 3.5 Componentes compartilhados
- `<TimelineAprovacao instanciaId>` — usado em Requisição, Licitação e Pagamento.
- `<SlaChip horasParadas prazo criticidade>`.
- `<TipoParecerBadge tipo>`.

---

## 4. Ordem de implementação (sub-etapas)

1. Migration SQL completa (enums, tabelas, RLS, funções, trigger, alteração `empresas`).
2. Script de migração da Helena (dentro da mesma migration ou separada — sua escolha).
3. Edge function `sup-aprov-sla-tick` + cron a cada 15 min.
4. Tela Administração reescrita (fluxos + réguas + legado).
5. Inbox unificada.
6. Integração no 1º processo (Requisição) + componentes compartilhados.
7. Integração em Licitação e Programação de pagamento.
8. Tela Meu perfil → Notificações.
9. Smoke test guiado: criar requisição → instância abre → Helena recebe → aprova → segue.

---

## 5. O que **não** entra agora (backlog explícito)

- Aprovação em lote ("Selecionar tudo" na Inbox).
- WhatsApp/SMS.
- Aprovação por papel/cargo (só usuário específico por enquanto).
- Co-aprovação obrigatória (todos da mesma etapa aprovam).
- Outras regras automáticas além de orçamento do CC.

---

## 6. Riscos e mitigações

- **Volume de notificações**: idempotência via `sup_aprov_alerta_log` evita reenvio do mesmo degrau.
- **Quebra dos 3 processos pilotos**: feature flag `vNEW_APROV` por empresa permite ativar gradualmente; fallback mantém comportamento atual até a flag virar.
- **Migração da Helena**: idempotente (verifica se fluxo equivalente já existe antes de criar).

---

## 7. Custo estimado

~3 créditos (migration grande + 1 edge function + reescrita de 2 telas + integração em 3 processos + componentes compartilhados).
