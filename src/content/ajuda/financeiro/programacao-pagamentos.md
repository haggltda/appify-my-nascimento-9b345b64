# Programação de Pagamentos

Esta tela centraliza a seleção de títulos a pagar, montagem de **malotes**, fluxo de aprovação e envio ao banco (via CNAB ou API).

## Pré-requisitos

- Títulos lançados em **Financeiro › Contas a Pagar** com status `aprovado`.
- Conta bancária cadastrada em **Financeiro › Integração Bancária** com layout configurado (CNAB ou API REST).
- Alçada de aprovação configurada para o seu perfil.

## Passo a passo

1. **Filtrar títulos**
   - Use os filtros de período de vencimento, fornecedor, centro de custo e empresa.
   - A tela mostra apenas títulos elegíveis (aprovados e não pagos).

2. **Selecionar títulos**
   - Marque individualmente ou use **Selecionar todos** da página.
   - O rodapé mostra total selecionado e valor consolidado.

3. **Criar malote**
   - Clique em **Gerar malote** e escolha a conta bancária de origem.
   - O sistema valida saldo previsto, datas e duplicidade.
   - O malote nasce com status `rascunho`.

4. **Revisar e aprovar**
   - Em **Malotes**, abra o malote em rascunho.
   - Confira títulos, valores e data prevista de débito.
   - Clique em **Enviar para aprovação**. O sistema dispara a alçada configurada.

5. **Envio ao banco**
   - Após aprovado, o malote fica disponível para envio.
   - **CNAB**: clique em **Gerar arquivo** e baixe/envie ao internet banking.
   - **API**: clique em **Enviar** — a integração roda automaticamente.

6. **Conciliação pós-pagamento**
   - O retorno do banco (arquivo CNAB ou webhook API) atualiza o status para `pago`.
   - Casos não conciliados aparecem em **Validação Pós-Pagamento**.

## Status do malote

| Status | Significado |
|---|---|
| `rascunho` | Montado, ainda editável |
| `em_aprovacao` | Aguardando alçada |
| `aprovado` | Pronto para envio |
| `enviado` | Arquivo gerado ou API chamada |
| `confirmado` | Banco confirmou execução |
| `rejeitado` | Banco devolveu erro — ver detalhe |

## Erros comuns

- **"Conta sem layout configurado"** — vá em Integração Bancária e finalize o builder.
- **"Saldo insuficiente"** — alerta preventivo; é possível forçar com justificativa se perfil permitir.
- **"Título já incluído em outro malote"** — remova do malote anterior antes de incluir.

## Dicas

- Use **Análise por Período** para projetar a curva de pagamentos antes de montar malotes grandes.
- Malotes com mais de 200 títulos são mais difíceis de auditar — quebre por banco ou por dia.
