
## Adendo ao plano: Centros de Custo automáticos (origem Licitação/Contrato) + numeração + integração contábil

Este adendo **complementa** o plano anterior (cadastro mestre Comitê → Área → Setor). Trata da criação **automática** de CCs operacionais quando uma licitação se torna contrato vencido, da numeração padronizada e da amarração com o Plano de Contas Gerencial.

## Diagnóstico do que existe hoje

| Item | Estado atual |
|---|---|
| `centros_custo` | Manual. Tipos: `adm`, `operacional`. Possui `codigo`, `nome`, `responsavel`, `dimensao`, `categoria_gerencial`, `direto_indireto`, `fixo_variavel`, `exige_contrato`, `impacta_dre`, `status_cadastro`, `origem_cadastro` (texto livre, hoje **não é alimentado**) |
| `contrato.centro_custo_id` | FK opcional (nullable) — **não há automação** que crie CC quando o contrato nasce |
| `contrato.licitacao_id` | FK opcional — vínculo licitação→contrato existe |
| Numeração de CC | Texto livre, sem sequência por empresa/tipo/origem — risco de duplicidade e códigos inconsistentes |
| `plano_contas_master` | Existe, separado por empresa. Sem regra que conecte CC novo a contas gerenciais padrão |
| `mz_04_dim_centros_custo_contratos_completo` | Tabela de migração já evidencia que **a regra de negócio é 1 contrato = 1 CC operacional** |

**Conclusão**: o modelo já assume a regra "contrato vira CC", mas a criação está manual. Precisamos formalizar via trigger + numeração automática + amarração com plano de contas.

## Proposta

### 1. Tipologia e origem do CC (enum claro)

Ampliar/normalizar no `centros_custo`:

- `tipo`: `adm | operacional` (mantém)
- `origem_cadastro` (passa a ser enum controlado): `manual | contrato | licitacao | rateio | corporativo`
- `entidade_origem_tabela` + `entidade_origem_id` (nullable) — rastreabilidade: aponta para `contrato.id` quando criado por contrato
- `setor_id` (nullable) — link com a estrutura organizacional do plano principal
- Constraint: se `origem_cadastro = 'contrato'`, então `entidade_origem_id` não pode ser NULL

### 2. Numeração automática padronizada

Sequência por empresa + tipo + origem:

```text
Formato:  {EMP}-{TIPO}-{ORIGEM}-{SEQ}
Exemplo:  ACME-OP-CT-0042   (operacional, contrato, sequencial 42)
          ACME-AD-MN-0007   (administrativo, manual, sequencial 7)
```

Implementação: tabela `centros_custo_sequencia (empresa_id, tipo, origem, ultimo_numero)` + função `gerar_codigo_cc(empresa, tipo, origem)` chamada por trigger quando `codigo IS NULL` no insert. Mantém compatibilidade com códigos manuais legados (se vier preenchido, respeita).

### 3. Trigger de criação automática a partir do Contrato

Trigger `AFTER INSERT OR UPDATE` em `contrato`:

- **Quando dispara**: ao inserir contrato com `status = 'implantacao'` ou ao mudar status de licitação ganha → contrato; e quando `centro_custo_id IS NULL`
- **Ação**:
  1. Cria registro em `centros_custo` com:
     - `tipo = 'operacional'`
     - `origem_cadastro = 'contrato'`
     - `codigo` gerado pela função (item 2)
     - `nome = 'CT ' || contrato.numero || ' - ' || left(contrato.objeto, 60)`
     - `responsavel = contrato.gestor` (texto, fallback)
     - `entidade_origem_tabela = 'contrato'`, `entidade_origem_id = NEW.id`
     - `exige_contrato = true`, `impacta_dre = true`, `dimensao = 'contrato'`
  2. Atualiza `contrato.centro_custo_id` com o id recém-criado
  3. Idempotente: se já existe CC com `entidade_origem_id = contrato.id`, apenas referencia
- **Inativação**: trigger em `contrato` quando `status = 'encerrado'` → marca CC como `ativo = false` (mantém histórico)

### 4. Integração com Plano de Contas Gerencial

CC novo **não cria** contas no plano de contas (plano de contas é dimensão estável da empresa, não por contrato). O que muda:

