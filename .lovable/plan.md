## Contexto importante (decisão necessária)

A tabela `conta_bancaria` que mencionei na resposta anterior é, na verdade, **das contas da empresa** (com `empresa_id NOT NULL`, integração CNAB, convênio, certificado, webhook, etc.). Ela não foi projetada para guardar contas de **terceiros (fornecedores)** — colocar contas de fornecedor ali misturaria conceitos e quebraria a integração bancária (toda conta passaria a exigir CNAB layout, ambiente, status, etc.).

Por isso, recomendo criar uma **nova tabela dedicada** `fornecedor_conta_bancaria`, vinculada ao fornecedor. É o padrão usado em ERPs (TOTVS, Sankhya, SAP) e mantém `conta_bancaria` limpa para as contas próprias.

> Se ainda assim você preferir usar a tabela `conta_bancaria` para guardar contas de fornecedor, me avise antes de eu executar — terei que tornar vários campos opcionais e adicionar `fornecedor_id`, o que enfraquece as regras atuais de integração bancária.

---

## Plano (assumindo nova tabela dedicada)

### 1. Banco de dados — migration
Criar `public.fornecedor_conta_bancaria`:
- `fornecedor_id` (FK → fornecedor, ON DELETE CASCADE)
- `empresa_id`
- `banco_codigo`, `banco_nome`
- `agencia`, `agencia_digito`
- `conta`, `conta_digito`
- `tipo` (corrente / poupança / pagamento)
- `titular_nome`, `titular_documento` (CNPJ/CPF — pode diferir do fornecedor)
- `pix_tipo` (cpf/cnpj/email/telefone/aleatoria), `pix_chave`
- `principal` (boolean — uma marcada como principal por fornecedor via trigger)
- `ativa` (boolean default true)
- `observacoes`, `created_at`, `updated_at`

RLS: habilitar e replicar as policies da tabela `fornecedor` (mesma regra de empresa).
Trigger `update_updated_at_column`.
Índice em `(fornecedor_id, ativa)`.

### 2. Frontend — tela de Fornecedor
A tela atual (`src/pages/suprimentos/Fornecedores.tsx`) usa o componente genérico `EntityCrudPage`, que **não suporta sub-coleções**. Substituir por um CRUD próprio com Dialog de edição em abas:

- **Aba "Dados Gerais"** — campos atuais (tipo, CNPJ/CPF, razão social, contato, etc.)
- **Aba "Contas Bancárias"** *(nova)* — lista das contas do fornecedor com:
  - Botão **+ Nova conta** → abre sub-dialog com formulário (validação Zod)
  - Ações por linha: **Editar**, **Definir como principal**, **Inativar/Excluir**
  - Tabela com banco, agência, conta, tipo, PIX, principal, status

A aba só fica habilitada após o fornecedor ser salvo pela primeira vez (precisa de `fornecedor_id`).

### 3. Onde as contas serão consumidas
Manter o que já existe. Os locais que hoje leem `conta_bancaria` (Programação de Pagamentos, Builder CNAB) **continuam usando `conta_bancaria` para a conta pagadora da empresa** — sem mudança. A nova `fornecedor_conta_bancaria` será usada futuramente para definir a conta de destino do pagamento (fora deste escopo, só preparando a base).

### 4. Validações (Zod + server)
- Agência/conta: somente dígitos
- PIX: validar formato conforme `pix_tipo`
- Apenas uma conta `principal=true` por fornecedor (trigger ao inserir/atualizar)
- Limites de tamanho em todos os textos

### Arquivos a alterar/criar
- `supabase/migrations/<timestamp>_fornecedor_conta_bancaria.sql` *(novo)*
- `src/pages/suprimentos/Fornecedores.tsx` *(reescrever — sai do EntityCrudPage)*
- `src/pages/suprimentos/fornecedores/FornecedorDialog.tsx` *(novo — abas Dados/Contas)*
- `src/pages/suprimentos/fornecedores/ContasBancariasTab.tsx` *(novo)*
- `src/pages/suprimentos/fornecedores/ContaBancariaDialog.tsx` *(novo)*

### Fora do escopo
- Vincular a conta do fornecedor a títulos a pagar / programações (próxima entrega)
- Importação em massa de contas

---

**Confirma?** Posso seguir com a tabela dedicada (recomendado), ou prefere forçar tudo dentro de `conta_bancaria`?