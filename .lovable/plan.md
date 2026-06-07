# P3.H0-D1B v2 — Normalização, consolidação e matriz final dos aliases SEM_MATCH (READ-ONLY)

## 0. Modo e proibições

100% READ-ONLY / DIAGNÓSTICO / REFINAMENTO.

Proibido: UPDATE, INSERT, DELETE, ALTER, CREATE, DROP, GRANT, REVOKE, migration, Edge Function, service_role, alteração em `conta_bancaria`, `conta_contabil`, `saldo_inicial`, `saldos_iniciais_caixa`, lançamentos, títulos, pré-títulos, frontend, HERO, BI, DRE.

P3.E, P3.H, P3.H0-D1C e P3.H0-D2 continuam bloqueados. Nada de criação de conta, alias persistido ou SQL executável.

## 1. Fontes

- `/mnt/documents/p3h0_d1b/p3h0_d1b_matriz_aliases_hagg_sem_match.csv`
- `/mnt/documents/p3h0_d1b/p3h0_d1b_contas_a_criar_preview.csv`
- `/mnt/documents/p3h0_d1b/p3h0_d1b_queries.sql`
- `/mnt/documents/p3g_pos_h0d1/` (em especial `p3g_pos_h0d1_movimentos_sem_conta_contabil.csv`)
- SELECTs read-only em `public.conta_bancaria`, `public.conta_contabil`, `public.mz_40_fato_fluxo_caixa_realizado`, `public.aud_p3h0_conta_bancaria_snapshot` para descobrir os nomes reais de colunas e validar canônicas HAGG.

Travas:
- Soma de `qtd_movimentos` consolidada deve ser exatamente **1.195** (±0). Senão `TRAVADO_POR_DIVERGENCIA_SEM_MATCH`.
- 7 canônicas HAGG de referência: `CAIXA HAGG`, `BANRI HAGG`, `BB HAGG`, `SICREDI HAGG 155`, `MENTORE HAGG`, `SICREDI HAGG 119`, `BRADESCO HAGG`.

## 2. Normalização e consolidação

Criar coluna `alias_normalizado`:
- `trim`, colapso de espaços, caixa alta;
- normalização de hífens (`-`, `–`, `—` → `-`) e remoção de espaços ao redor;
- remoção de acentos (NFKD);
- preservar números de contrato (UFFS 041/2021, HUSM 020/2021, EMBRAPA 2021/93, FURG-HU 006/2023, FURG JARDINAGEM 049/2022, BENTO GONÇALVES ADM 002/2021, etc.) — **não** consolidar convênios diferentes.

Consolidar uma linha por `alias_normalizado` com agregações (qtd, entradas, saídas, saldo líquido, primeira/última data) a partir dos movimentos `SEM_MATCH` em `p3g_pos_h0d1`.

## 3. Reclassificação contra canônicas

Para cada `alias_normalizado`, testar contra as 7 canônicas HAGG. Match exato pós-normalização (ex.: `BANRI HAGG`, `BB HAGG`, `MENTORE HAGG`, `SICREDI HAGG 119`, `BRADESCO HAGG`) → `ALIAS_DE_CONTA_CANONICA_EXISTENTE`, preencher `conta_bancaria_canonica_candidata` + `conta_contabil_canonica_candidata` a partir do snapshot P3.H0-D1.

Nunca consolidar convênios (`UFFS`, `HUSM`, `EMBRAPA`, `FURG`, `HCPA`, `BENTO GONÇALVES`) nem aplicações (`APLICAÇÃO`, `CDB`, `POUPANÇA`) em `BB HAGG` / `CAIXA HAGG`.

## 4. Categorias finais

- `ALIAS_DE_CONTA_CANONICA_EXISTENTE`
- `BANCO_DE_OUTRA_EMPRESA_EM_HAGG` — qualquer alias contendo token de outra empresa (`SN`, `NH`, `CANAA`, `AGPS`, `LF`) dentro do escopo HAGG. Recomendação: investigar intercompany / empresa errada / replicação.
- `CRIAR_CONTA_CONTABIL_APLICACAO_FINANCEIRA` — `APLICAÇÃO`, `CDB`, `POUPANÇA`. Nunca `BANCOS CONTA MOVIMENTO`. Grupo contábil = `REGRA_DE_NEGOCIO_NAO_CONFIRMADA` se não confirmado.
- `CONTA_VINCULADA_CONTRATO_CONVENIO` — contratos/convênios. Decisão humana obrigatória.
- `MEIO_PAGAMENTO_NAO_BANCO` — `TICKET` e similares. Não criar conta bancária.
- `REVISAR_HUMANO` — somente quando não couber em nenhuma categoria acima, com motivo explícito.
- `BLOQUEAR` — quando há contradição estrutural.