- Novo CC fica imediatamente disponível em todas as visões que filtram por CC: DRE Gerencial, OBZ, lançamentos, títulos, NF, requisições.
- Tabela opcional `cc_plano_contas_padrao (empresa_id, tipo_cc, conta_id)` — define quais contas gerenciais aparecem por padrão no orçamento (OBZ) de cada CC novo. Pode ser populada a partir de `mz_25_stg_mapa_de_para_orcamento_contratos` que já existe.
- Trigger pós-criação de CC operacional opcional: pré-popula `obz_valores` com zero para as contas padrão do mapa, evitando que um contrato novo apareça "vazio" no orçamento.

### 5. UI — ajustes na tela `Centros de Custo`

- Coluna nova **Origem**: badge `Manual / Contrato / Licitação / Rateio`
- Coluna nova **Vínculo**: link clicável para o contrato/licitação de origem
- CCs com `origem_cadastro != 'manual'` ficam **read-only** nos campos código/nome (gerados pelo sistema). Só responsável/setor/observações são editáveis.
- Filtro por origem
- Aviso visual quando contrato existe sem CC vinculado (linha de saneamento)

### 6. Saneamento de dados existentes

Script idempotente único:

1. Para cada `contrato` sem `centro_custo_id`, dispara o trigger (insert simulado) → cria CC retroativo com numeração coerente.
2. Para `centros_custo` operacionais que **batem** com algum contrato (por nome/código), preenche `entidade_origem_*` em vez de duplicar.
3. Loga em `centros_custo_log_saneamento` o que foi criado vs. vinculado.

## Impactos consolidados (somando este adendo ao plano principal)

| Módulo | Impacto |
|---|---|
| **Contrato** | Ganha CC automático ao implantar; perde a necessidade de cadastro manual de CC |
| **Licitação → Contrato (conversão)** | Sem mudança de UI; trigger faz tudo no backend |
| **Centros de Custo (tela)** | Mostra origem e vínculo; bloqueia edição de campos gerados |
| **Plano de Contas** | **Nenhuma** alteração estrutural |
| **OBZ / DRE Gerencial** | CCs novos aparecem automaticamente; pré-população opcional via `cc_plano_contas_padrao` |
| **Estrutura Organizacional (plano principal)** | Setor pode opcionalmente apontar para CC; aqui invertemos: CC operacional pode opcionalmente apontar para `setor_id` (ex.: contrato pertence ao setor "Operações Norte") |
| **Suprimentos / Financeiro / Contábil** | Nenhuma mudança — continuam usando `centro_custo_id` |
| **Encerramento de contrato** | CC vai para inativo automaticamente, preservando histórico |

## Riscos e mitigações

- **Risco**: trigger criar CC duplicado em re-imports de contratos.
  - Mitigação: índice único parcial `(empresa_id, entidade_origem_tabela, entidade_origem_id) WHERE origem_cadastro != 'manual'`.
- **Risco**: códigos legados não seguem o novo formato.
  - Mitigação: numeração nova só para novos CCs; legados mantêm código original e ganham flag `codigo_legado = true`.
- **Risco**: contrato encerrado tem lançamentos futuros previstos.
  - Mitigação: inativação é soft (`ativo=false`), CC continua selecionável em telas históricas.

## Fases revisadas

| Fase | Entrega |
|---|---|
| **1** | Cadastro mestre Comitê/Área/Setor + tela (do plano original) |
| **2** | **Este adendo**: enum origem, numeração automática, trigger contrato→CC, saneamento, UI atualizada de CC |
| **3** | Plano de Ações migra para selects encadeados |
| **4** | Pareceres + filtros DRE Gerencial por comitê/área |
| **5** | (Opcional) Pré-população OBZ por mapa padrão de contas por tipo de CC |

Fases 1 e 2 são **independentes** — podem ser implementadas em qualquer ordem.

## O que continua proibido

- Alterar plano de contas, lançamentos, OBZ, contratos, títulos a nível estrutural.
- Modificar telas fora do escopo (Início, Painel Executivo, etc.).
- Apagar dados existentes — toda migração é aditiva e idempotente.

Aguardo seu OK consolidado para começar pela **Fase 1** (estrutura organizacional) ou pela **Fase 2** (CCs automáticos), conforme sua prioridade. Nada será implementado sem aprovação explícita.
