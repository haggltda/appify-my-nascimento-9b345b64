## Estado atual

- Lote **"criado"** aparece em `fcr_batch` (arquivo já no bucket `fcr-uploads`, sem parse ainda).
- `fcr_raw_excel` = 0 linhas. `mz_40_fato_fluxo_caixa_realizado` intacto. Fluxo de Caixa Diário em produção continua lendo a fonte antiga.
- Período do Excel: 01/01/2026 → 18/05/2026. Empresa: Consolidado.

## Próximo passo seguro: clicar **Parse** (dry-run, somente leitura)

O botão Parse chama `fcr-load/parse`, que:

1. Baixa o `.xlsx` do bucket privado.
2. Detecta layout `long_table` (18 colunas: ID, Data, Tipo, Classificação, Empresas, Banco, Valor, …).
3. Insere linha-a-linha em **`fcr_raw_excel`** (tabela de staging nova, isolada).
4. Calcula `valor_assinado_caixa` (+ENTRADA / −SAÍDA), marca `fora_do_periodo` para 2024/2025, registra `id_origem_texto`.
5. Atualiza `fcr_batch.status` → `parseando` → `dry_run_ok` (ou `erro_parse`).

### Garantias do Parse (não muda nada em produção)

| Tabela | Efeito do Parse |
|---|---|
| `mz_40_fato_fluxo_caixa_realizado` | **Nenhum** (0 writes) |
| `realizado_lancamentos` | **Nenhum** |
| `saldos_iniciais_caixa` (30 linhas) | **Nenhum** |
| RPCs `fluxo_caixa_diario*` | **Nenhum** (continuam lendo mz_40) |
| `fcr_raw_excel` | INSERT ~60k linhas (staging isolada, com RLS) |
| `fcr_batch` | UPDATE de status do próprio lote |

## O que validar logo após o Parse

Antes de clicar **Reconcile**, conferir em `fcr_batch` / `fcr_raw_excel`:

1. `linhas_lidas` ≈ 59.957 (tamanho do arquivo enviado).
2. `linhas_fora_do_periodo` > 0 (linhas 2024/2025 isoladas, não somam).
3. Nenhuma linha com `valor_assinado_caixa` nulo onde `tipo` ∈ {ENTRADA, SAÍDA}.
4. `pendencias` zeradas ou listadas em `fcr_sugestoes_pendencias` (empresa/banco não resolvidos, transferência sem par, id duplicado).
5. Status final = `dry_run_ok`. Se vier `erro_parse`, **não** seguir para Reconcile.

## Depois do Parse: Reconcile (ainda dry-run)

Só clicar **Reconcile** se Parse fechar limpo. O Reconcile:

- Agrega por dia/banco/empresa/bloco usando `valor_assinado_caixa`.
- Compara saldo inicial calculado vs. `saldos_iniciais_caixa` (esperado R$ 4.307.442,06 em 01/01/2026).
- Grava resultados em `fcr_reconciliacao_lote`.
- **Bloqueia** virada se diferença > R$ 0,01, transferência sem par, ou empresa/banco não resolvido.
- **Não escreve em `realizado_lancamentos` nem em `mz_40`.**

## O que **não** fazer agora

- Não aprovar PR-4 (cutover) antes de ler o relatório de reconciliação.
- Não apagar o lote atual: ele é a evidência auditável do dry-run.
- Não trocar o período nem reenviar o arquivo: o `file_sha256` daria 409 e atrapalha o rastro.

## Sequência recomendada

```
[agora] Parse  →  ver fcr_batch + fcr_sugestoes_pendencias
       ↓ (se dry_run_ok)
       Reconcile  →  ler fcr_reconciliacao_lote
       ↓ (se diffs ≤ R$ 0,01)
       Abrir PR-4 (cutover) para sua aprovação explícita
```

Nada além de **Parse** é necessário neste momento. Tudo continua reversível: basta apagar o lote (`fcr_batch` em cascata) que `fcr_raw_excel` zera junto, sem tocar em produção.