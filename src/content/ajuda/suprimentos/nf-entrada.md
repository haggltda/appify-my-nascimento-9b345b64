# Onde lanço uma nota fiscal de entrada?

**Quem pode acessar:** Suprimentos, Fiscal.
**Caminho no menu:** Suprimentos > NF de Entrada.
**Rota:** `/app/suprimentos/nf-entrada`.

## Pré-requisitos
- Fornecedor cadastrado.
- Pedido de compra recebido (recomendado, mas não obrigatório).

## Passo a passo
1. Acesse **Suprimentos > NF de Entrada**.
2. Clique em **Nova NF** (ou importe o XML pelo botão de importação).
3. Confira fornecedor, itens, valores, impostos e vínculo com pedido.
4. Salve e envie para conferência fiscal.

## O que acontece depois
- A NF segue para validação fiscal.
- Após aprovada, é gerado o título a pagar correspondente.
- Movimenta estoque, quando aplicável.

## Erros comuns
- **XML rejeitado**: chave já importada ou fornecedor não cadastrado.
- **Divergência com pedido**: ajuste o pedido ou registre exceção justificada.

## FAQ
- *Posso lançar NF sem pedido?* Sim, mas o lançamento exigirá justificativa e aprovação adicional.
