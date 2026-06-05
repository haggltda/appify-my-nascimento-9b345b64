# P3.F v4.2 — Caixa Primeiro: Entradas e Saídas por Empresa (read-only)

## 0. Modo e proibições

- **100% READ-ONLY / EXPORTAÇÃO.** Nenhuma alteração operacional.
- **Proibido:** P3.E, migration, CREATE/ALTER, INSERT/UPDATE/DELETE em qualquer tabela operacional ou de diagnóstico, mexer em `conta_contabil`, `saldo_inicial`, `ativo`, lançamentos, títulos, pré-títulos, `conta_bancaria`, aliases, `public.empresas`, frontend, HERO, DRE, BI, RLS, policies, RPCs, triggers.
- **Sem Razão, sem conciliação contábil, sem blocos contábeis nesta fase.** Apenas caixa em regime de caixa.
- Permitido apenas: ler a planilha, `SELECT` no Postgres, gerar arquivos `.xlsx`/`.csv`/`.md`/`.json`/`.zip` em `/mnt/documents/p3f_v42/`.

## 1. Fonte principal

Planilha já anexada: `BD Fluxo de caixa - 2026 - VIGENTE - Oficial Grupo Nascimento.xlsx`.

- **Abas principais (obrigatórias):** `Entradas`, `Saídas`.
- **Abas auxiliares (apoio apenas):** `Empresas`, `Conciliação`, `Ajustes`, `BD Conciliação`, `Base de dados`, `Base de dados.`, `Base de dados...`.
- **Regra:** não substituir `Entradas`/`Saídas` por `BD Conciliação`. Divergências entre abas saem em `divergencia_entre_abas_planilha.csv`.

## 2. Entregáveis

### 2.1 Excel principais (obrigatórios)

`entradas_por_empresa.xlsx` e `saidas_por_empresa.xlsx`, cada um com as abas:

```text
GERAL | AGPS | CANAA | HAGG | LF | NH | SN | SEM_EMPRESA | RESUMO
```

Regras de cada aba:
- **Todas** as linhas daquela empresa, **todas** as colunas originais da planilha, **mais** as colunas de diagnóstico (seção 4).
- Nenhuma coluna original renomeada, removida, resumida ou reordenada. Colunas novas vão **depois** das originais.
- `GERAL` = todas as linhas da aba origem.
- `RESUMO` = totais por empresa, por banco, malformados, sem empresa, sem banco, sem classificação, saldos iniciais, transferências.

### 2.2 CSVs/MDs auxiliares

```text
p3f_saldos_iniciais_por_empresa_banco.csv
p3f_transferencias_bancarias.csv
divergencias_caixa_p3d.csv
banco_empresa_validacao.csv
classificacao_planilha_para_conta_contabil.csv
divergencia_entre_abas_planilha.csv
RESUMO_P3F_CAIXA.md
manifest.json
README_IMPORTAR_EXCEL.md
```

### 2.3 Pacote final

`p3f_caixa_entradas_saidas_por_empresa.zip` em `/mnt/documents/`.

## 3. Fallback obrigatório

Se algum `.xlsx` ficar pesado/travar ou estourar limite técnico, gerar **fallback CSV por empresa** em `01_entradas/por_empresa/` e `02_saidas/por_empresa/`, atualizar `README_IMPORTAR_EXCEL.md` explicando o motivo. Cada aba respeita o limite do Excel (1.048.576 linhas).

## 4. Colunas adicionais (após originais)

### 4.1 Origem/parser
`origem_aba`, `linha_excel`, `regime` (=`CAIXA`), `direcao` (`ENTRADA`/`SAIDA`), `valor_original`, `valor_normalizado`, `erro_valor`, `observacao_parser`.

### 4.2 Empresa
`empresa_planilha`, `empresa_normalizada`, `empresa_inferida_por_banco`, `empresa_inferida_por_historico`, `empresa_inferida_por_centro_custo`, `empresa_final_sugerida`, `empresa_status_confianca`.

### 4.3 Banco
`banco_planilha`, `banco_normalizado`, `banco_empresa_provavel`, `banco_candidato_erp_id`, `banco_candidato_erp_nome`, `conta_bancaria_candidata_id`, `conta_bancaria_empresa`, `banco_divergencia`.

### 4.4 Conta contábil + P3.D (batch `p3d-v33-lf-documentada`, somente diagnóstico)
`conta_contabil_candidata_id`, `conta_contabil_classificacao`, `conta_contabil_descricao`, `empresa_conta_contabil`, `categoria_p3d`, `acao_p3d`, `tem_vinculo_real_p3d`, `pode_inativar_futuro_p3d`, `pode_zerar_saldo_futuro_p3d`, `trava_motivo_p3d`, `saldo_replicado_suspeito_p3d`.

### 4.5 Diagnóstico
`tipo_match`, `score_match`, `evidencias_usadas`, `divergencia_detectada`, `tipo_divergencia`, `o_que_precisa_corrigir`, `por_que_precisa_corrigir`, `impacto_se_corrigir`, `impacto_se_nao_corrigir`, `risco_de_corrigir`, `risco_de_nao_corrigir`, `areas_impactadas`.

