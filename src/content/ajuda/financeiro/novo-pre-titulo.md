# Como lançar um novo pré-título (NF a pagar)

**Quem pode acessar:** Financeiro, Controladoria.
**Caminho no menu:** Financeiro › Contas a Pagar › aba **Pré-títulos**.
**Rota:** `/app/financeiro/contas-pagar`.
**Tempo médio:** 2 a 4 minutos por lançamento.

Este artigo mostra **exatamente** onde clicar, o que preencher, o que conferir antes de salvar e o que acontece depois. Siga na ordem.

---

## 1. Antes de começar (pré-requisitos)

Tenha em mãos / confirme:

- **Empresa ativa correta** no seletor do topo da tela (canto superior direito). Se lançar na empresa errada, o título cai no caixa errado.
- **Fornecedor já cadastrado** em *Suprimentos › Fornecedores*. Se não existir, cadastre primeiro — o modal não cria fornecedor.
- **Centro(s) de custo** que receberão o rateio. Conferir em *Controladoria › Centros de Custo*.
- **Conta contábil default** (opcional). As contas exibidas são sempre **contas de resultado (DRE)** da empresa selecionada — não aparecem contas de Ativo/Passivo/Caixa.

> **Importante — auto-sugestão CC → conta contábil:** ao selecionar o **centro de custo** numa linha de rateio, o sistema preenche automaticamente a **conta de resultado** vinculada àquele CC (via `centro_custo_padrao` no plano de contas). Você pode trocar manualmente se necessário. Se a empresa mudar, CC e conta da linha são limpos para evitar lançamento cruzado.
- **Documento físico/digital**: NF, rescisão, boleto, contrato — com número, data de emissão, vencimento e valor total.

---

## 2. Como abrir o modal

1. Menu lateral esquerdo → **Financeiro**.
2. Clique em **Contas a Pagar**.
3. Selecione a aba **Pré-títulos** (segunda aba no topo da página).
4. Clique no botão **Novo lançamento** no canto superior direito da listagem.
5. Abre o modal **"Novo lançamento de NF / pré-título"**.

---

## 3. Preenchimento — campo a campo

O modal tem **3 blocos**: Documento, Rateio, Anexos. Preencha de cima para baixo.

### Bloco 1 — Dados do documento

| Campo | Obrigatório | Como preencher | Dica |
|---|---|---|---|
| **Empresa** | Sim | Selecione a empresa pagadora. | Já vem preenchida com a empresa ativa — confira. |
| **Fornecedor** | Recomendado | Comece a digitar o nome ou CNPJ. | Se não encontrar, cadastre antes em Suprimentos. |
| **Descrição** | Sim | Texto curto identificando o gasto. Ex.: *"Rescisão João Silva — Obra Centro"*. | Boa descrição = busca fácil depois. |
| **Nº documento** | Recomendado | Número da NF, recibo ou contrato. | Evita duplicidade — o sistema avisa se já existe. |
| **Valor total** | Sim | Valor bruto da nota, em R$. Use ponto ou vírgula. | É o valor que será **rateado** entre centros de custo. |
| **Emissão** | Sim | Data no documento original. | Não pode ser futura. |
| **Vencimento** | Sim | Data combinada para pagar. | Não pode ser anterior à emissão. |
| **Competência** | Opcional | Mês a que o gasto se refere (regime de competência). | Usado em DRE gerencial. Default = mês da emissão. |
| **Conta contábil (default)** | Opcional | Conta que será usada quando o rateio não especificar uma. | Acelera lançamentos repetitivos. |
| **Observações** | Opcional | Notas livres para o financeiro. | Aparece no detalhe do título. |

### Bloco 2 — Rateio por centro de custo (obrigatório)

> **Importante:** o **centro de custo é escolhido SEMPRE aqui**, mesmo que seja um único CC. O campo "Conta contábil (default)" do bloco 1 é apenas a conta padrão; o **destino do gasto** (para qual obra/setor) é definido nas linhas de rateio. Para facilitar, o sistema já abre o modal com **1 linha de rateio em 100%** — basta escolher o CC.

Pode ser 1 linha (rateio simples) ou N linhas (rateio múltiplo).

