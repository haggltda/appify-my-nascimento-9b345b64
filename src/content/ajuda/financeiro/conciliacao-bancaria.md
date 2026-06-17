# Como faço conciliação bancária?

**Quem pode acessar:** Financeiro, Controladoria.
**Caminho no menu:** Financeiro > Conciliação de Fluxo de Caixa.
**Rota:** `/app/financeiro/conciliacao-fluxo-caixa`.
**Status do artigo:** em implantação — o módulo está em validação operacional.

## Pré-requisitos
- Movimentos bancários importados (OFX, CNAB ou API).
- Títulos pagos/recebidos lançados no sistema.

## Passo a passo
1. Acesse **Financeiro > Conciliação de Fluxo de Caixa**.
2. Selecione a conta bancária e o período.
3. O sistema sugere amarrações entre movimentos e títulos.
4. Confirme as sugestões corretas; ajuste manualmente as divergentes.
5. Salve a conciliação do período.

## O que acontece depois
- Movimentos conciliados deixam de aparecer como pendentes.
- O fluxo de caixa diário passa a refletir os valores conciliados.

## Erros comuns
- **Movimento não encontrado**: verifique se o arquivo bancário foi importado em **Movimentos Bancários** (`/app/financeiro/movimentos`).
- **Diferença de centavos**: pode haver tarifas/juros não lançados; crie o lançamento complementar.

## FAQ
- *Posso desfazer uma conciliação?* Sim, pela própria tela enquanto o período não estiver fechado.
