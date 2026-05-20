# Análise — Alçadas de aprovação e amarração ao processo

Status: ANÁLISE (sem implementação). Decisão sua se vamos para a Etapa 2.

---

## 1. Foto atual do sistema (o que já existe hoje)

Existem **três modelos paralelos** de aprovação convivendo no banco:

| Modelo | Tabelas | Finalidade atual | Estado |
|---|---|---|---|
| **A. Alçadas genéricas (legado)** | `alcada_aprovacao` | Cadastro "solto" de etapa + responsável + faixa de valor por empresa. Não está amarrado a nenhum processo. É só uma tabela de referência. | 1 registro (Helena/HAGG → agora 6 após Etapa 1) |
| **B. Aprovação de orçamento de contrato** | `aprov_etapa`, `aprov_instancia` | Fluxo específico do módulo Orçamento de Contrato (campo `orcamento_contrato_id`). | 18 etapas, 0 instâncias |
| **C. Aprovação de Suprimentos (novo)** | `sup_aprov_fluxo`, `sup_aprov_etapa`, `sup_aprov_aprovador`, `sup_aprov_instancia`, `sup_aprov_voto` | Modelo mais maduro: fluxo por **alvo** (requisição, cotação, pedido…), com etapas, modo (qualquer/todos/quórum) e múltiplos aprovadores. | 1 fluxo, 1 etapa, 0 aprovadores, 0 instâncias |
| **D. Aprovação de pagamento** | `financeiro_pagamento_aprovacao` | Específico do módulo financeiro/programação de pagamento. | Em uso |

### Diagnóstico

- **`alcada_aprovacao` (A) hoje é decorativa.** Cadastrar a Helena ali não faz o sistema reconhecê-la como aprovadora em lugar nenhum. Nenhum processo lê essa tabela para escalar aprovação.
- **`sup_aprov_*` (C) já é o modelo certo** (suporta múltiplos aprovadores, quórum, alvo configurável), mas está **vazio e desconectado da UI** — não tem tela de cadastro nem disparador em requisição/pedido/contratação.
- **Cada módulo (orçamento, suprimentos, pagamento) tem seu próprio motor.** Não há um motor único que pergunte "essa transação de R$ X, da empresa Y, do tipo Z, quem precisa aprovar e em qual ordem?".
- **A tela `AlcadasTab.tsx`** cadastra apenas: empresa, etapa (texto livre), responsável (usuário), valor_min/valor_max, exceção (texto livre). **Não pergunta:** *para qual processo?* nem *é "qualquer aprovador serve" ou "todos precisam aprovar"?* nem *é exigência adicional ou substitui etapas anteriores?*.

Resultado prático: hoje, mesmo cadastrando a Helena como "Presidência" em todas as 6 empresas, **nenhuma requisição, licitação ou pedido vai automaticamente para ela**.

---

## 2. O que você está pedindo (em linguagem de produto)

Você quer responder, em uma única tela, perguntas como:

> "Toda **requisição de compra** acima de **R$ 50 mil** da **AGPS** precisa passar por **Maiara (Financeiro) → Helena (Presidência)**, nessa ordem, e a Helena só vê na fila dela depois que a Maiara aprovar."

E:

> "Etapa **homologação** de **licitação** acima de **R$ 200 mil** exige aprovação de **qualquer um** entre **Diretor Operacional ou Helena**."

Ou seja, três dimensões precisam ser amarradas:

1. **Processo** (requisição, cotação, pedido de compra, contratação, etapa de licitação, programação de pagamento, contrato).
2. **Critério de disparo** (empresa, faixa de valor, centro de custo, categoria, exceções).
3. **Quem aprova e em que ordem** (etapas, modo paralelo/sequencial, quórum, substitutos).

---

## 3. Lacunas atuais vs. necessidade

| Necessidade | Existe hoje? | Onde está o gap |
|---|---|---|
| Catálogo de **processos aprováveis** (requisição, licitação-etapa-X, pedido…) | Parcial em `sup_aprov_fluxo.alvo` (enum) | Enum precisa cobrir todos os alvos; UI não expõe |
| Cadastro de **etapas com ordem + modo** (sequencial, paralelo, quórum) | Sim em `sup_aprov_etapa.modo` e `quorum_minimo` | Sem UI; não usado |
| **Múltiplos aprovadores por etapa** (por usuário ou por papel) | Sim em `sup_aprov_aprovador` | Sem UI; sem fallback por papel |
| **Critério de disparo por valor** | Sim em `sup_aprov_fluxo.valor_min/max` | Sem UI |
| **Critério por centro de custo / categoria / exceções** | Não | Faltam colunas e UI |
| **Disparador**: quando uma requisição é submetida, criar `sup_aprov_instancia` automaticamente | Não | Falta trigger ou edge function |
| **Inbox unificada de "minhas aprovações"** (Inbox.tsx existe mas só lê `aprov_instancia` do orçamento) | Parcial | Precisa consolidar A+B+C+D |
| **Travas reais** (sistema bloquear avanço enquanto pendente) | Parcial no orçamento; ausente em requisição/licitação/pedido | Falta gate em cada módulo |
| **Notificação ao aprovador** (e-mail + push + badge) | Não | Edge function pendente |
| **Substituto / férias / delegação** | Não | Faltam colunas e UI |
| **Trilha de auditoria** (quem aprovou, quando, IP, justificativa) | Parcial em `sup_aprov_voto` | OK estrutural; falta exposição |
| **Validação cruzada com RLS** | Sim (após Etapa 1) | OK |