1. Use a linha já criada ou clique em **+ Linha** para adicionar mais.
2. Em cada linha preencha:
   - **Centro de custo**: obrigatório.
   - **Conta / verba**: opcional — se vazio usa a **Conta contábil (default)** do bloco 1.
   - **Descrição**: complementa (ex.: "Obra Centro – Bloco A").
   - **Modo**: escolha **%** (percentual sobre o valor total) ou **R$** (valor absoluto).
   - **% ou Valor**: digite conforme o modo.
3. Use **Dividir igual** para distribuir o valor total proporcionalmente entre as linhas já criadas.
4. Para remover uma linha, clique no ícone de lixeira ao final.

**Rodapé do bloco mostra em tempo real:**
- *NF*: valor do bloco 1.
- *Rateado*: soma das linhas.
- *Diferença*: se ≠ 0, fica **vermelho**. Precisa zerar antes de salvar.

> Sem rateio? Tudo bem — o título usa a conta/CC default e fica como rateio único implícito.

### Bloco 3 — Anexos

1. Clique em **+ Adicionar arquivo**.
2. Selecione um ou mais arquivos (PDF, XML da NF, imagens, boleto).
3. Para cada arquivo, escolha o **tipo** no seletor à direita: *Nota fiscal*, *Rescisão*, *Boleto* ou *Outro*.
4. Para remover, clique na lixeira.

> Recomendação: sempre anexe pelo menos o documento principal (NF / contrato / rescisão).

---

## 4. Checklist ANTES de clicar em Salvar

Pare e confira:

- [ ] Empresa correta?
- [ ] Fornecedor correto?
- [ ] Valor total bate com o documento físico?
- [ ] Vencimento ≥ emissão?
- [ ] Rateio fechado (diferença = R$ 0,00)?
- [ ] Pelo menos um anexo (quando houver documento físico)?
- [ ] Descrição clara o suficiente para outro colega entender?

---

## 5. Como salvar

1. Clique em **Salvar rascunho** no rodapé do modal.
2. O botão fica em estado *"Salvando..."* enquanto o sistema processa.
3. Em caso de sucesso:
   - Toast verde no canto da tela: *"Pré-título salvo"*.
   - O modal fecha automaticamente.
   - O novo item aparece no topo da listagem de pré-títulos com status **Rascunho**.
4. Em caso de erro:
   - Toast vermelho com a mensagem.
   - Campos obrigatórios não preenchidos ficam destacados.
   - Corrija e clique em Salvar novamente.

Para abandonar sem salvar, clique em **Cancelar** ou no X do canto superior — nada é gravado.

---

## 6. O que acontece depois de salvar

| Etapa | Onde acontece | Quem faz |
|---|---|---|
| 1. Validação fiscal/financeira | Aba **Pré-títulos** | Financeiro revisa e clica em **Aprovar** |
| 2. Virada para título oficial | Automático após aprovação | Sistema gera o título em Contas a Pagar |
| 3. Programação de pagamento | *Financeiro › Programação de Pagamentos* | Financeiro monta o malote |
| 4. Aprovação do malote | Mesma tela, aba **Malotes** | Aprovador por alçada |
| 5. Envio ao banco | CNAB ou API | Financeiro |
| 6. Confirmação e conciliação | Retorno bancário | Sistema concilia automaticamente |

Acompanhe o status do seu pré-título na coluna **Status** da listagem.

---

## 7. Erros comuns + solução

| Erro | Causa provável | Como resolver |
|---|---|---|
| "Diferença de rateio" | Soma dos rateios ≠ valor total | Ajustar % ou valores até zerar |
| "Fornecedor não encontrado" | Não cadastrado | Cadastrar em Suprimentos › Fornecedores |
| "Documento já lançado" | Mesmo nº + fornecedor + empresa | Conferir se não é duplicidade real |
| "Vencimento inválido" | Data anterior à emissão | Corrigir a data |
| Botão Salvar não responde | Campos obrigatórios vazios | Ver campos destacados em vermelho |

---

## 8. FAQ

- **Posso editar depois de salvar?** Sim, enquanto estiver em status *Rascunho*. Após aprovação, só o financeiro com permissão pode editar.
- **Posso lançar sem rateio?** Sim — o título usa a conta/CC default.
- **Posso anexar depois?** Sim, pelo detalhe do pré-título.
- **Posso lançar em lote (várias NFs)?** Hoje é um por vez. Importação em lote está prevista para a próxima fase.
- **O lançamento gera contabilização?** Não — só na virada para título oficial após aprovação.
