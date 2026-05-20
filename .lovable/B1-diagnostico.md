# Bloco 1 — Diagnóstico e Inventário Técnico

**Modo:** PLAN MODE / 100% read-only. Nenhuma alteração foi feita no banco, storage, edge functions ou código-fonte.
**Data:** 2026-05-20
**Anexos:** `.lovable/B1-anexo-bento-parsed.json` (parse célula a célula da planilha `Bento Gonçalves 002.2021.xlsm`).

> **Terminologia §3 do Prompt Mestre usada literalmente:** `existe` / `parcial` / `não identificado na estrutura atual` / `visual sem governança` / `gravação sem validação` / `técnico-desalinhado` / `sem evidência técnica suficiente`.

---

## 1. Inventário de base — números agregados

| Recurso | Quantidade | Observação |
|---|---|---|
| Tabelas em `public` | **234** | Todas com `rls_enabled = true` |
| Views em `public` | 11 | 4 são `SECURITY DEFINER` → linter ERROR |
| Funções `SECURITY DEFINER` | **~120+** | Maioria de domínio contábil/financeiro/cotação |
| Buckets de storage | 10 | 2 públicos (`avatars`, `colaboradores-fotos`), 8 privados |
| Findings do linter Supabase | **291** | 4 ERROR + WARNs |
| Tabelas com **apenas 1 policy** | **61** | Risco de cobertura RLS incompleta |

---

## 2. Inventário de frentes funcionais (§29 — matriz 1)

Cobertura macro (rota + pasta + estado). Detalhe de RPCs/edge functions é referenciado quando relevante para o bloco subsequente.

