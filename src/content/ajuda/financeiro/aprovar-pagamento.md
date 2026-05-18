# Como aprovo um pagamento?

**Quem pode acessar:** Aprovadores financeiros conforme alçada, Gestores, Diretoria.
**Caminho no menu:** Financeiro › Programação de Pagamentos › aba **Malotes**.
**Rota:** `/app/financeiro/programacao-pagamentos`.
**Status do artigo:** em validação — o fluxo de alçadas pode variar conforme parametrização.
**Tempo médio:** 1 a 5 minutos por malote, dependendo do volume.

---

## 1. Antes de começar

- Você precisa estar configurado como **aprovador** para a alçada do malote (valor total).
- O malote precisa existir e estar no status **Em aprovação**.
- Confirme a empresa ativa no topo — você só aprova malotes da empresa selecionada.

> Quem cria o malote: o financeiro, em *Programação de Pagamentos › Títulos*. Ver artigo separado.

---

## 2. Como abrir a tela de aprovação

1. Menu lateral → **Financeiro**.
2. Clique em **Programação de Pagamentos**.
3. Vá para a aba **Malotes** (segunda aba).
4. Filtre por **Status = Em aprovação** para ver só o que depende de você.
5. A coluna **Aprovador** mostra de quem é a vez — se for você, há um destaque azul.

---

## 3. Como revisar o malote ANTES de aprovar

1. Clique na linha do malote para abrir o detalhe.
2. Confira o cabeçalho:
   - **Conta bancária de origem** (a que vai pagar).
   - **Data prevista de débito**.
   - **Total do malote** (soma de todos os títulos).
   - **Quantidade de títulos**.
3. Role a tabela de títulos dentro do malote e confira:
   - **Fornecedor** correto.
   - **Valor** bate com o documento original.
   - **Vencimento** condiz com a programação.
   - **Centro de custo** atribuído.
4. Abra um título (clique na linha) se quiser ver anexos e histórico.

### Checklist antes de aprovar

- [ ] Conta bancária tem saldo previsto suficiente?
- [ ] Datas de débito coerentes?
- [ ] Nenhum título duplicado?
- [ ] Fornecedores conferidos?
- [ ] Valor total dentro da sua alçada?

---

## 4. Como aprovar

1. Com o malote aberto, clique no botão **Aprovar** no rodapé do painel.
2. Confirme a aprovação no diálogo (informe observação se solicitado).
3. Toast verde: *"Malote aprovado"*.
4. Status do malote muda para **Aprovado** → libera para envio ao banco (CNAB ou API).

> Se houver mais de um nível de alçada, o malote vai para o próximo aprovador automaticamente.

---

## 5. Como rejeitar

Use quando há erro, valor incorreto, falta de documento, etc.

1. Clique em **Rejeitar** no rodapé.
2. **Justificativa é obrigatória** — descreva o motivo (texto livre).
3. O malote volta para o financeiro com status **Rejeitado**.
4. O financeiro ajusta e reenvia (se aplicável).

> Toda rejeição é auditada com seu nome, data/hora e justificativa.

---

## 6. O que acontece depois de aprovado

| Etapa | Onde | Quem |
|---|---|---|
| 1. Envio ao banco | Aba Malotes → botão **Gerar CNAB** ou **Enviar via API** | Financeiro |
| 2. Banco processa | Internet banking / API | Banco |
| 3. Retorno do banco | Importação CNAB ou webhook | Sistema (automático) |
| 4. Conciliação | *Validação Pós-Pagamento* | Sistema + financeiro |
| 5. Títulos viram "pagos" | Contas a Pagar | Automático |

---

## 7. Erros comuns + solução

| Erro | Causa | Solução |
|---|---|---|
| Botão Aprovar indisponível | Valor acima da sua alçada | Aguardar aprovador superior |
| "Malote vazio" | Títulos foram removidos | Pedir reabertura ao financeiro |
| "Conta sem saldo previsto" | Alerta preventivo | Revisar caixa antes de aprovar |
| Não vejo o malote na minha lista | Outra empresa selecionada | Trocar empresa no topo |
| Aprovei errado, como reverter? | — | Solicitar estorno ao financeiro antes do envio CNAB |

---

## 8. FAQ

- **Posso aprovar pelo celular?** A tela é responsiva, mas recomenda-se desktop para auditoria correta dos títulos.
- **Posso aprovar em lote?** Sim — selecione múltiplos malotes na lista e use **Aprovar selecionados**. Use com cuidado.
- **Quanto tempo tenho para aprovar?** Depende da parametrização da empresa. Malotes com vencimento próximo aparecem em destaque.
- **Recebo notificação?** Sim, no sino do topo e/ou por e-mail, conforme parametrização.
- **Posso ver o que aprovei no passado?** Sim, em *Administração › Auditoria* ou no histórico do próprio malote.
