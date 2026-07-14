Resumo funcional do "Sistema de Cobranças Nascimento v2" (app Python/Eel standalone,
`COBRANÇA v2/main.py`), levantado para orientar a reconstrução do módulo Cobranças
dentro do ERP. Isto substitui a necessidade de reler o código-fonte original.

## Fonte de dados

Não existe tabela de "títulos" — o app lê direto, a cada carregamento, a planilha
oficial do Financeiro ("Relatório de Serviços", dois arquivos por ano fiscal, rede `S:`).
Colunas usadas (por posição, não por cabeçalho): empresa, data, nota, competência,
cliente (= nome do contrato), situação, valor, pagamento.

Filtros pra uma linha virar "nota em aberto":
- `situação` = "NORMAL"
- `pagamento` vazio ou "-"
- dias desde `data` ≥ 20

No ERP: portado como importador manual (`ImportarRelatorioServicoCard.tsx` +
tabela `cobranca_relatorio_nota`, substituída por completo a cada importação),
enquanto `titulo_receber` não é alimentado por essa mesma fonte.

### A fonte real, um nível abaixo: Banco de Dados NFs.xlsx

O Relatório de Serviços não é a fonte primária — é um **export filtrado** de outra
planilha: `Banco de Dados NFs.xlsx` (`S:\Gestão Financeira\Notas Grupo Nascimento\
Emissão de notas Grupo Nascimento\Banco de Dados\`), controlada por 3 macros VBA
(repassadas pelo Yuri em 2026-07-13, `Módulo1/2/3.bas`).

Ciclo de vida real de uma nota, na coluna `AJ` desse arquivo:
**PENDENTE → CONCLUÍDO** (ou **CANCELADO**) — alterado manualmente via macro
`ConcluirOuCancelarNF` (alguém escolhe a linha, confirma conclusão/cancelamento,
digita o número da nota fiscal na hora da conclusão).

A macro `TransferirParaRelatorioServicos` só copia uma linha pro Relatório de
Serviços (2025 ou 2026, escolhido pelo ano da data na coluna `F`) quando: status =
CONCLUÍDO **e** ainda não foi transferida antes (controla isso guardando o nº da
linha de destino na coluna `AN` do Banco de Dados — evita duplicar). Ou seja: nota
pendente nunca aparece no que eu importo hoje.

Tem sincronização de volta também: `BuscarNFsGeral` lê a coluna `K` (status) de
dentro do Relatório de Serviços — se vier "CANCELADA" ou "SUBSTITUÍDA" ali, atualiza
o status de volta no Banco de Dados original (`AJ`/`AP`).

O Banco de Dados também tem sua própria aba `CONTRATOS`, e o casamento de contrato
usa normalização de texto (maiúsculo, remove `/`, `-`, `.`, espaço) — mesma técnica
que já implementei em `contratoMatch.ts`, validando a abordagem.

**Implicação pra um nativo de verdade**: se um dia isso for reconstruído dentro do
ERP, o alvo certo a replicar não é o Relatório de Serviços — é esse ciclo
Pendente → Concluído/Cancelado do Banco de Dados NFs, que é o processo real de
quem emite as notas.

### Proveniência do nome do contrato

O nome/número canônico de um contrato nasce na **Licitação**, na Planilha de Custo,
no momento em que uma proposta vira contrato — é essa a fonte de verdade que
`contrato.numero`/`contrato.orgao` no ERP deveriam refletir. As planilhas do
Financeiro (Relatório de Serviços, RELAÇÃO OPERACIONAL.xlsx) usam nomes informais
próprios, nunca sincronizados com esse nome canônico — é por isso que o casamento
automático de contrato (nos dois importadores) sempre deixa uma fatia como "sem
match": não é bug de matching, é ausência de uma chave comum real entre Financeiro
e Licitação.

## Faixas (régua)

`dias_atraso = dias - 30` (30 = prazo de pagamento da empresa). Ver `src/lib/faixaCobranca.ts`:
Aviso Amigável (≤0) → Verde (≤15) → Amarela (≤30) → Laranja (≤60) → Vermelha (≤90) →
Roxa (≤120) → Preta (120+).

## Envio de e-mail — ponto mais importante

**Nada é enviado automaticamente, em nenhuma faixa.** Usuário seleciona uma ou mais notas
do MESMO cliente (checkboxes), sistema monta um e-mail único (lista todas as notas,
usa o template da faixa mais severa entre elas), abre como rascunho pro usuário revisar
e ele mesmo manda. Decisão para o ERP: em vez de abrir Outlook local (impossível a partir
de um backend web), o ERP mostra uma tela de revisão com o e-mail montado (destinatário,
CC, corpo editável) e o usuário clica "Enviar" ali — o backend dispara via Graph API
na hora do clique, nunca por agendamento.

Pra Laranja/Vermelha/Roxa, existe uma escolha manual adicional: "Administrativo" vs
"Jurídico" (modal na hora do envio) — dois templates diferentes pra mesma faixa,
não é uma escalada automática por dias.

CC automático (exceto Aviso Amigável): gerência operacional sempre + analista/supervisor
do contrato, buscados numa tabela de vínculos (`vinculos_operacao`, importada de outra
planilha "RELAÇÃO OPERACIONAL.xlsx" com dicionário de tradução de nomes de contrato).

## Evidência / valor probatório

Depois do envio confirmado: cópia `.msg` real do e-mail (puxada da pasta Enviados do
Outlook) + réplica em PDF (gerada via automação do Word), salvas em pasta por cliente
(`S:\...\Controle cobranças\Cobranças\{ano}\{empresa}\{contrato}`). Tem exportação de
"Dossiê ZIP" com tudo de um cliente, pro jurídico.

Decisão para o ERP: capturar o `.eml` bruto via Graph API (mesmos headers reais de
autenticidade que um `.msg` do Outlook) + hash SHA-256 no momento do envio + log de
quem/quando confirmou, gravado de forma imutável. PDF de leitura gerado à parte.
Não substitui ata notarial em casos de maior risco — isso é decisão do jurídico caso a caso.

## Visibilidade por setor

Mesma lista de notas, recortada pelo setor de quem está logado: Jurídico só vê Laranja+
(atraso real > 30 dias), Licitação só vê Vermelha+ (> 60 dias), Financeiro vê tudo.
Não é fila de aprovação separada — é filtro sobre os mesmos dados.

## Outras peças do sistema antigo (ainda não portadas)

- Trava de cobrança duplicada: avisa se aquela nota já teve e-mail daquela faixa antes.
- WhatsApp: link manual (wa.me) com texto pré-formatado, sem API.
- Templates de e-mail editáveis pelo usuário (11 modelos, incluindo o de WhatsApp).
- Timeline por cliente com histórico de ações + anexos avulsos.
- Gestão de usuários simples (usuário/senha/função/telefone), sem o sistema de roles do ERP.

## Já portado corretamente

- E-mails dos tomadores por contrato → `contrato_email_cobranca` (FK real, substituindo
  o casamento de texto aproximado que o app antigo fazia).
