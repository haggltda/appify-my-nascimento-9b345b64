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