---

## 4. Modelo recomendado (sem implementar agora)

### 4.1. Consolidar em **um único motor**: `sup_aprov_*`

Aposentar (em médio prazo) `alcada_aprovacao` e `aprov_etapa/aprov_instancia` — migrar tudo para `sup_aprov_fluxo`. Razões:
- Suporta múltiplos aprovadores, quórum, paralelo/sequencial.
- Já tem `alvo` (enum) para diferenciar processo.
- Já tem voto separado (auditoria limpa).

### 4.2. Expandir o `alvo` para cobrir todos os processos

Enum atual cobre suprimentos. Adicionar (quando chegar a hora):
- `licitacao_etapa_X` (uma chave por etapa que precise gate)
- `contratacao` (futuro)
- `programacao_pagamento` (unificar com `financeiro_pagamento_aprovacao`)
- `orcamento_contrato` (unificar com `aprov_etapa`)

### 4.3. Acrescentar critérios além de valor

Sugestão de novas colunas em `sup_aprov_fluxo`:
- `centro_custo_ids uuid[]` (vazio = qualquer)
- `categoria_ids uuid[]` (vazio = qualquer)
- `condicao_extra jsonb` (regras avançadas: margem < X%, fornecedor novo, etc.)
- `requer_anexo boolean`
- `prazo_horas int` (SLA — vencido escalar para o próximo)

### 4.4. Aprovador por **papel** (não só por usuário)

Em `sup_aprov_aprovador` já existe `role` e `user_id`. Convenção:
- Se `user_id` preenchido → aquele usuário específico.
- Se `role` preenchido → qualquer usuário com aquela role + `user_pode_atuar_empresa` na empresa do registro.

Isso resolve o caso "se a Maiara sair de férias, o substituto do Financeiro aprova" sem reabrir cadastro.

### 4.5. Delegação temporária

Tabela nova `aprov_delegacao` (de_user_id, para_user_id, inicio, fim, escopo). Edge function lê isso ao montar a fila.

### 4.6. Disparador automático

Trigger em cada tabela-fonte (`requisicao_compra`, `pedido_compra`, `licitacao`, `programacao_pagamento`) que, quando muda para status "aguardando aprovação", chama uma função `aprov_criar_instancia(alvo, ref_id, empresa_id, valor)` que:
1. Encontra o fluxo correto.
2. Cria `sup_aprov_instancia` com a primeira etapa pendente.
3. Notifica aprovadores.
4. Cada voto chama `aprov_registrar_voto` → se etapa fechou, abre a próxima ou conclui.

### 4.7. Trava no fluxo de negócio

Em cada módulo, adicionar verificação `aprov_status(alvo, ref_id) = 'aprovado'` antes de permitir transição para o próximo estado (ex.: pedido só vira "liberado para compra" se aprovação concluída).

---

## 5. Como a tela de cadastro deve ser (UX recomendada)

A `AlcadasTab` atual é uma **tabela CRUD genérica**. Para virar uma ferramenta de governança, sugiro reformular em **3 abas + assistente passo-a-passo**:

### Aba 1 — Fluxos por processo (visão "o que aprova o quê")

Cards agrupados por processo:

```
┌─ Requisição de compra ─────────────────────────────┐
│  HAGG · até R$ 10k         → Aprovação automática  │
│  HAGG · R$ 10k a R$ 50k    → Gerente Financeiro    │
│  HAGG · acima de R$ 50k    → Financeiro → Helena   │
│  [+ Novo fluxo para HAGG]   [Copiar para outra empresa] │
└────────────────────────────────────────────────────┘
```

Cada linha é clicável e abre o editor visual da etapa.

### Aba 2 — Pessoas e papéis (visão "quem aprova")

Lista por usuário: "Helena Nascimento aprova em **6 empresas**, **4 processos**, faixa R$ 0 – ∞. Ver detalhes ↗"

Permite ver de cara se alguém ficou sem cobertura ou com excesso.

### Aba 3 — Simulador

Campo "se eu emitir uma requisição de R$ 75.000 na CANAA hoje, quem precisa aprovar?" → mostra o trajeto previsto. Crítico para confiança da Helena antes de ativar.

### Assistente "Novo fluxo" (substitui o dialog atual)

Wizard de 4 passos:

1. **Para qual processo?** (chips visuais: Requisição · Licitação · Pedido · Pagamento · Contrato · …)
2. **Quando esse fluxo se aplica?** (empresa, faixa de valor, centro de custo opcional, exceção opcional)
3. **Quem aprova e em qual ordem?** (linha do tempo arrastável — etapas em sequência ou paralelo, com toggle "qualquer um / todos / quórum mínimo X")
4. **Revisão + Simulação** (mostra um caso concreto: "Requisição de R$ 30k da AGPS → Maiara aprova → fim")

