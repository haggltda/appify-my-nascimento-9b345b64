## Objetivo

Gerar um relatório (XLSX) com **todas as linhas projetadas do orçamento por contrato**, no nível mais analítico disponível no banco, contendo: item granular (água, energia, salários, FGTS, combustível, materiais...), conta contábil, hierarquia DRE, centro de custo, contrato, empresa, classificadores (Direto/Indireto, Fixo/Variável, Custo/Despesa), competência e valor.

## Varredura realizada

Mapa de onde cada informação está hoje no banco:

| Informação pedida | Tabela / Coluna | Observação |
|---|---|---|
| Linha do orçamento (mensal) | `orcamento_contrato_linha` (8.152 linhas) | base do relatório |
| Valor previsto | `orcamento_contrato_linha.valor_previsto` | por competência |
| Competência (mês) | `orcamento_contrato_linha.competencia` | |
| Sub-código (4.1, 4.3, 5.1...) | `orcamento_contrato_linha.sub_codigo` | granularidade intermediária |
| Memória de cálculo | `orcamento_contrato_linha.memoria_calculo` (jsonb) | quando existe, traz qtd × valor unitário |
| Linha DRE (L01–L14) | `dre_linhas.codigo + descricao` via `dre_linha_id` | hierarquia gerencial |
| Conta contábil | `conta_contabil.classificacao + descricao` via `conta_contabil_id` | **vazio em 100% das linhas hoje** — gap |
| Centro de custo | `centros_custo.codigo + nome + tipo + categoria_gerencial + direto_indireto + fixo_variavel + dimensao` | |
| Contrato | `contrato.numero + objeto + orgao + vigencia + valor_total + faturamento_mensal + gestor` via `orcamento_contrato → contrato_id` | |
| Empresa | `empresas.codigo + razao_social + nome_fantasia + cnpj` | |
| Ciclo orçamentário | `orcamento_ciclo` (ano, versão) | |
| Direto/Indireto, Fixo/Variável | `centros_custo` + `conta_contabil.classe_contabil/tipo_gerencial` + `mz_25_stg_mapa_de_para_orcamento_contratos` | |
| Item granular (Água, Energia, FGTS, Uniformes, Vale Transporte, Salários, INSS, etc.) | `mz_25_stg_mapa_de_para_orcamento_contratos.item_orcamento` ligado por `conta_contabil_codigo` | **única fonte com esse nível hoje** |
| Fornecedor / data de lançamento | `titulo_pagar`, `lancamento_contabil`, `realizado_lancamentos` | **NÃO existe no orçamento** — só no realizado (hoje 4 títulos e 0 lançamentos) |

## Diagnóstico crítico (importante)

1. **`conta_contabil_id` está NULL em todas as 8.152 linhas de orçamento.** Hoje a granularidade real persistida é apenas `sub_codigo` (≈17 valores tipo 4.1, 4.3, 5.1...) + `dre_linha_id` (L04, L05, L07, L08, L12). Não há vínculo direto linha-de-orçamento → conta "Energia Elétrica".
2. O detalhe fino (Água, Luz, FGTS, INSS, Uniformes, Vale Transporte...) existe na staging `mz_25_stg_mapa_de_para_orcamento_contratos` na coluna `item_orcamento`, ligada à conta contábil sugerida. É o "de-para" do Excel original — usaremos para enriquecer.
3. **Fornecedor e data de lançamento NÃO existem no orçamento projetado** — só aparecem quando o título é realizado (`titulo_pagar` / `lancamento_contabil`). No relatório, essas colunas virão vazias para orçamento puro; se quiser ver fornecedor/data, é o módulo de Realizado (outro relatório).

## Plano de execução

### Passo 1 — Criar/atualizar RPC `export_orcamento_analitico_completo`
Função SQL `SECURITY DEFINER` que devolve, **uma linha por `orcamento_contrato_linha`**, com JOIN em:
- `orcamento_contrato` → `contrato` → `centros_custo`
- `empresas`, `orcamento_ciclo`, `dre_linhas`
- `conta_contabil` (quando preenchido) — fallback via `mz_25_stg_mapa_de_para_orcamento_contratos` casando por `sub_codigo`/heurística
- Expande `memoria_calculo` (jsonb) em colunas: `qtd`, `valor_unitario`, `driver`, `descricao_item`

Parâmetros: `p_limit`, `p_offset`, `p_empresa_id` (opcional), `p_ciclo_id` (opcional).

### Passo 2 — Script Python paginado
Roda a RPC em chunks de 1.000 (já validado no relatório anterior) e gera um único XLSX com:

**Colunas (nenhuma oculta):**
Empresa Código · Empresa Razão Social · CNPJ · Ciclo (Ano/Versão) · Contrato Número · Contrato Objeto · Órgão · Vigência Início · Vigência Fim · Valor Total Contrato · Faturamento Mensal · Gestor · Centro Custo Código · Centro Custo Nome · CC Tipo · CC Dimensão · CC Categoria Gerencial · CC Direto/Indireto · CC Fixo/Variável · DRE Código · DRE Descrição · DRE Natureza · Sub-código · Conta Contábil Código · Conta Contábil Descrição · Conta Tipo Gerencial · Conta Direto/Indireto · Conta Fixo/Variável · **Item Granular (Água/Energia/FGTS/...)** · Driver · Quantidade · Valor Unitário · Competência (AAAA-MM) · Valor Previsto · Origem · Source · Locked · Memória Cálculo (JSON cru) · ID linha · Created At · Updated At

Saída: `/mnt/documents/orcamento_analitico_completo.xlsx`

### Passo 3 — Entregar com diagnóstico de qualidade
Aba extra "Diagnóstico" com:
- Total de linhas e somatório por empresa/contrato
- Quantas linhas têm `conta_contabil_id` preenchido vs. enriquecido via mz_25 vs. sem match
- Lista de `sub_codigo` sem item granular mapeado (para você priorizar o de-para)

## Detalhes técnicos

- A RPC nova substitui/coexiste com `export_orcamento_completo_dump`. Recomendo manter a anterior e criar a nova com nome diferente para não quebrar nada.
- O enriquecimento por `mz_25` é heurístico (a tabela não tem FK direta para `orcamento_contrato_linha`) — vamos casar por `(empresa_id, conta_contabil_codigo)` quando possível e marcar a coluna "Item Granular" como `[mz25-match]` ou `[sem-match]`.
- Sem migrations destrutivas. Apenas `CREATE OR REPLACE FUNCTION` + `GRANT EXECUTE`.

## O que NÃO está neste relatório (e por quê)

- **Fornecedor** e **Data de Lançamento**: não pertencem ao orçamento projetado; só ao realizado. Se quiser, posso fazer um segundo relatório "Realizado vs. Orçado" puxando de `titulo_pagar` + `lancamento_contabil` (hoje com pouquíssimos dados — 4 títulos, 0 lançamentos).
