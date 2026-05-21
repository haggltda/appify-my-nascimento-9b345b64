# Plano (Plan Mode / read-only) — Aprovação do Pré-Título pelo Dono do CC + Baixa Manual

Atualização incorporando as duas regras que você acabou de fixar:

1. **Sem integração bancária** — a baixa é manual, marcando (flag) os títulos efetivamente pagos.
2. **Sem alçada por valor / sem escalonamento** — quem aprova é o **dono do CC**, ponto. Notificação no sininho + fila "Aguardando minha aprovação" igual ao fluxo da Helena na programação.

## 1. Fluxo consolidado

```text
[1] Lançador      cria pré-título + rateio (CC + conta) + anexa NF
        ▼
[2] Dono do CC    aprova/reprova  (gestor_user_id do centro_custo do rateio)
                  → notificação no sininho
                  → entra em "Aguardando Minha Aprovação"
        ▼
[3] Financeiro    promove em título, monta malote, programa pagamento
        ▼
[4] Presidente    aprovação final da programação (Helena hoje, modelo já existe)
        ▼
[5] Baixa manual  usuário marca os títulos pagos (sem envio bancário)
        ▼
[6] Conciliação   futura, quando houver integração
```

## 2. Regra única de aprovador

- **Aprovador = `centros_custo.gestor_user_id**` do CC do rateio.
- **Sem faixa de valor.** Sem segunda etapa. Sem controladoria intermediária. Sem presidência na etapa do pré-título.
- **Rateio com N CCs** — precisa sua decisão (ver §5). Recomendação: **todos os donos de CC envolvidos aprovam em paralelo**, basta 1 reprovação para devolver. É o modelo mais alinhado com "cada um responde pelo seu CC", sem inventar regra de predominante.
- **Lançador = dono do CC:** bloquear autoaprovação. Cai para suplente (ver §5.3) ou volta para o lançador escolher outro responsável formalmente.
- **CC sem `gestor_user_id`:** bloquear submissão do pré-título com mensagem clara. Hoje 75,5% dos CCs (560 de 742) estão sem gestor — pré-requisito de cadastro.

## 3. Notificação + Inbox (paridade com fluxo da Helena)

A Helena hoje recebe:

- Badge no sininho quando há programação aguardando decisão dela.
- Card "Aguardando Minha Aprovação" na home/Presidência listando os lotes pendentes.

Replicar **exatamente esse padrão** para o dono do CC:

- Quando `pre_titulo_submeter` rodar, criar registro em `notificacoes` (ou tabela equivalente já usada pelo sininho) para cada dono de CC do rateio.
- Card/aba "Aguardando Minha Aprovação" filtrando pré-títulos onde o usuário logado é dono de pelo menos um CC do rateio e a etapa ainda está pendente.
- Ao aprovar/reprovar, baixar a notificação e registrar histórico.

## 4. Baixa manual (sem integração bancária)

- A programação de pagamento aprovada pela Presidente **não dispara nada externo**.
- Tela de baixa: lista títulos com `status='programado'` (ou equivalente), com checkbox por título, campo de data de pagamento e conta bancária debitada.
- Ao confirmar, marca `titulo_pagar.status='pago'`, grava `data_pagamento`, `conta_debitada`, `usuario_baixa`, e gera lançamento no fluxo de caixa realizado.
- **Permitir baixa parcial** (parcela a parcela) — bloquear baixa de título não programado e não aprovado.
- Esse passo substitui temporariamente o "envio ao banco" — quando integração existir, vira opcional/automático.

## 5. Decisões pendentes (preciso da sua confirmação)

1. **Rateio com N CCs:** todos os donos em paralelo (recomendado), ou só o do CC predominante? R:  todos em paralelo .
2. **Reprovação parcial:** se um dono aprova e outro reprova, devolve o pré-título inteiro, ou só o rateio reprovado? R: Devolve tudo.
3. **Suplente do gestor de CC:** criar `gestor_suplente_user_id` em `centros_custo` para férias/ausência? (recomendado) R: não aplicar ainda
4. **Lançador = dono do CC:** vai para suplente, vai para o nível acima na hierarquia de CC, ou bloqueia e obriga trocar o responsável? bloqueia e obriga a lançar o responsável corretamente
5. **Baixa manual — quem pode executar:** só Financeiro, ou Financeiro + Presidência? Finacneiro, Diretoria Administrativa e Presidencia
6. **Baixa retroativa:** permitir data de pagamento anterior à data de hoje? Até quantos dias? Permitir, até 90 dias.

## 6. O que muda em relação ao plano anterior


| Item                                                           | Plano anterior                             | Agora                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Alçada por valor                                               | Camada complementar via `alcada_aprovacao` | **Removida** — fora de escopo                                                                                            |
| Escalonamento (diretor/controladoria/presidente no pré-título) | Previsto acima de faixas                   | **Removido**                                                                                                             |
| `alcada_aprovacao`                                             | Seria refatorada                           | **Não tocar** — sem uso na v1                                                                                            |
| `sup_aprov_*`                                                  | Motor genérico com várias etapas           | Usar apenas para a **etapa única "dono do CC"** (ou implementação direta em `pre_titulo` se ficar mais simples — ver §7) |
| Presidente no pré-título                                       | Opção em estudo                            | **Não entra** no pré-título; segue só na programação, como já é hoje                                                     |
| Envio bancário                                                 | Pressuposto futuro                         | Explicitamente **fora de escopo**; baixa manual cobre o ciclo                                                            |


## 7. Detalhe técnico (não-bloqueante para sua decisão)

Como a regra ficou **uma única etapa** (dono do CC), há duas formas de implementar quando aprovado:

- **A. Reaproveitar `sup_aprov_***` — incluir `pre_titulo` no enum `sup_aprov_alvo`, fluxo de 1 etapa com `tipo_responsavel='gestor_cc_do_rateio'`. Vantagem: motor único para futuro. Custo: configuração e UI extra.
- **B. Implementação direta em `pre_titulo**` — campos `aprovador_user_id`, `aprovado_em`, `reprovado_em`, `motivo_reprovacao`; RPC `pre_titulo_aprovar` valida `auth.uid() = gestor_cc do rateio`. Vantagem: simples, rápido, casa com sua regra atual. Custo: se um dia voltar a alçada por valor, refatora.

Recomendação: **B** — menor risco, entrega mais rápida, e a regra "dono do CC" é estável o suficiente para não precisar do motor genérico agora.

## 8. Por que não implementar agora

- **Bloqueador de dados:** 560 CCs sem gestor. Ligar a regra antes da campanha de cadastro trava lançamentos no dia 1.
- **Bloqueadores de regra:** §5.1 (N CCs), §5.4 (lançador = dono), §5.5 (quem baixa) mudam materialmente a UI e as RPCs.
- **Decisão técnica:** §7 (A vs B) muda a estrutura de tabelas.

---

> Este plano foi elaborado em Plan Mode/read-only. Nenhuma alteração foi feita em banco, código, RPCs, RLS, policies, roles, notificações, telas ou deploy. Qualquer evolução depende de aprovação humana e da definição dos 6 itens em §5.