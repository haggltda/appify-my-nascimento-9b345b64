## Objetivo

Produzir um **Dicionário de Dados corporativo** em formato Microsoft Word (`.docx`), de nível profissional (padrão "big IT enterprise"), cobrindo as **236 tabelas do schema `public`** do banco Supabase do Grupo Nascimento, com colunas, tipos, constraints, relacionamentos (FKs), policies RLS, índices e diagramas de integração.

Nada será aplicado no banco. É um artefato 100% read-only, gerado em `/mnt/documents/`.

---

## Entregáveis

1. **`Dicionario_de_Dados_Grupo_Nascimento.docx`** — documento principal, navegável, com sumário (TOC), capítulos por domínio funcional e fichas técnicas por tabela.
2. **`Dicionario_de_Dados_Grupo_Nascimento_Diagramas.zip`** — pacote com diagramas Mermaid ER por domínio (`.mmd` + `.svg`), embutidos também no Word.
3. **`Dicionario_de_Dados_Grupo_Nascimento_Anexo_Tecnico.xlsx`** — anexo técnico em planilha (1 linha por coluna do banco) para consulta rápida por DBA.

---

## Estrutura do documento Word

### Capa e preâmbulo
- Capa institucional (Grupo Nascimento — Dicionário de Dados — versão, data, ambiente Supabase ref `fwmzeaztjxrxxzxzxmgc`).
- Controle de versão, escopo, convenções de leitura, glossário de tipos PostgreSQL.

### Seção 1 — Visão Executiva
- Métricas: 236 tabelas, ~XX funções, ~XX views, 562 policies RLS (extraído do A2).
- Mapa de domínios funcionais (12 domínios — ver agrupamento abaixo).
- Diagrama macro de integração entre domínios.

### Seção 2 — Convenções
- Padrões de nomenclatura (`mz_*`, `stg_*`, `fcr_*`, `aud_*`, `vw_*`, `integration_*`).
- Tipos canônicos (uuid, timestamptz, numeric(18,2), text, jsonb, enum).
- Padrão multiempresa (`empresa_id`), padrão de auditoria (`created_at`, `updated_at`, `created_by`).
- Modelo de RLS (helpers `has_role`, `user_pode_atuar_empresa`, `get_user_empresa`).

### Seção 3 — Capítulos por Domínio Funcional

Cada capítulo abre com: descrição do domínio, diagrama ER Mermaid (renderizado como imagem PNG embutida), lista de tabelas, e ficha técnica de cada tabela.

Agrupamento proposto dos 236 objetos:

| # | Domínio | Tabelas-âncora (exemplos) |
|---|---|---|
| 1 | Identidade, Acesso e Governança | `profiles`, `user_roles`, `user_empresa`, `app_menu`, `app_modulo`, `role_permissions`, `screen_permission_*`, `access_audit_log`, `sessoes_ativas`, `solicitacao_desbloqueio`, `perfil_metadata`, `permissoes_especiais` |
| 2 | Estrutura Corporativa | `empresas`, `centros_custo`, `area`, `setor`, `identidade_visual`, `parametro_geral` |
| 3 | Plano de Contas e Contabilidade | `conta_contabil`, `plano_contas_master`, `plano_contas_solicitacao`, `lancamento_contabil`, `lancamento_partida`, `regra_contabilizacao`, `dre_linhas`, `classificadores`, `classificador_valores` |
| 4 | Financeiro — Caixa & Bancos | `conta_bancaria`, `saldos_iniciais_caixa`, `movimento_bancario`, `extrato_bancario`, `conciliacao_*`, `fluxo_caixa_projetado`, `parametro_integracao_bancaria`, `banco_layout*`, `remessa_cnab*`, `retorno_bancario*` |
| 5 | Contas a Receber e Cobrança | `titulo_receber`, `titulo_receber_baixa`, `cobranca_*`, `regua_cobranca*`, `cronograma_faturamento`, `nfse` |
| 6 | Contas a Pagar | `titulo_pagar`, `pre_titulo_pagar`, `pre_titulo_*`, `malote_pagamento`, `malote_titulo`, `financeiro_pagamento_*` |
| 7 | Fiscal | `nota_fiscal`, `nota_fiscal_item`, `nota_fiscal_evento`, `nf_entrada*`, `apuracao_imposto*`, `empresa_fiscal_config`, `parametro_fiscal`, `cfop`, `servico_municipal` |
| 8 | Contratos, Orçamento e BDI | `contrato`, `contrato_posto`, `contrato_dissidio`, `contrato_comprovacao`, `orcamento_*`, `bdi_*`, `base_dissidio_categoria` |
| 9 | Suprimentos e Estoque | `fornecedor*`, `produto*`, `requisicao_compra*`, `pedido_compra*`, `cotacao*`, `parametro_cotacao`, `almoxarifado`, `estoque_*`, `recebimento_nf*`, `sup_aprov_*` |
| 10 | RH e Folha | `colaborador`, `colaborador_conta_bancaria`, `alocacao_colaborador`, `folha_periodo`, `folha_evento` |
| 11 | Licitações, Pareceres e Plano de Ação | `licitacao*`, `comite`, `plano_acao*`, `ia_*`, `copiloto_*`, `aprov_*`, `alcada_aprovacao`, `ocorrencia_operacional`, `notificacoes`, `template_mensagem`, `anexos` |
| 12 | Integração e Migração (mz_*, stg_*, fcr_*, integration_*, aud_*, audit_log*) | toda a camada de staging, integração, reconciliação e auditoria |

### Seção 4 — Ficha técnica por tabela (padrão repetido)

Para **cada uma das 236 tabelas**, uma ficha padronizada de 1–2 páginas:

- **Cabeçalho:** nome qualificado (`public.<tabela>`), descrição funcional, domínio, dono lógico, criticidade, volumetria (linhas + tamanho).
- **Tabela de colunas** (estilo enterprise):

| # | Coluna | Tipo | Nulo? | Default | PK | FK → | Único | Descrição |
|---|---|---|---|---|---|---|---|---|

- **Chaves e índices:** PK, UKs, índices secundários, partial indexes.
- **Relacionamentos:** FKs de entrada e saída (com cardinalidade).
- **Regras de integridade:** CHECKs, triggers, validações via função.
- **Segurança (RLS):** RLS habilitada (S/N), GRANTs por role, lista de policies (nome, comando, expressão USING/WITH CHECK resumida).
- **Triggers e funções relacionadas:** lista com propósito.
- **Observações operacionais:** quando aplicável (ex.: tabela particionada `audit_log_*`, tabela de staging não-runtime, view `security definer`, etc.).

### Seção 5 — Anexos
- **A. Glossário** de termos de negócio (DRE, OBZ, CNAB, NFSe, BDI, FCR, etc.).
- **B. Catálogo de funções/RPCs** (`has_role`, `can_access`, `pres_caixa_status`, `dre_realizado`, `fluxo_caixa_diario`, `integration_promote_batch`, etc.) — assinatura, propósito, SECURITY DEFINER S/N.
- **C. Catálogo de views** (11 views, incluindo alerta de `security definer` default — referenciando A2).
- **D. Diagrama ER macro** (todos os domínios em uma página A3 paisagem).
- **E. Findings de governança** (resumo do A2 — RLS 100%, F1–F9).
- **F. Lista de tabelas inativas / candidatas a depreciação** (`conciliacao_regra` vazia, duplicidade `mz_*`/`stg_*`).

---

## Detalhes técnicos de execução (para revisão do DBA)

### Fonte dos metadados (tudo via `supabase--read_query`, read-only)

