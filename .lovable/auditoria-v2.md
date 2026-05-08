
# Bloco 1 — Auditoria técnica V2

Snapshot: 2026-05-08. Schema `public`.

## 1. Volumetria — produtivo vs `mz_*`

| Domínio | Produtiva | Linhas | `mz_*` correspondente | Linhas | Gap |
|---|---|---:|---|---:|---|
| Contratos | `contrato` | **0** | (cabeçalhos derivados de `mz_50` ou `stg_contratos_master`) | 47.739 | promover |
| Cronograma faturamento | `cronograma_faturamento` | **0** | — | — | gerar a partir de contratos |
| Títulos a receber | `titulo_receber` | **0** | `mz_29_stg_titulos_migracao` | n/d | promover |
| Títulos a pagar | `titulo_pagar` | **0** | `mz_29_stg_titulos_migracao` | n/d | promover |
| Razão contábil | `lancamento_contabil` | 171 | `mz_32_fato_razao_contabil` | **215.210** | promover |
| Partidas | `lancamento_partida` | n/d | `mz_31_fato_partidas_dobradas` | n/d | promover |
| Realizado mensal | `realizado_lancamentos` | **0** | `mz_60`, `mz_61` (views) | n/d | materializar |
| Orçamento contratos | `orcamento_contrato` / `_linha` | **0** | `mz_50_fato_orcamento_contratos_competencia` | **47.739** | promover |
| Fluxo realizado | `movimento_bancario` + `extrato_bancario` | **0** + 0 | `mz_40_fato_fluxo_caixa_realizado` | **58.966** | promover |
| Fluxo projetado | `fluxo_caixa_projetado` | **0** | `mz_41_fato_fluxo_caixa_projetado` | **5.097** | promover |

**Cadastros base já saudáveis:** `empresas` (6), `centros_custo` (686), `conta_contabil` (1.194), `dre_linhas` (28), `user_roles` (7).

## 2. Roles e RLS

- Enum `app_role` **já contém `presidencia`** ✅ — não precisa migration de role no Bloco 9.
- Demais roles: `admin, controladoria, comercial, operacional, juridico, sst, diretor_adm, diretor_op, visitante, comprador, almoxarife, gestor_cc, fiscal_recebedor, financeiro, fiscal`.
- **Todas as tabelas `public.*` têm RLS habilitada** (zero tabelas sem RLS). Manter inalteradas salvo aprovação explícita.
- `role_permissions` existe → usar como fonte de granularidade.
- `has_role(uuid, app_role)` e `get_user_empresa(uuid)` disponíveis.

## 3. Funções/RPCs já existentes (reaproveitar)

Financeiro/contábil (não recriar):

- `emitir_titulo_de_cronograma`, `emitir_titulos_cronograma_lote`, `faturar_contrato_competencia`
- `gerar_orcamento_contrato`
- `titulo_baixar`, `titulo_agendar`, `titulo_receber_atualizar_status`, `titulo_receber_marcar_vencidos`
- `contabilizar_baixa_pagar`, `contabilizar_baixa_receber`, `contabilizar_nota_fiscal`
- `trg_baixa_receber_contabiliza`, `trg_titulo_pagar_contabiliza`, `trg_nf_autorizada_contabiliza`
- `dre_realizado`, `balancete`, `balanco_patrimonial`, `apurar_impostos_competencia`
- `extrato_importar`, `conciliacao_auto_match`
- `cnab_gerar_remessa`, `cnab_processar_retorno`, `cobranca_gerar_boleto`, `cobranca_gerar_pix`
- `proximo_numero_lancamento`

Integração/staging (já maduro):

- `integration_approve_batch`, `integration_promote_batch`, `integration_reject_batch`, `integration_materialize_staging`, `integration_resolve_alias`
- Tabelas: `integration_batches`, `integration_batch_files`, `integration_layouts`, `integration_layout_columns`, `integration_validation_rules/results`, `integration_alias_*` (empresas, contratos, centros_custo, bancos, formas_pagamento), `integration_load_runs`.

**Implicação:** o Bloco 2 (Governança/dedupe) deve **estender** `integration_*` em vez de criar tabela `carga_lote` paralela. Reduz custo e risco.