## 5. Valores e datas

Por `alias_normalizado` preencher obrigatoriamente: `qtd_movimentos`, `total_entradas`, `total_saidas`, `saldo_liquido`, `primeira_data`, `ultima_data`. Se a fonte não permitir cálculo: `NAO_LOCALIZADO_NA_BASE_ATUAL` + explicação da fonte ausente no resumo.

## 6. Queries SQL corrigidas

Reescrever `p3h0_d1b_v2_queries.sql` usando apenas `SELECT` e nomes reais de colunas. Validar previamente via `information_schema.columns` para `conta_bancaria`, `conta_contabil`, `mz_40_fato_fluxo_caixa_realizado` (esperado: `banco_nome`, `banco_codigo`, `ativa`, `classificacao`, `descricao`, `data_caixa` — confirmar antes de escrever).

## 7. Entregáveis em `/mnt/documents/p3h0_d1b_v2/`

```text
p3h0_d1b_v2_matriz_aliases_consolidados.csv
p3h0_d1b_v2_aliases_canonicos_reclassificados.csv
p3h0_d1b_v2_bancos_outras_empresas_em_hagg.csv
p3h0_d1b_v2_contas_a_criar_preview_deduplicado.csv
p3h0_d1b_v2_queries.sql
RESUMO_P3H0_D1B_V2.md
autocheck_p3h0_d1b_v2.json
manifest.json
p3h0_d1b_v2.zip   (em /mnt/documents/)
```

Colunas da matriz consolidada (na ordem):
`alias_normalizado`, `aliases_originais`, `empresa`, `qtd_movimentos`, `total_entradas`, `total_saidas`, `saldo_liquido`, `primeira_data`, `ultima_data`, `classificacao_final`, `conta_bancaria_canonica_candidata`, `conta_contabil_canonica_candidata`, `precisa_criar_alias`, `precisa_criar_conta_bancaria`, `precisa_criar_conta_contabil`, `tipo_conta_a_criar`, `grupo_contabil_sugerido`, `risco`, `impacto_se_nao_resolver`, `recomendacao_lovable`, `decisao_controladoria`, `observacao_controladoria`.

CSVs: UTF-8 com BOM, separador `;`.

## 8. Autocheck (`autocheck_p3h0_d1b_v2.json`)

```json
{
  "executou_update": false,
  "executou_insert": false,
  "executou_delete": false,
  "executou_alter": false,
  "criou_conta_bancaria": false,
  "criou_conta_contabil": false,
  "alterou_saldo": false,
  "soma_movimentos_sem_match": 1195,
  "p3h0_d2_bloqueado": true,
  "p3h0_d1c_bloqueado": true
}
```

## 9. Resumo (`RESUMO_P3H0_D1B_V2.md`)

Responder: (1) aliases originais, (2) aliases consolidados, (3) movimentos = 1.195, (4) mapeáveis a canônicas, (5) bancos de outras empresas em HAGG, (6) aplicações, (7) convênios, (8) Ticket/meio de pagamento, (9) revisão humana real, (10) P3.H0-D2 bloqueado.

## 10. Detalhes técnicos

- Script `/tmp/p3h0_d1b_v2_build.py` (`python` + `pandas` + `openpyxl`).
- DB via `psql` somente `SELECT` (confirmar `test -n "$PGHOST"`); se indisponível, usar `supabase--read_query`.
- `manifest.json` com `batch_id=p3h0-d1b-v2-normaliza-consolida`, timestamp UTC, contagens, SHA-256 por arquivo.
- ZIP final + `<presentation-artifact>` para o usuário.

## 11. Próximo passo (não executar agora)

Após aprovação humana da matriz consolidada → preparar P3.H0-D1C (SQL controlado de criação/vínculo dos aliases aprovados). Só depois P3.H0-D2 (saldos iniciais HAGG).