| # | Frente | Rota / página | Tabelas / RPCs / funções principais | Edge funcs | Estado |
|---|---|---|---|---|---|
| 1 | **Editais** | `/app/...` `src/pages/CadastroEdital.tsx` | `stg_licitacoes`, `licitacao` | — | **parcial** (cadastro existe; ciclo edital→triagem→licitação não integrado de ponta a ponta — verificar B12) |
| 2 | **Triagem IA** | `src/pages/TriagemIA.tsx` | `ia_triagens` (3 policies), `ia_provedores`, `ia_feedback` | — | **parcial** (tabelas existem; UX e governança a auditar — B12/B13) |
| 3 | **Licitações** | `src/pages/Pipeline.tsx`, `Pregao.tsx`, `Composicao.tsx`, `CustosBDI.tsx`, `Resultado.tsx`, `Parecer.tsx`, `Presidencia.tsx` | `licitacao`, `comite`, `parecer*`, `mz_05_dim_eventos_contabeis` (referência) | — | **existe** (várias telas) — falta consolidação ponta a ponta |
| 4 | **Contratos** | `src/pages/contratos/*` (Ativos, Detalhe, Empenhos, Encerramentos, Faturamento, Implantacao, Medicoes, Postos, Reajustes) | `contrato` (4 pol), `contrato_posto` (2), `contrato_dissidio` (2), `contrato_comprovacao` (2), `cronograma_faturamento` (2) | — | **existe** + UX rica; governança RLS a auditar |
| 5 | **Mobilização** | `contratos/Implantacao.tsx` | `contrato_comprovacao` | — | **parcial** (não há checklist documental dedicado — B11) |
| 6 | **Orçamento contrato / OBZ** | `controladoria/PlanejadorOBZ.tsx`, `OBZVersoes.tsx`, `pages/Orcamento.tsx` | `orcamento_ciclo`, `orcamento_contrato`, `orcamento_contrato_linha`, `obz_periodos`, `obz_valores`, RPC `gerar_orcamento_contrato` | — | **parcial** (ciclo existe; FCR/zerada não confirmada — B3) |
| 7 | **DRE / FCR** | `contabil/DRE.tsx`, `DREGerencialReal.tsx`, `controladoria/DRE.tsx`, `DREGerencial.tsx` | `dre_linhas` (4), `mz_40/41/50/60/61`, RPCs `dre_realizado`, `dre_gerencial_mensal`, `dre_gerencial_competencia`, `vw_dre_contrato` | — | **existe + técnico-desalinhado** (DRE projetada zerada — alvo do B3) |
| 8 | **Requisições** | `suprimentos/Requisicoes.tsx` | `requisicao_compra`, `_item`, `_log`, `_status_hist` (1 pol) | — | **existe** — `_status_hist` com 1 policy = revisar B2 |
| 9 | **Cotações** | `suprimentos/Cotacoes.tsx` | `cotacao` (4), `cotacao_item`/`_fornecedor`/`_proposta`/`_proposta_item`/`_rc` (todas 1 pol) | — | **gravação sem validação** (RLS frágil em 5 filhas — flag B2) |
| 10 | **Pedidos de Compra** | `suprimentos/PedidosCompra.tsx`, `AprovacoesCompras.tsx` | `pedido_compra`, `pedido_compra_item`, `sup_aprov_*` (3 tabelas com 1 pol) | — | **existe**; alçadas com policies frágeis |
| 11 | **Estoque** | `suprimentos/Estoque.tsx`, `MovimentosEstoque.tsx`, `Almoxarifados.tsx`, `Recebimentos.tsx` | `estoque_saldo`, `_lote`, `_reserva`, `_movimento` (3 pol), `almoxarifado` | — | **existe** |
| 12 | **NF Entrada** | `suprimentos/NFEntrada.tsx` | `nota_fiscal` (2), `nota_fiscal_item`, `nf_entrada_item`, `nf_entrada_log`, RPC `contabilizar_nf_entrada` | `nf-import-xml`, `nf-consultar-sefaz` | **existe** |
| 13 | **Pré-Títulos a Pagar** | `financeiro/pagar/PreTitulosTab.tsx` | `pre_titulo_pagar`, `_rateio`, `_anexo` | — | **existe** |
| 14 | **Programação de Pagamento** | `financeiro/ProgramacaoPagamentos.tsx`, `pagar/MalotesTab.tsx` | `malote_*`, RPCs `malote_criar/adicionar_titulo/executar`, `cnab_gerar_remessa` | — | **existe** |
| 15 | **Pós-pagamento / Validação** | `financeiro/ValidacaoPosPagamento.tsx` | `financeiro_pagamento_aprovacao/log/validacao` | — | **existe** |
| 16 | **Conciliação Bancária** | `financeiro/ConciliacaoFluxoCaixa.tsx`, `MovimentosBancarios.tsx`, `IntegracaoBancaria*` | `extrato_bancario` (2), `movimento_bancario`, `conciliacao_regra/regras/match`, RPCs `conciliacao_auto_match`, `extrato_importar` | — | **existe** |
| 17 | **Pedido de Faturamento** | **não identificado na estrutura atual** | **não existe tabela `pedido_faturamento`** (verificado por `information_schema`); `cronograma_faturamento` cobre apenas cronograma | — | **NÃO IDENTIFICADO** — modelagem completa em B5–B7 |
| 18 | **NF Saída** | `fiscal/NotasFiscais.tsx`, `contratos/Faturamento.tsx`, RPC `faturar_contrato_competencia`, `emitir_titulo_de_cronograma` | `nota_fiscal`, `nota_fiscal_item`, `nota_fiscal_evento`, `nfse` | — | **parcial** (emissão existe; vínculo com Pedido de Faturamento não existe) |
| 19 | **Contas a Receber** | `financeiro/ContasReceber.tsx`, `financeiro/receber/*` (Faturamento, Cobrança, Régua, Remessa, Títulos) | `titulo_receber`, `_baixa`, `cobranca_boleto/pix/evento` (1 pol cada), `regua_cobranca*` (1 pol), `remessa_cnab_titulo` (1 pol), RPC `contabilizar_baixa_receber`, `cobranca_gerar_boleto/pix` | — | **existe + gravação sem validação** (família cobrança/régua com RLS frágil) |
| 20 | **Dashboards / BI** | `bi/Dashboard.tsx`, `Inicio.tsx`, `PainelExecutivo.tsx` | `vw_bi_resumo_empresa`, `v_*` views, `v_ia_contexto_empresa` | — | **parcial** |
| 21 | **Permissões / Acessos** | `admin/AcessosPermissoes.tsx`, `admin/tabs/*` | `app_menu`, `app_modulo`, `has_screen_access`, `has_permissao`, `access_audit_log` | — | **existe** |
| 22 | **Workflow Aprovações** | `aprovacoes/Inbox.tsx`, `pages/Aprovacoes.tsx` | `aprov_etapa` (2), `aprov_instancia` (2), `alcada_aprovacao` (4), `sup_aprov_*` (1 cada) | `sla-escalonamento-tick` | **parcial** (anexos no aprovador = pendência B8/B20) |
| 23 | **Anexos / Storage** | (transversal) | `anexos` (4 pol), bucket `anexos` (priv.) com 4 policies storage | — | **existe** — bucket vazio (0 objetos) ⇒ ainda não usado em produção |