## 4. Views existentes

- `v_dre_comparativo`, `v_realizado_mensal`, `v_obz_mensal`, `v_fluxo_caixa_mensal`
- `vw_bi_resumo_empresa`, `vw_dre_contrato`
- `vw_mz_32_promocao_status` (já existe controle de promoção da razão!)

**Falta apenas** o conjunto `vw_presidencia_*` (Bloco 9).

## 5. Duplicidades / pendências encontradas

| Item | Decisão proposta |
|---|---|
| `conciliacao_regra` (0) e `conciliacao_regras` (0) ambas vazias e sem uso | Manter `conciliacao_regras` (plural, padrão das demais), descartar `conciliacao_regra` em migration de cleanup no Bloco 6. |
| Dois conjuntos de staging: `mz_*` e `stg_*` | `mz_*` = pacote zero (migração inicial). `stg_*` = pacotes 02+. Política: **não usar nenhum em runtime**. Promoção controlada via Blocos 2-4. |
| `mz_32_promocao_log` + `vw_mz_32_promocao_status` já existentes | Reutilizar como template para promoção dos demais `mz_*`. |
| `contrato` vazio | Bloqueador da Etapa 1 do Faturamento. Resolvido no Bloco 4 (promoção `mz_50` → `contrato` + `cronograma_faturamento`). |
| Aprovação: existem `aprov_*` E `sup_aprov_*` | `aprov_*` = workflow genérico. `sup_aprov_*` = específico de Suprimentos (RC/PC). Manter ambos; financeiro usa `aprov_*`. |

## 6. Telas/rotas afetadas pelo escopo V2

| Bloco | Rotas/arquivos principais |
|---|---|
| 2 | nova `Admin > Cargas` (estender `pages/integracao/Batches.tsx` + `BatchDetalhe.tsx`) |
| 3 | nova UI de pendências (estender `pages/integracao/Aliases.tsx`) |
| 4 | back-office only (RPCs + tela de promoção) |
| 5 | `pages/controladoria/PlanejadorOBZ.tsx` + integração com aprovação de pré-título |
| 6 | nova `pages/financeiro/FluxoCaixa.tsx` |
| 7 | `pages/contabil/{Lancamentos,Balancete,DRE,Balanco}.tsx` (já existem — enriquecer) |
| 8 | `pages/financeiro/{ContasReceber,ContasPagar,IntegracaoBancaria,MovimentosBancarios}.tsx` |
| 9 | nova `pages/presidencia/PainelExecutivo.tsx` + 7 views |

## 7. Ajustes ao plano original

1. **Bloco 2:** estender `integration_*` em vez de tabela paralela `carga_lote`. Economia estimada: 5-8 créditos.
2. **Bloco 9:** sem migration de role (já existe). Economia estimada: 2 créditos.
3. **Bloco 3:** as `integration_alias_*` já cobrem empresa/CC/contrato/banco/forma_pagamento. Faltam: `integration_alias_contas_contabeis` e `integration_alias_dre`. Reduz escopo do Bloco 3.

## 8. Bloqueios / decisões pendentes

1. **Origem dos contratos**: promover de `mz_50` (proxy custo+markup) ou aguardar planilha oficial de receita? — bloqueador da Etapa 1 do Faturamento.
2. **`mz_29_stg_titulos_migracao`**: contém títulos históricos? Consultar antes do Bloco 8.
3. **Mapeamento empresa**: confirmar regra de bloqueio quando sigla for ambígua (RAC/SPNE/HAGG/LF/NH/SN sem CNPJ).

## 9. Próximo passo

Avançar para **Bloco 2 — Governança/dedupe sobre `integration_*`**, criando:

- Coluna `hash_dedup` nas fatos produtivas-alvo.
- Função `fn_simular_lote(batch_id)` (relatório seco).
- Estender `integration_promote_batch` para emitir reconciliação por empresa/competência/CC/contrato/conta antes de inserir.
- Tela `Admin > Cargas` com aba "Reconciliação" e botão "Rollback por batch".

Aguardando OK no checkpoint após este auditório, **especialmente sobre o item 1 da seção 8** (bloqueador imediato).