Ganhos:
- Tira ambiguidade ("etapa" texto livre vira escolha estruturada).
- Permite copiar fluxo entre empresas (resolve o problema da Helena ter que ser cadastrada 6 vezes).
- Simulador dá confiança de que a configuração faz o que você espera **antes** de virar produção.

---

## 6. Riscos se mantivermos o modelo atual

| Risco | Probabilidade | Impacto |
|---|---|---|
| Helena cadastrada como "Presidência" e ninguém nunca pedindo aprovação dela (porque nada amarra) | **Alta** (hoje é assim) | Falsa sensação de governança |
| Aprovações fora do sistema (e-mail/WhatsApp), sem trilha | Alta | Auditoria não-conforme |
| Conflito entre os 3 motores (orçamento aprovou, mas pagamento exige outra etapa) | Média | Retrabalho, atritos |
| Cadastro duplicado por empresa (já vimos com a Helena) | Alta | Manutenção cara |
| Sem substituto/delegação → processo trava em férias | Alta | Bloqueio operacional |

---

## 7. Recomendação de sequenciamento (para você decidir)

Não precisa fazer tudo junto. Sugestão:

- **Etapa 2 (próxima, se aprovar):** UI nova para `sup_aprov_*` + amarração no **primeiro** processo (Requisição de compra), incluindo simulador. Deprecate visual de `alcada_aprovacao` (vira "legado, só leitura").
- **Etapa 3:** Estender para Licitação (etapa a etapa) e Pedido de compra.
- **Etapa 4:** Unificar `financeiro_pagamento_aprovacao` e `aprov_etapa` (orçamento) no motor único.
- **Etapa 5:** Delegação, SLA e escalonamento automático.

---

## 8. Autoavaliação (perguntas que me fiz antes de fechar)

- **Cobri todas as variáveis?** Sim: processo, critério, ordem, modo, substituto, SLA, auditoria, RLS, UX, migração dos dados legados.
- **Pensei na experiência do gestor?** Sim: o ponto mais sensível é o **simulador** + **copiar fluxo entre empresas** — sem isso, configurar 6 empresas é desumano.
- **Pensei no aprovador?** Inbox unificada (não 3 telas), notificação por e-mail, justificativa obrigatória em reprovação.
- **Pensei no auditor?** Trilha imutável via `sup_aprov_voto` + log de delegação.
- **Há sugestão nova que vale destacar?** Sim, duas:
  1. **Modo "co-aprovação obrigatória"** (todos da etapa precisam aprovar) — útil para contratações estratégicas.
  2. **Aprovação por papel + filtro empresa** (em vez de cadastrar usuário) — reduz manutenção quando o time muda.
- **Algum fluxo de frontend quebraria se mudarmos agora?** Sim, `AlcadasTab` e `Inbox`. Por isso a recomendação é **fazer em Etapa 2**, não junto da Etapa 1.

---

## 9. Decisões que dependem de você

1. Mantenho `alcada_aprovacao` apenas como legado (read-only) e construo a nova UI sobre `sup_aprov_*`? **(sim/não)**
2. O primeiro processo a ser amarrado de verdade é **Requisição de compra**? **(sim/não/outro)**
3. Quer que eu já preveja **delegação e SLA** na Etapa 2 ou deixa para Etapa 5? **(agora/depois)**
4. Top-3 alvos prioritários além de requisição (para eu dimensionar)?

Aguardo sua decisão para abrir o planejamento da Etapa 2.

---

## Decisões do usuário (respostas)

1. **Aprovador**: por **colaborador específico** (usuário cadastrado). Papel/cargo fica para futuro.
2. **Tipos de parecer**: **Bloqueante**, **Consultivo**, **Ciência** (3 níveis).
3. **Regras automáticas**: apenas **Orçamento do centro de custo** (sem saldo → escala).
4. **Piloto Etapa 2**: **Requisição de compra + Licitação + Programação de pagamento** em paralelo.

## Implicações para o modelo de dados (Etapa 2)

- `sup_aprov_etapa` ganha coluna `tipo_parecer` enum (`bloqueante`, `consultivo`, `ciencia`).
- Engine de fechamento de instância considera só etapas bloqueantes para decidir aprovado/reprovado; consultivas/ciência geram registro mas **não travam**.
- `sup_aprov_etapa` mantém `responsavel_user_id` (FK profiles). Não cria coluna `role` agora.
- Nova função `tem_orcamento_cc(centro_custo_id, valor, periodo)` → trigger pré-aprovação: se OK e regra ativa, fecha automaticamente; senão, despacha para próxima etapa.
- `alvo` enum cobre: `requisicao_compra`, `licitacao_etapa`, `programacao_pagamento`.
- Para licitação: etapas SST + Controladoria como **consultivas**, Diretor Operacional como **bloqueante única**, Presidência como **bloqueante acima de X** (configurável).

## Próximo passo

Apresentar o **plano técnico Etapa 2** (migration + UI wizard + dispatcher) para aprovação antes de codar.