---

## 3. Matriz ponta-a-ponta inicial (§29 — matriz 2)

### Fluxo COMPRAS (Edital → DRE)
```
Edital ─► Licitação ─► Contrato ─► Mobilização ─► Orçamento
  │           │           │             │             │
  └─ Triagem  └─ Pipeline └─ Postos     └─ Checklist  └─ OBZ
                                          (parcial)
            └─► RC ─► Cotação ─► Pedido Compra ─► NF Entrada
                                       │                │
                                       └─► Aprovação ───┴► Estoque ─► Pré-Título ─► Programação ─► Pagamento ─► Conciliação ─► DRE
```
**Buracos identificados:**
- Mobilização → sem checklist documental formal (B11).
- Pedido Compra → Aprovação: alçadas `sup_aprov_*` com 1 policy → revisar B2.
- DRE realizada existe; **DRE projetada zerada** = pendência B3.

### Fluxo FATURAMENTO (Contrato → CR)
```
Contrato ─► Cronograma ─► [PEDIDO DE FATURAMENTO] ─► NF Saída ─► Título Receber ─► Cobrança ─► Baixa ─► DRE
                                  │
                                  └─ Documentos exigidos (anexos)
                                  └─ Aprovação financeira (com anexos)
```
**Buracos identificados:**
- **`pedido_faturamento` não existe.** É o nó central e está ausente — bloqueia §6–§10 inteiros.
- `cobranca_*` e `regua_cobranca*` com apenas 1 policy cada (gravação sem validação adequada).
- Anexos no momento da aprovação financeira **não implementados** (tabela `anexos` + bucket existem, mas zero objetos e zero vínculo no fluxo).

---

## 4. Parse da planilha `Bento Gonçalves 002.2021.xlsm`

Anexo completo: `.lovable/B1-anexo-bento-parsed.json`.
Estrutura confirmada: **7 abas** (não é divergência — Bento sempre teve 7).

### 4.1 Aba `Lista NFs` — **dicionário das 33 colunas reais** (header em linha 2)

| Col | Campo planilha | Tipo inferido | Candidato no ERP | Gap |
|---|---|---|---|---|
| 3 | Mês | texto | `nota_fiscal.competencia` (parcial) | OK |
| 4 | Data emissão | data | `nota_fiscal.data_emissao` | OK |
| 5 | Nº nota | int | `nota_fiscal.numero` | OK |
| 6 | Competência | data | `nota_fiscal.competencia` | OK |
| 7 | Variação | num | **não identificado** | criar campo |
| 8 | Código | texto | `contrato.codigo`/`numero` | mapear |
| 9 | Cliente/serviço/contrato/cidade | texto (composto) | `contrato.cliente_id` + `descricao` + `cc` | normalizar |
| 10 | AC | texto/flag | **não identificado** (aceite cliente?) | criar |
| 11 | Situação site P.M.T. | texto | **não identificado** (status portal município) | criar campo de status documental |
| 12 | Situa Domínio | texto | **não identificado** | criar |
| 13 | Valor contrato exec. | money | `cronograma_faturamento.valor_previsto` | mapear |
| 14 | Valor contábil | money | `nota_fiscal.valor_total` | OK |
| 15 | Vlr liq. | money | `titulo_receber.valor_liquido` | mapear |
| 16 | Data pagamento | data | `titulo_receber_baixa.data` | OK |
| 17 | Valor recebido | money | `titulo_receber_baixa.valor` | OK |
| 18 | ISSQN | money | `nota_fiscal.iss` | mapear |
| 19 | INSS | money | `nota_fiscal.inss` | mapear |
| 20 | IR | money | `nota_fiscal.irrf` | mapear |
| 21 | COFIS [sic = COFINS] | money | `nota_fiscal.cofins` | mapear |
| 22 | PIS | money | `nota_fiscal.pis` | mapear |
| 23 | CSLL | money | `nota_fiscal.csll` | mapear |
| 24 | Total Ret. | money | derivar | calcular |
| 25 | Faltas | money/qtd | **não identificado** | criar (deduções de medição) |
| 26 | Posto não implementado | money | **não identificado** | criar |
| 27 | Multas antes da emissão | money | **não identificado** | criar |
| 28 | Multas depois da emissão | money | **não identificado** | criar |
| 29 | Glosas antes da emissão | money | **não identificado** | criar |
| 30 | Glosas depois da emissão | money | **não identificado** | criar |
| 31 | Outros descontos antes da emissão | money | **não identificado** | criar |
| 32 | Outros descontos após emissão | money | **não identificado** | criar |
| 33 | Descontos de conta vinculada | money | **não identificado** | criar |
| 34 | Obs | texto livre | `nota_fiscal.observacoes` (verificar) | OK |

