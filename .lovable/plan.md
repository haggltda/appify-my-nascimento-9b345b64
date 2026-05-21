# Plano (Plan Mode / read-only) — Pré-Título: Aprovação pelo Dono do CC + Parcelamento da NF + Baixa Manual

Atualização incorporando a nova regra de **parcelamento da NF** (vencimentos acordados com o fornecedor), além das regras já fixadas: aprovação por dono do CC, sem alçada por valor, baixa manual.

---

## 1. Fluxo consolidado

```text
[1] Lançador      cria pré-título
                  + parcelamento da NF (1..N parcelas, datas e valores)
                  + rateio por CC/conta (obrigatório, mesmo 1 linha)
                  + anexa NF
        ▼
[2] Dono do CC    aprova/reprova (gestor_user_id do CC do rateio)
                  → notificação no sininho + "Aguardando Minha Aprovação"
        ▼
[3] Financeiro    promove o pré-título → gera 1 título por parcela
                  monta malote, programa pagamento
        ▼
[4] Presidente    aprova a programação (modelo Helena já existente)
        ▼
[5] Baixa manual  marca parcelas pagas (Financeiro/Dir. Adm./Presidência)
        ▼
[6] Conciliação   futura (quando houver integração bancária)
```

---

## 2. NOVO — Parcelamento da NF (no lançamento do pré-título)

Conforme tela anexada pelo usuário. É **independente do rateio por CC**: rateio = "para onde vai o custo"; parcelamento = "quando e quanto será pago".

### 2.1 Campos do bloco "Parcelamento da despesa"

- **Checkbox `Despesa parcelada`** — default **desligado** (1 parcela única no vencimento informado no bloco "Dados do documento").
- Quando ligado, o campo **Vencimento** do bloco superior fica desabilitado (passa a ser derivado das parcelas — usa o menor vencimento, apenas como referência de listagem).
- **Número de parcelas** (inteiro, ≥ 2, ≤ 36 — sugerido).
- **Distribuição**:
  - **Manual** — usuário digita valor e data de cada parcela.
  - **Dividir igualmente** — sistema calcula valor por parcela (`valor_total / n`, ajusta centavos na última) e gera datas mensais a partir de uma **data-base** (data da 1ª parcela) com intervalo padrão de **30 dias** (configurável por parcela depois).
- **Modo de valor por parcela**: `R$` (valor absoluto) ou `%` (percentual sobre valor total). Espelha o padrão já usado no rateio.
- **Tabela de parcelas** (uma linha por parcela):
  - Nº da parcela (auto)
  - Valor da parcela (R$ ou %)
  - Data de vencimento
  - Lixeira (só no modo Manual, e só se nº parcelas > 1)

### 2.2 Validações (client + server)

- Soma das parcelas == valor total da NF (tolerância R$ 0,01 para arredondamento). Rodapé mostra: **NF / Somado / Diferença** em vermelho se ≠ 0.
- Toda parcela com `valor > 0` e `data_vencimento >= data_emissao`.
- Datas em ordem crescente (avisar, não bloquear).
- Se `Despesa parcelada` desligada → exatamente 1 parcela implícita (valor total, vencimento do bloco superior).
- Bloquear submissão se houver parcela sem data ou valor.

### 2.3 Impacto no modelo de dados

Novo conceito: **parcela do pré-título**. Duas formas equivalentes:

- **A.** Tabela `pre_titulo_parcela (id, pre_titulo_id, numero, valor, data_vencimento)`. Recomendado — escala melhor e é o que vira `titulo_pagar` 1-para-1 na promoção.
- **B.** Coluna `parcelas jsonb` em `pre_titulo`. Mais simples, pior para query e relatório.

**Recomendação: A.**

### 2.4 Impacto na promoção para título

Hoje (mental model): 1 pré-título → 1 título.
Com parcelamento: **1 pré-título → N títulos** (1 por parcela), todos compartilhando o mesmo rateio por CC/conta proporcionalmente, mesmo fornecedor, mesmo documento, com sufixo `nº doc / parcela 1 de N`.

- Cada `titulo_pagar` gerado herda: empresa, fornecedor, descrição, doc, competência, anexos (referência).
- `valor` e `data_vencimento` vêm da parcela.
- Rateio é **replicado proporcionalmente** em cada título (mesmo % por CC/conta).
- Programação de pagamento opera nos títulos individuais (já é assim).

### 2.5 Impacto na aprovação

- **Aprovação continua no nível do pré-título inteiro** (não parcela a parcela) — dono do CC aprova o pacote.
- Reprovação devolve o pré-título inteiro (parcelas não foram promovidas ainda).

