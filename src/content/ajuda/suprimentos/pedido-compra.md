# Como gero um pedido de compra?

**Quem pode acessar:** Compras / Suprimentos.
**Caminho no menu:** Suprimentos › Pedidos de Compra.
**Rota:** `/app/suprimentos/pedidos`.
**Tempo médio:** 3 a 8 minutos por pedido.

---

## 1. Antes de começar

- **Fornecedor cadastrado** em *Suprimentos › Fornecedores*.
- **Produtos/serviços cadastrados** em *Suprimentos › Produtos*.
- **Cotação concluída** com proposta vencedora (recomendado — gera o pedido com 1 clique).
- **Centro de custo** definido — sem CC o pedido não vai para aprovação.
- **Contrato vinculado** (quando aplicável — obras, serviços contínuos).

---

## 2. Como abrir a tela

1. Menu lateral → **Suprimentos**.
2. Clique em **Pedidos de Compra**.
3. A lista mostra todos os pedidos da empresa ativa.

---

## 3. Duas formas de criar o pedido

### A) A partir de uma cotação (recomendado)

1. Vá em *Suprimentos › Cotações*.
2. Abra a cotação com status **Concluída**.
3. Confirme a proposta vencedora.
4. Clique em **Gerar pedido**.
5. Os itens, valores e fornecedor vêm preenchidos automaticamente.
6. Confira e ajuste se necessário (ver Bloco "Preenchimento" abaixo).

### B) Pedido direto (sem cotação)

Use só quando há fornecedor único, contrato fixo ou compra emergencial autorizada.

1. Em **Pedidos de Compra**, clique em **Novo pedido** (canto superior direito).
2. Preencha do zero.

---

## 4. Preenchimento — campo a campo

### Cabeçalho do pedido

| Campo | Obrigatório | Como preencher |
|---|---|---|
| **Empresa** | Sim | Empresa compradora — já vem preenchida |
| **Fornecedor** | Sim | Selecione do cadastro |
| **Data do pedido** | Sim | Default = hoje |
| **Previsão de entrega** | Sim | Data combinada com fornecedor |
| **Centro de custo** | Sim | Quem vai arcar com o gasto |
| **Contrato** | Quando aplicável | Vincula a um contrato vigente |
| **Condição de pagamento** | Sim | Ex.: 30/60/90, à vista, etc. |
| **Observações** | Opcional | Notas para fornecedor e auditoria |

### Itens do pedido

Para cada item:

1. Clique em **+ Adicionar item**.
2. Selecione o **Produto/Serviço** do cadastro.
3. Informe **Quantidade**.
4. Informe **Valor unitário** (vem da cotação se gerado a partir dela).
5. **Subtotal** calcula automaticamente.
6. Defina **Centro de custo do item** (pode ser diferente do cabeçalho — útil para pedido compartilhado).

> Rodapé mostra: subtotal, descontos, frete, impostos e **Total geral**.

### Anexos

Anexe orçamento do fornecedor, especificação técnica, foto da peça, etc. Clique em **+ Anexo**.

---

## 5. Checklist ANTES de enviar para aprovação

- [ ] Fornecedor correto?
- [ ] Quantidade e unidade de medida conferidos?
- [ ] Valor unitário bate com cotação vencedora?
- [ ] Centro de custo preenchido em todos os itens?
- [ ] Previsão de entrega realista?
- [ ] Condição de pagamento alinhada com financeiro?
- [ ] Anexos incluídos (cotação/orçamento)?

---

## 6. Como enviar para aprovação

1. Clique em **Salvar rascunho** primeiro (gera o nº do pedido).
2. Depois clique em **Enviar para aprovação**.
3. O sistema valida e aplica a **alçada** correspondente ao valor total.
4. Toast verde: *"Pedido enviado — aguardando aprovação"*.
5. Status muda para **Em aprovação**.

> Para cancelar antes de enviar, clique em **Cancelar pedido** (apenas em rascunho).

---

## 7. O que acontece depois

| Etapa | Onde | Quem |
|---|---|---|
| 1. Aprovação por alçada | *Suprimentos › Aprovações* | Gestor / Diretoria |
| 2. Envio ao fornecedor | Automático (e-mail) ou manual | Compras |
| 3. Recebimento | *Suprimentos › Recebimentos* | Almoxarifado |
| 4. NF de entrada | *Suprimentos › NF Entrada* | Fiscal |
| 5. Geração do título a pagar | Automático após NF validada | Sistema → Financeiro |

---

## 8. Erros comuns + solução

| Erro | Causa | Solução |
|---|---|---|
| "Sem centro de custo" | CC vazio no cabeçalho ou em item | Preencher CC |
| "Valor acima da alçada" | Pedido grande | Vai para aprovador superior — normal |
| "Fornecedor inativo" | Cadastro suspenso | Reativar ou trocar fornecedor |
| Botão Salvar não responde | Itens sem produto/quantidade | Conferir linhas |
| Não vejo a opção "Gerar pedido" na cotação | Cotação não está concluída | Encerrar cotação primeiro |

---

## 9. FAQ

- **Posso alterar um pedido aprovado?** Só com fluxo de **revisão controlada** — gera novo número de versão e exige nova aprovação.
- **Posso cancelar um pedido aprovado?** Sim, com justificativa. Se já houver recebimento parcial, só cancela o saldo.
- **Posso ter mais de um centro de custo no mesmo pedido?** Sim, por item.
- **Como o financeiro sabe que vou pagar?** Após NF de entrada validada, o título é gerado automaticamente em Contas a Pagar.
- **Posso imprimir o pedido para o fornecedor?** Sim — botão **Imprimir** no detalhe gera PDF com layout oficial.