**Conclusão §15 (campos não promovidos):** colunas **7, 10, 11, 12, 25–33** (~13 campos) **não têm correspondência atual no ERP**. Tratamento detalhado em **B4**.

### 4.2 Aba `NF Item 1..5` — **checklist documental + tributos + status**
Estrutura confirmada (extração ad-hoc das células reais):

- **Cabeçalho do contrato** (linhas 4–10, cols 13–17): `Data emissão`, `Situação`, `N° contrato` (`002/2021`), `Prazo pagamento` (`30 dias úteis após a emissão`), `Competência`, `Início` (`2021-01-20`), `Acumulador` (`21`), `Conta pagamento` (`BANRISUL AG: 0949 / CC: 06.1421700-6`), `Status NF` (`Pendente`).
- **Bloco Retenção de impostos** (linhas 10–14, cols 13–15): `ISSQN 0.03`, `INSS 0.11`, `IR 0.048`, `COFIS`, `PIS`, `CSLL`, `Código do serviço LCC 116`.
- **Bloco "Documentos para enviar com a NF"** (linhas 5 em diante, col 2 = nome doc, col 8 = `Status`, col 9 = `Conferência de cobrança`). Documentos identificados nas amostras:
  1. SEFIP DO MÊS DE COMPETÊNCIA
  2. EXTRATO MENSAL MÊS DE COMPETÊNCIA
  3. RESUMO MENSAL MÊS DE COMPETÊNCIA
  4. COMPROVANTE DE PGMTO DE SALÁRIOS MÊS DE COMP
  5. CONTRACHEQUES DO MÊS COMPETÊNCIA
  6. COMPROVANTE PAGAMENTO VA MÊS COMPETÊNCIA
  7. COMPROVANTE PAGAMENTO VT MÊS COMPETÊNCIA
  8. RELAÇÃO DE COLABORADORES/POSTO/CARGA HORÁRIA
  9. FOLHA PONTO ASSINADA DO COLABORADOR
  + observações livres (col 9) com instruções de envio.

**Implicação para B8 (Documentos exigidos por contrato):** o ERP precisa de **catálogo de documentos exigidos** vinculados ao `contrato` (ou ao `cronograma_faturamento`) com `status` por competência e **anexo obrigatório no momento da aprovação financeira do Pedido de Faturamento**.

### 4.3 Aba `Base de dados`
Estrutura: 30 colunas × 93 linhas. Inspeção amostral revelou apenas o título "Base de dados" em (2,2). Conteúdo real começa em linha ≥ 3 — **vou expandir o dicionário em B5** (quando a modelagem for tratada). Já confirma a divergência vs. Prompt Mestre (que descrevia C49) — o real é maior (M93 / 30×93).

### 4.4 Veranópolis
**Arquivo não está mais em `/tmp`** neste turno. Para parse equivalente preciso que seja reanexado (ou aceitar usar apenas Bento como template — Veranópolis tem mesma estrutura macro com mais NFs individuais).

---

## 5. Inventário de funções `SECURITY DEFINER` (resumo por domínio)

Total: **120+** funções (lista completa cacheada em tool-result; será re-extraída no B2 para auditoria de `search_path`, `RAISE EXCEPTION`, validação de permissão). Agrupamento:

| Domínio | Exemplos | Risco |
|---|---|---|
| Contábil | `gerar_lancamento_contabil`, `contabilizar_baixa_pagar`, `contabilizar_baixa_receber`, `contabilizar_folha`, `contabilizar_nf_entrada`, `contabilizar_nota_fiscal`, `estornar_lancamento_contabil`, `balancete`, `balanco_patrimonial`, `dre_realizado`, `dre_gerencial_mensal`, `dre_gerencial_competencia` | Validar `search_path = public` |
| Faturamento | `faturar_contrato_competencia`, `emitir_titulo_de_cronograma`, `emitir_titulos_cronograma_lote`, `fn_gerar_cronograma_provisorio` | **alvo de B5–B9** |
| Cotação | `cotacao_calcular_score`, `cotacao_fechar`, `cotacao_recalc_proposta`, `cotacao_recalc_total_frete` | Auditar com policies frágeis |
| Conciliação / Bancos | `cnab_gerar_remessa`, `cnab_gerar_remessa_cobranca`, `cnab_processar_retorno`, `conciliacao_auto_match`, `extrato_importar`, `cobranca_gerar_boleto`, `cobranca_gerar_pix` | OK |
| Apuração fiscal | `apurar_impostos_competencia` | OK |
| Estoque | `estoque_aplicar_movimento`, `estoque_aplicar_reserva` | OK |
| Folha | `colaborador_conta_bancaria_principal_unica`, `fornecedor_conta_bancaria_principal_unica`, `_conta_contabil_de_banco` | OK |
| Acesso / Admin | `has_permissao`, `has_screen_access`, `admin_alterar_empresa_cc`, `diagnostico_alterar_empresa_cc` | Críticas — auditoria obrigatória |
| Migração (MZ) | `aplicar_plano_mestre`, `fn_promover_contratos_mz50`, `layout_*`, `integration_*` | OK |
| Fluxo de caixa | `fluxo_caixa_diario*` (4 variantes — 1 é `INVOKER`) | Verificar diferença `DEFINER` vs `INVOKER` |

---

## 6. Inventário de Storage

| Bucket | Público | Objetos | Tamanho | Policies | Estado |
|---|---|---|---|---|---|
| `avatars` | ✅ | 5 | 0.81 MB | 4 (CRUD por owner + admin) | OK |
| `colaboradores-fotos` | ✅ | 1 | 0.18 MB | 4 (público read + auth CUD) | OK |
| `fcr-uploads` | ❌ | 13 | 28.25 MB | 5 (CRUD + select_global) | OK |
| `integration-uploads` | ❌ | 2 | 3.37 MB | 3 | OK |
| `migracao-zero` | ❌ | 32 | 278.40 MB | 4 (admin only) | OK |
| `pre-titulos-fiscal` | ❌ | 4 | 16.69 MB | 3 (auth) | OK |
| **`anexos`** | ❌ | **0** | — | 4 (CRUD via tabela `anexos`) | **PRONTO MAS NÃO USADO** |
| `copiloto-audios` | ❌ | 0 | — | 3 (own) | OK |
| `nfe-xml` | ❌ | 0 | — | 3 (por empresa) | OK |
| `identidade-visual` | ❌ | 0 | — | 4 (admin) | OK |

**Conclusão crítica para o seu requisito (anexar documentos na aprovação financeira):**
A infraestrutura existe (`anexos` tabela com 4 policies + bucket privado com 4 policies). **O que falta** é:
1. UI de upload no aprovador financeiro (B20).
2. Catálogo de documentos exigidos por contrato (B8).
3. Vínculo `anexo ↔ pedido_faturamento ↔ etapa_aprovacao` (B8/B20).

---

## 7. Findings críticos do Supabase Linter

**Total: 291 issues** — destaques:

| Severidade | Tipo | Qtd aprox. | Ação |
|---|---|---|---|
| **ERROR** | `0010_security_definer_view` | **4 views** | Auditoria em B2 — identificar quais views e se podem ser convertidas para `security_invoker` |
| WARN | `0011_function_search_path_mutable` | dezenas | Padronizar `SET search_path = public` em todas as funções (B2) |
| WARN | `0014_extension_in_public` | 1+ | Mover extensão para schema próprio (B2) |
| WARN | `0024_permissive_rls_policy` | múltiplos | **Tabelas com `USING (true)` ou `WITH CHECK (true)` em UPDATE/DELETE/INSERT** — risco de bypass de tenant (B2 prioritário) |

> Decisão acordada: **B2 fica por último**, mas estes WARNs do tipo `0024` afetam diretamente a integridade multiempresa. Recomendação: revalidar com você se algum desses não deveria subir de prioridade.

---

## 8. Flags de risco por bloco futuro (cruzando RLS frágil ↔ escopo do bloco)

