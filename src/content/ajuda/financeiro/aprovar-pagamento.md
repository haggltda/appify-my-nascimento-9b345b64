# Como aprovo um pagamento?

**Quem pode acessar:** Aprovadores financeiros (conforme alçada), Diretoria.
**Caminho no menu:** Financeiro > Programação de Pagamentos > aba **Malotes**.
**Rota:** `/app/financeiro/programacao-pagamentos`.
**Status do artigo:** em validação — o fluxo de alçadas pode variar conforme a parametrização da empresa.

## Pré-requisitos
- Existir um **malote** gerado a partir de títulos selecionados.
- Você precisa estar configurado como aprovador para a alçada do malote.

## Passo a passo
1. Acesse **Financeiro > Programação de Pagamentos**.
2. Vá para a aba **Malotes**.
3. Selecione o malote pendente.
4. Revise os títulos e os totais.
5. Clique em **Aprovar** (ou **Rejeitar**, justificando).

## O que acontece depois
- Aprovado: o malote fica liberado para envio ao banco (CNAB/API).
- Rejeitado: retorna para ajustes pelo financeiro.

## Erros comuns
- **Botão de aprovar indisponível**: você não está na alçada do valor.
- **Malote vazio**: confira se títulos foram realmente vinculados.

## FAQ
- *Posso aprovar pelo celular?* A tela é responsiva, mas recomenda-se desktop para revisão.