### 4.6 Decisão humana (vazias)
`decisao_controladoria`, `acao_aprovada`, `aprovado_por`, `data_aprovacao`, `observacao_controladoria`, `status_p3e`.

## 5. Saldos iniciais

Detector:
- `Classificação` = `SALDO ANTERIOR`;
- histórico contendo `saldo anterior|abertura|saldo inicial|ajuste de abertura`;
- confirmação cruzada com aba `Ajustes`.

Saída: `p3f_saldos_iniciais_por_empresa_banco.csv` (único por empresa + banco + conta bancária + data).

Categorias: `SALDO_INICIAL_VALIDADO`, `SALDO_INICIAL_DUPLICADO_EM_OUTRA_EMPRESA`, `SALDO_INICIAL_SEM_BANCO_CORRESPONDENTE`, `SALDO_INICIAL_COM_CONTA_CONTABIL_ERRADA`, `SALDO_INICIAL_DIVERGENTE_VALOR`, `SALDO_INICIAL_REVISAR_HUMANO`.

## 6. Transferências

Detector:
- `Classificação` = `TRANSF. ENTRE CONTAS`;
- histórico contendo `TRANSF|TRANSFERENCIA|PARA|DE/PARA`;
- pareamento saída↔entrada: `|valor| igual` + `|Δdata| ≤ 3 dias` + bancos distintos (passo 2: tolerância ±0,01).

Saída: `p3f_transferencias_bancarias.csv`. Transferência **não é receita nem despesa**.

Categorias: `TRANSFERENCIA_MESMA_EMPRESA_PAREADA`, `TRANSFERENCIA_INTERCOMPANY_PAREADA`, `TRANSFERENCIA_NAO_PAREADA`, `TRANSFERENCIA_COM_EMPRESA_DIVERGENTE`, `TRANSFERENCIA_COM_BANCO_NAO_IDENTIFICADO`, `TRANSFERENCIA_REVISAR_HUMANO`.

## 7. Score de match (0–100)

`+30` empresa bate · `+30` banco bate · `+20` conta/classificação bate · `+10` CC/contrato/histórico · `+10` transferência pareada · `−30` banco de outra empresa · `−30` conta de outra empresa · `−30` transferência não pareada · `−20` valor divergente.
Faixas: `MATCH_FORTE` 90–100, `MATCH_PROVAVEL` 70–89, `MATCH_FRACO` 40–69, `REVISAO_HUMANA` 0–39.

## 8. Validações reportadas

Totais devolvidos no `RESUMO_P3F_CAIXA.md` e no `manifest.json`:
- linhas de `Entradas` e `Saídas` na planilha;
- linhas exportadas em cada Excel (deve bater 1:1 — senão `TRAVADO_POR_DIVERGENCIA_EXPORTACAO_CAIXA`);
- totais por empresa e por banco (entradas e saídas);
- malformados, sem empresa, sem banco, sem classificação;
- saldos iniciais detectados;
- transferências detectadas, pareadas e não pareadas.

## 9. Autocheck

- [ ] `Entradas`/`Saídas` foram fonte principal.
- [ ] Todas as colunas originais preservadas (ordem e nome).
- [ ] Todas as linhas exportadas (contagens batem).
- [ ] Arquivos separados por empresa nas abas exigidas.
- [ ] Saldos iniciais analisados por empresa+banco.
- [ ] Transferências não tratadas como receita/despesa.
- [ ] P3.D usado apenas como diagnóstico (sem escrita).
- [ ] Nenhuma alteração operacional; P3.E bloqueado.

## 10. Detalhes técnicos

- Parser em `/tmp/p3f_v42_build.py` usando `python3` + `openpyxl` + `pandas`.
- Escrita XLSX com `openpyxl` (write-only se aba > 50k linhas) + freeze pane na linha 1.
- Tokens empresa (regex case-insensitive): `AGPS`, `CANAA|CANAÃ`, `HAGG`, `\bLF\b`, `\bNH\b`, `\bSN\b`.
- SELECTs via `psql`: `conta_bancaria`, `empresas`, `conta_contabil`, `integration_alias_contas_contabeis`, `integration_map_classificacao_contabil`, snapshot de `aud_plano_contas_origem_diagnostico` (batch `p3d-v33-lf-documentada`).
- CSV: UTF-8 com BOM, separador `;`, cabeçalho linha 1, nomes sem acento, compatível com Excel pt-BR.
- `manifest.json`: batch_id `p3f-v42-caixa-entradas-saidas`, timestamp UTC, contagens, SHA-256 por arquivo.
- Saída final: `/mnt/documents/p3f_caixa_entradas_saidas_por_empresa.zip` + artifact tag.

## 11. Próximos passos (após aprovação humana)

1. Controladoria revisa os dois Excel por empresa.
2. Confirma saldos iniciais reais por empresa+banco.
3. Confirma transferências legítimas (mesma empresa / intercompany).
4. Só então avaliamos Razão/contábil em uma fase P3.G separada.
5. P3.E permanece bloqueado até decisão humana formal.
