## PR-2.2 — Parse em chunks com background + retry

### Causa raiz
`fcr-load/parse` carrega o `.xlsx` inteiro + 60k objetos JS + insert único → estoura o limite de ~150 MB da edge function (confirmado: `Memory limit exceeded`). O lote ficou em `criado`, nada foi gravado em `fcr_raw_excel`.

### Decisões aprovadas
- Chunk size: **5.000 linhas** por insert
- Execução: **background** com `EdgeRuntime.waitUntil` + UI faz polling
- Retry: **3 tentativas com backoff** (1s, 3s, 9s); falha final marca range como `erro_parse`

---

### Fase A — Migration aditiva (DDL only, sem DML)

Adicionar a `fcr_batch`:
- `linhas_lidas int default 0`
- `linhas_inseridas int default 0`
- `chunks_total int`
- `chunk_atual int default 0`
- `parse_iniciado_em timestamptz`
- `parse_finalizado_em timestamptz`
- `ultimo_erro text`

Nova tabela `fcr_parse_chunk_erro` (auditoria de retries):
- `batch_id`, `chunk_idx`, `linha_inicio`, `linha_fim`, `tentativa`, `erro_msg`, `criado_em`

Rollback: `ALTER TABLE ... DROP COLUMN` + `DROP TABLE fcr_parse_chunk_erro`. Zero impacto em `mz_40` / `realizado_lancamentos` / RPCs.

---

### Fase B — Refactor `fcr-load/parse`

**Fluxo novo (200 OK em <2s, parse em background):**

1. Validar batch existe + status ∈ {`criado`, `parseando`, `erro_parse`}.
2. UPDATE status → `parseando`, set `parse_iniciado_em = now()`.
3. **Responder 202** `{ status: "parseando", batch_id }` imediatamente.
4. `EdgeRuntime.waitUntil(runParse(batch_id))`:
   - Stream do bucket → `Uint8Array` (sem duplo buffer).
   - SheetJS `read(buf, { type: "array", dense: true, cellFormula: false, cellHTML: false })`.
   - `sheet_to_json` por sheet, **iterar via generator** em fatias de 5.000 sem materializar array completo.
   - Para cada chunk:
     a. Mapear linhas → `fcr_raw_excel` rows (com `valor_assinado_caixa`, `fora_do_periodo`, `id_origem_texto`, `hash_idempotencia`).
     b. `insert` com `onConflict: "hash_idempotencia", ignoreDuplicates: true` → idempotente.
     c. Em erro: retry com backoff exponencial (3×). Falha final → log em `fcr_parse_chunk_erro`, segue próximo chunk.
     d. UPDATE `chunk_atual`, `linhas_inseridas` em `fcr_batch`.
   - Ao terminar: status → `dry_run_ok` (se 0 erros) ou `erro_parse` (se houve falhas), set `parse_finalizado_em`.

**Guarda de timeout (50s wall-clock):** se ultrapassar, salva checkpoint e devolve controle; próxima chamada de `/parse` retoma a partir de `chunk_atual + 1` (mesmo arquivo, mesmo hash idempotente).

---

### Fase C — UI (`MigracaoFcr.tsx`)

- Após clicar **Parse**: aceita 202, inicia polling em `fcr_batch` a cada 2s via realtime subscription ou `setInterval`.
- Mostrar barra de progresso: `chunk_atual / chunks_total` + `linhas_inseridas`.
- Botão **Parse** vira **Continuar** quando status = `erro_parse` (retoma do último chunk).
- Card de erros: lista `fcr_parse_chunk_erro` (range, tentativa, mensagem).
- Reconcile fica desabilitado até `status = dry_run_ok`.

---

### Garantias mantidas
| Item | Estado |
|---|---|
| `mz_40_fato_fluxo_caixa_realizado` | intacto |
| `realizado_lancamentos`, RPCs, Fluxo de Caixa Diário | intactos |
| `fcr_raw_excel` | inserts idempotentes (re-run não duplica) |
| Rollback | apagar `fcr_batch` cascateia tudo |

### Auditabilidade
- `fcr_batch` mostra progresso em tempo real.
- `fcr_parse_chunk_erro` guarda todo retry/falha com timestamp.
- Idempotência por hash garante reentrância segura.

### Ordem de execução
1. Migration Fase A → aprovar.
2. Patch edge function `fcr-load` (Fase B) + UI `MigracaoFcr.tsx` (Fase C) na mesma PR.
3. Clicar Parse no lote existente (criado) — ele retoma do zero, mesmo arquivo, sem duplicar.
4. Reconcile só após `dry_run_ok`.

Aguardando aprovação para aplicar a migration Fase A.