| Bloco | Tabelas que ele tocará | Status RLS atual | Flag |
|---|---|---|---|
| B3 DRE projetada zerada | `mz_*` series (todas com 1 policy), `orcamento_*` (2 pol) | mz_* = só admin? validar | ⚠️ confirmar regra antes |
| B4 Campos não promovidos | depende dos campos B5 | — | — |
| B5 Pedido Faturamento | criar `pedido_faturamento*` (não existe) | — | criar com RLS desde o início |
| B8 Documentos exigidos | `anexos` (4), `contrato_comprovacao` (2) | OK | OK |
| B9 NF saída / CR | `cobranca_boleto/pix/evento` (1 pol), `regua_cobranca*` (1) | **frágil** | ⚠️ revisar antes de gravar |
| B10 OS/Empenho | tabelas a definir | — | — |
| B12 Triagem IA | `ia_triagens` (3) | OK | OK |
| B14 Orçamento/DRE | `orcamento_contrato*` (2), `dre_linhas` (4) | OK | OK |
| B20 Workflow Aprovações | `aprov_etapa/instancia` (2), `sup_aprov_*` (1) | **frágil** | ⚠️ |
| B21 Storage | bucket `anexos` (4 pol) | OK | OK |

---

## 9. Divergências e ruídos identificados

1. **`pedido_faturamento` não existe** no schema. Confirmado por `information_schema.tables`. Toda a §6–§10 do Prompt Mestre será modelagem nova (B5).
2. Bento tem **7 abas** (consistente com Prompt Mestre); arquivo Veranópolis precisa ser reanexado para B5.
3. `Base de dados` da planilha tem **30×93** (não C49 do prompt) — campos adicionais a investigar em B5.
4. **`COFIS`** na planilha é grafia local de **COFINS**.
5. Mapeamento Cliente/serviço/contrato/cidade é **um campo concatenado na planilha** — exigirá split/parsing na importação.
6. 61 tabelas com **apenas 1 policy** — concentradas em famílias `mz_*` (migração), `cotacao_*` (5), `cobranca_*` (3), `regua_cobranca*` (3), `sup_aprov_*` (3), `audit_log_*` (partições), `folha_*` (2), `remessa_cnab_titulo`.

---

## 10. Riscos críticos antecipados (sem ação)

| # | Risco | Impacto | Onde tratar |
|---|---|---|---|
| R1 | Pedido de Faturamento inexistente | Bloqueia §6–§10 | B5 |
| R2 | Anexos no aprovador financeiro não implementados | Bloqueia aprovação financeira | B8/B20 |
| R3 | Famílias `cobranca_*`/`regua_cobranca*` com 1 policy | Vazamento entre empresas em CR | B2 (subir prioridade?) |
| R4 | 4 views `SECURITY DEFINER` (ERROR linter) | Bypass de RLS em consulta | B2 |
| R5 | DRE projetada zerada | Decisão estratégica não suportada | B3 |
| R6 | ~13 campos da planilha sem destino no ERP | Faturamento não fecha com a controladoria | B4 |
| R7 | Funções com `search_path` mutável (WARNs) | CVE-style hijack | B2 |

---

## 11. Perguntas humanas para destravar B3

1. **DRE projetada zerada (B3):** confirmamos que "zerada" significa **`mz_41_fato_fluxo_caixa_projetado` + `mz_50_fato_orcamento_contratos_competencia` + `mz_60_view_dre_gerencial_competencia` retornarem todos `0` (ou serem desativadas) até existir orçamento aprovado**, ou há outra definição (ex.: zerar apenas a linha "Projetado" da DRE comparativa)?
2. **Compliance prioritário:** os riscos **R3** (cobrança com 1 policy) e **R4** (4 views SECURITY DEFINER) deveriam **subir** de B2 para imediatamente após B1, ou seguimos o plano de deixar B2 por último?
3. **Reanexar `VERANÓPOLIS 01.2021.xlsm`** para parse equivalente em B5, ou Bento basta como template canônico?
4. **Tabela `pedido_faturamento` (B5):** modelo proposto deve já contemplar (a) cabeçalho + itens + (b) checklist documental embutido + (c) workflow de aprovação acoplado, ou separar em entidades?

---

**Bloco 1 concluído (read-only). Aguardando suas respostas para iniciar B3 (DRE projetada zerada) — ou repriorizar conforme R3/R4.**