### 2.6 Impacto na baixa manual

- Baixa opera nos títulos individuais (parcelas já viradas em título). Já estava previsto "baixa parcela a parcela" — fica natural.

---

## 3. Regra única de aprovador (inalterada)

- Aprovador = `centros_custo.gestor_user_id` do(s) CC(s) do rateio.
- Sem faixa de valor, sem escalonamento, sem segunda etapa.
- Rateio com N CCs → todos os donos aprovam em paralelo; 1 reprovação devolve tudo.
- Lançador = dono do CC → bloqueia, força trocar o responsável.
- CC sem gestor → bloqueia submissão.

## 4. Notificação + Inbox (paridade Helena, inalterado)

- Sininho + card "Aguardando Minha Aprovação" para cada dono de CC envolvido.
- Baixa notificação ao aprovar/reprovar; histórico registrado.

## 5. Baixa manual (inalterada, agora por parcela)

- Executores: Financeiro, Diretoria Administrativa, Presidência.
- Lista títulos `programado`; checkbox + data pagamento + conta debitada.
- Retroativa até 90 dias.
- Grava `data_pagamento`, `conta_debitada`, `usuario_baixa`; gera lançamento no fluxo de caixa realizado.

---

## 6. O que muda em relação ao plano anterior

| Item | Antes | Agora |
|---|---|---|
| Parcelamento da NF | Não previsto (1 vencimento único) | **Novo bloco** no modal + tabela `pre_titulo_parcela` + promoção 1→N títulos |
| Vencimento no bloco "Dados do documento" | Sempre obrigatório | Obrigatório só quando **não** parcelado; quando parcelado, desabilita e usa parcelas |
| Promoção pré-título → título | 1 para 1 | **1 para N** (uma por parcela) |
| Aprovação | Nível pré-título | **Inalterado** — nível pré-título (pacote) |
| Baixa | Por título | **Inalterado** — por título/parcela individualmente |

---

## 7. Decisões pendentes (preciso confirmar antes de implementar)

1. **Limite de parcelas** — sugerido máx. **36**. Confirma ou prefere outro teto?
2. **Intervalo padrão "Dividir igualmente"** — sugerido **30 dias** entre parcelas, 1ª parcela = vencimento informado no bloco superior. Ok?
3. **Edição de parcelas após aprovação** — quando o pré-título já virou N títulos, posso permitir o Financeiro **editar data de vencimento** de parcelas ainda não pagas (sem mexer no valor)? Recomendado: **sim**, com log.
4. **Antecipação/quitação** — permitir baixar uma parcela com valor diferente do programado (desconto/juros)? Recomendado: **sim**, com campos `valor_pago`, `juros`, `desconto`, `multa`.
5. **Modelo de dados** — confirma opção **A** (tabela `pre_titulo_parcela`) em vez de JSON?

---

## 8. Implementação técnica (resumo, não-bloqueante)

- **Migration**:
  - `pre_titulo`: adicionar `parcelado boolean default false`.
  - Nova tabela `pre_titulo_parcela (id, pre_titulo_id fk, numero int, valor numeric, data_vencimento date)` com unique (pre_titulo_id, numero).
  - RPC `pre_titulo_submeter` valida soma das parcelas == valor_total.
  - RPC `pre_titulo_promover` (chamada pelo Financeiro após aprovação) cria N `titulo_pagar` a partir das parcelas + replica rateio proporcional.
- **UI** (modal Novo lançamento):
  - Bloco "Parcelamento da despesa" entre "Dados do documento" e "Rateio".
  - Checkbox + Nº parcelas + radio Manual/Igual + tabela editável.
  - Rodapé com totalizador (NF / Somado / Diferença).
- **Aprovação / notificação / baixa** — sem mudança estrutural; só passam a operar sobre N títulos quando houver parcelas.

---

## 9. Por que não implementar agora

- Pendências §7 mudam estrutura de tabela e RPC.
- Bloqueador anterior ainda vale: **560 CCs sem gestor** → ligar a regra de aprovação trava lançamentos no dia 1.
- Decisão A vs B do plano anterior (motor genérico `sup_aprov_*` vs campos diretos em `pre_titulo`) ainda em aberto — recomendação **B**.

---

> Plan Mode / read-only. Nenhuma alteração foi feita em banco, código, RPCs, RLS, telas ou deploy. Aguardando suas respostas aos itens §7 (5 decisões novas sobre parcelamento) + confirmação de A/B do plano anterior para então implementar.
