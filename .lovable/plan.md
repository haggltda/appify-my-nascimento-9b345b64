# Plano: Catálogo de bancos unificado

## Situação atual

Existe um único catálogo em `src/pages/financeiro/builder/types.ts` → `BANCOS_CATALOGO` com apenas 10 itens (BB, Caixa, Bradesco, Itaú, Santander, Sicoob, Sicredi, Inter, BTG, "Outro"). Ele é usado em:

- `ContaBancariaDialog` (fornecedores) — selecione o banco da conta do fornecedor
- Builder CNAB (integração bancária)
- Contas bancárias da própria empresa (tabela `conta_bancaria`)

Não há ainda local de cadastro de **contas de colaboradores** (será necessário criar — ver seção 4).

## 1. Expandir o catálogo (sem duplicar)

Adicionar ao `BANCOS_CATALOGO` os bancos solicitados + uma lista média representativa do mercado BR. Padrão: `codigo` (string, 3 dígitos com zero à esquerda) + `nome`.

Novos solicitados pelo usuário:
- 041 — Banrisul
- 336 — C6 Bank
- 260 — Nubank (Nu Pagamentos)
- 292 — Mentore (BS2 / código a confirmar — Mentore atua sob conta-corrente parceira; código provisório 292/BS2)
- — Próspera (não possui código COMPE próprio; opera como correspondente — listar como "Próspera (correspondente)" com código provisório `999P` ou pedir confirmação ao usuário)
- 526 — Ticket / Edenred (conta-pagamento)

Lista média a incluir (códigos COMPE oficiais), sem duplicar os 10 já existentes:
003 Basa, 004 BNB, 021 Banestes, 025 Alfa, 037 Banpará, 041 Banrisul, 047 Banese, 070 BRB, 077 Inter (já existe), 082 Banco Topázio, 084 Uniprime Norte PR, 085 Ailos/Cecred, 097 Credisis, 121 Agibank, 197 Stone, 208 BTG (já existe), 212 Banco Original, 213 Banco Arbi, 218 BS2, 222 Credit Agricole, 224 Fibra, 237 Bradesco (já existe), 246 ABC Brasil, 260 Nubank, 290 PagBank/PagSeguro, 323 Mercado Pago, 335 Digio, 336 C6, 341 Itaú (já), 380 PicPay, 389 Mercantil do Brasil, 422 Safra, 453 Rural, 473 Caixa Geral, 477 Citibank, 487 Deutsche, 526 Ticket, 600 Luso Brasileiro, 604 Industrial, 611 Paulista, 612 Guanabara, 623 Pan, 633 Rendimento, 637 Sofisa, 643 Pine, 652 Itaú Holding, 653 Indusval, 655 Votorantim, 707 Daycoval, 735 BRK / Neon, 739 Cetelem, 741 BRP, 745 Citibank, 746 Modal, 748 Sicredi (já), 752 BNP Paribas, 755 BofA, 756 Sicoob (já), 757 KEB.

Total estimado: ~55 bancos (10 existentes + ~45 novos). Mantém UX fluida no Select.

Regra anti-duplicação: chave única = `codigo`. Antes de adicionar, conferir lista atual.

Itens sem código COMPE definido ("Próspera", "Mentore") serão marcados visualmente (ex.: nome + "(correspondente)") e usarão prefixo `9xx` reservado, sujeito a confirmação.

## 2. Onde o catálogo é usado hoje

- `ContaBancariaDialog` (fornecedores) — OK, passa a ver lista completa automaticamente.
- Builder CNAB — OK.
- Modal de cadastro de `conta_bancaria` (empresa) — verificar; se ainda usa lista hardcoded local, trocar para `BANCOS_CATALOGO`.

Nenhuma migração de dados necessária — `banco_codigo` continua string.

## 3. Contas bancárias da própria empresa

Já existem: tabela `conta_bancaria` + tela na trilha de Integração Bancária / Financeiro. Ação: garantir que o Select de banco use `BANCOS_CATALOGO` (mesma fonte única).

## 4. Contas bancárias de colaboradores (novo)

Hoje não existe. Padrão a seguir (espelhando `fornecedor_conta_bancaria`):

- Nova tabela `colaborador_conta_bancaria` com: `colaborador_id` (FK CASCADE), `empresa_id`, `banco_codigo`, `banco_nome`, `agencia`/dígito, `conta`/dígito, `tipo`, `titular_nome` (default = nome do colaborador), `titular_documento` (default = CPF do colaborador), `pix_tipo`, `pix_chave`, `principal`, `ativa`, `observacoes`, timestamps. RLS + trigger `principal_unica` por colaborador + trigger `updated_at`.
- UI: aba "Contas Bancárias" dentro do cadastro do colaborador em `src/pages/rh/ColaboradorForm.tsx` (ou novo `ColaboradorDialog` se preferirem), reaproveitando `ContaBancariaDialog` parametrizado (extrair para componente genérico `ContaBancariaForm` que receba `parentId`, `parentTable`, `tituloPadrao`).
- Uso futuro: folha de pagamento, reembolsos, adiantamentos.

## 5. Refatoração leve sugerida

- Mover `BANCOS_CATALOGO` para `src/lib/bancos.ts` (fonte única, fora do módulo builder/CNAB) e reexportar do path antigo para não quebrar imports.
- Função helper `getBancoNome(codigo)` para usar em listagens.

## Detalhes técnicos

- Tipo `BancoCatalogo` ganha `cor` opcional — novos itens podem usar `hsl(220 10% 50%)` como default neutro.
- Ordenação: alfabética por `nome`, exceto os 5-6 "Top" (BB, Caixa, Bradesco, Itaú, Santander, Sicoob/Sicredi) fixados no topo + separador.
- Componente `Select` shadcn já comporta ~60 itens; se passar de 80 considerar `Command` (combobox com busca).

## Fora de escopo deste plano

- Migrar dados existentes (não há mudança de schema em tabelas atuais).
- Validação de dígito-banco por algoritmo específico.
- Importação massiva de contas.

## Pendências de confirmação

1. Códigos para **Próspera** e **Mentore** — quais usar? (não têm COMPE próprio)
2. Aprovar criação da tabela `colaborador_conta_bancaria` agora ou em etapa separada?
3. Manter "Outro / Customizado" (999) como fallback? (recomendo sim)
