# Como vejo os títulos a pagar?

**Quem pode acessar:** Financeiro, Controladoria, Diretoria.
**Caminho no menu:** Financeiro › Contas a Pagar.
**Rota:** `/app/financeiro/contas-pagar`.
**Tempo médio:** 1 a 2 minutos para localizar um título.

---

## 1. Antes de começar

- Confirme a **empresa ativa** no seletor do topo (canto superior direito). A lista é sempre da empresa selecionada.
- Seu perfil precisa ter permissão ao módulo **Financeiro**. Se o menu não aparece, fale com o admin.

---

## 2. Como abrir a tela

1. Menu lateral esquerdo → **Financeiro**.
2. Clique em **Contas a Pagar**.
3. A página abre na aba **Títulos** por padrão, com a lista de todos os títulos da empresa ativa.

---

## 3. O que aparece na tela

### Topo — KPIs
Cards com os indicadores do momento:
- **Em aberto**: títulos ainda não pagos.
- **Vencidos**: já passou da data e não foram pagos.
- **Pagos no mês**: total liquidado no mês corrente.
- **A vencer (7 dias)**: previsão de saída de caixa próxima.

### Filtros (logo abaixo dos KPIs)
- **Status**: rascunho, aprovado, programado, pago, cancelado.
- **Período de vencimento**: data inicial e final.
- **Fornecedor**: digite parte do nome ou CNPJ.
- **Centro de custo**: filtra pelo CC do rateio.
- **Empresa**: trocar entre empresas que você tem acesso.

> Para limpar filtros, use o botão **Limpar** ao final da barra.

### Listagem
Colunas: **Documento · Fornecedor · Emissão · Vencimento · Valor · Status · Ações**.

- Linhas em **vermelho** = vencidas.
- Linhas em **amarelo** = vencem em até 3 dias.
- Linhas em **verde** = pagas.

### Abas no topo
- **Títulos**: lista oficial (este artigo).
- **Pré-títulos**: lançamentos em rascunho aguardando aprovação. Ver artigo *"Como lançar um novo pré-título"*.

---

## 4. Como localizar um título específico

Três formas:

1. **Pela barra de filtros** (mais comum) — escolha período + fornecedor.
2. **Pela busca rápida** (campo acima da tabela) — digite nº do documento ou parte da descrição.
3. **Pelos KPIs** — clique no card "Vencidos" para filtrar só vencidos.

---

## 5. Como abrir o detalhe de um título

1. Clique em qualquer **linha** da tabela.
2. Abre o painel de detalhe com: dados do documento, rateio por centro de custo, anexos, histórico de aprovações, status do pagamento.
3. Para fechar, clique no X no canto superior do painel ou em outra área da tela.

---

## 6. Ações disponíveis na lista

| Ação | Onde está | Quando usar |
|---|---|---|
| **Novo lançamento** | Aba Pré-títulos, canto superior direito | Para registrar uma nova NF |
| **Aprovar pré-título** | Linha do pré-título → botão verde | Quando o título estiver completo |
| **Programar pagamento** | Linha do título aprovado → ícone calendário | Para enviar para malote |
| **Exportar Excel** | Topo da tabela | Auditoria, conferência externa |
| **Imprimir** | Detalhe do título | Para arquivo físico |

---

## 7. Erros comuns + solução

| Erro | Causa | Solução |
|---|---|---|
| Lista vazia mesmo tendo títulos | Empresa errada selecionada | Trocar no seletor do topo |
| Valores diferentes do esperado | Filtros aplicados sem perceber | Clicar em **Limpar filtros** |
| KPI "Vencidos" inflado | Títulos antigos não cancelados | Revisar e cancelar com justificativa |
| Não consigo ver um título | Sem permissão para o CC | Solicitar ao admin |

---

## 8. FAQ

- **Posso pagar diretamente daqui?** Não. Pagamento é feito em **Programação de Pagamentos** (gerar malote → aprovar → enviar ao banco).
- **Posso lançar uma nova NF aqui?** Sim — vá na aba **Pré-títulos** → botão **Novo lançamento**.
- **Posso editar um título já pago?** Não. Só cancelar com justificativa e estorno contábil.
- **Posso exportar para Excel?** Sim, botão **Exportar** no topo da tabela. Exporta respeitando os filtros aplicados.
- **A lista mostra títulos de todas as empresas?** Não — apenas da empresa ativa. Para visão consolidada, use *Painel Executivo*.