1. `information_schema.columns` + `pg_catalog.pg_attribute` → colunas, tipos exatos, defaults, NOT NULL, comentários (`col_description`).
2. `pg_constraint` → PKs, UKs, FKs (com `confdeltype`/`confupdtype`), CHECKs.
3. `pg_index` → índices, parciais, expressões.
4. `pg_class` + `pg_stat_user_tables` → volumetria (linhas, `pg_total_relation_size`).
5. `pg_policies` → RLS policies (cmd, roles, qual, with_check).
6. `information_schema.role_table_grants` → GRANTs por role.
7. `pg_proc` + `pg_trigger` → triggers e funções associadas.
8. `pg_description` → COMMENT ON TABLE/COLUMN quando existirem.

Resultado consolidado em JSON intermediário (`/tmp/dd_metadata.json`).

### Geração do Word
- **Skill `docx`** (docx-js) para construção programática:
  - Página A4 retrato, margens 2cm, fonte Arial 10pt corpo / 14pt headings.
  - Estilos `Heading1` (domínio), `Heading2` (tabela), `Heading3` (subseção).
  - `TableOfContents` automático (3 níveis).
  - Tabelas com `WidthType.DXA`, bordas cinza `CCCCCC`, header com shading `D5E8F0`.
  - Cabeçalho com logo/título, rodapé com paginação e versão.
  - Diagramas ER renderizados via Mermaid CLI (`mmdc`) → PNG → embutidos como `ImageRun`.
- Validação obrigatória pós-geração (`validate_document.py`) e QA visual (converter para PDF + imagens das primeiras páginas de cada capítulo).

### Estratégia de tamanho
- 236 tabelas × ~1,5 página ≈ 350 páginas. Documento será grande mas navegável via TOC + bookmarks por domínio e por tabela.
- Geração em lote por domínio para controle de memória do docx-js.

### Diagramas ER
- 1 diagrama Mermaid `erDiagram` por domínio (12 diagramas) + 1 diagrama macro inter-domínios.
- Renderização via `npx -y @mermaid-js/mermaid-cli` para PNG @ 200dpi.

### Anexo Excel
- Aba `colunas` (1 linha por coluna, ~3.500 linhas), `tabelas` (236), `fks`, `policies`, `indices`, `funcoes`, `triggers`, `views`.

---

## Premissas e limites

- **Somente schema `public`.** `auth`, `storage`, `extensions`, `realtime` ficam fora.
- **Sem alteração** em nada: nenhuma migration, nenhum GRANT, nenhuma policy. Apenas leitura via `supabase--read_query`.
- Descrições funcionais inferidas de: nome da tabela, colunas, FKs, código frontend que a consome, e documentos em `.lovable/` (A1, A2, auditoria-v2, etc.). Onde não houver evidência, o campo "Descrição" será marcado como `(a confirmar com área de negócio)` em vez de inventado.
- Volumetria é snapshot no momento da extração.

---

## Etapas de execução (após aprovação)

1. Extrair metadados completos do `public` (8 queries consolidadas).
2. Consolidar em JSON intermediário e classificar tabelas nos 12 domínios.
3. Gerar 12 diagramas Mermaid + diagrama macro → PNG.
4. Gerar `Dicionario_de_Dados_Grupo_Nascimento.docx` via docx-js.
5. Validar `.docx` e fazer QA visual (PDF + imagens de amostra).
6. Gerar anexo Excel.
7. Empacotar diagramas em ZIP.
8. Entregar os 3 artefatos em `/mnt/documents/` via `<presentation-artifact>`.

---

## Aprovação necessária

Confirmar:
- (a) **Os 12 domínios** propostos fazem sentido, ou prefere outro agrupamento?
- (b) **Idioma:** documento em **Português (BR)**, certo?
- (c) Manter **todas as 236 tabelas** (incluindo `mz_*`, `stg_*`, `fcr_*`, `audit_log_*` particionadas, `aud_*` snapshots) ou **excluir staging/auditoria** do dicionário principal (e deixá-las só em apêndice resumido)?
- (d) Incluir **policies RLS na íntegra** (USING/WITH CHECK completo) ou apenas resumo (nome + cmd + roles)?
