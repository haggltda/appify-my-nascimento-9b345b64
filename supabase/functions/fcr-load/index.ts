// PR-2 REV 3 — fcr-load Edge Function (schema-of-storage + parse/reconcile dry-run)
// Routes (POST unless noted):
//   /fcr-load/upload     — multipart upload, idempotência por file_sha256
//   /fcr-load/parse      — lê XLSX do storage e popula fcr_raw_excel
//   /fcr-load/reconcile  — popula fcr_reconciliacao_lote e decide dry_run_ok/dry_run_erro
//   /fcr-load/rollback   — apaga raws/pendências/reconciliação e marca batch revertido
//   /fcr-load/status     — GET, retorna batch + contagens
//
// Nunca escreve em: realizado_lancamentos, saldos_iniciais_caixa,
// stg_fluxo_caixa_realizado, mz_40. Nunca toca RPCs/views/frontend/CSV/PDF.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Role =
  | "admin"
  | "presidencia"
  | "diretor_adm"
  | "controladoria"
  | "financeiro";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_BLOCOS = new Set([
  "operacional",
  "nao_operacional",
  "resultado_financeiro",
  "socios",
  "intercompany_mutuo",
  "transferencia_interna",
  "aplicacao_resgate",
  "credito_cheque_especial",
  "a_conciliar",
  "saldo",
  "subtotal",
]);

// ----------------------------- helpers -----------------------------

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

function isXlsxMagic(buf: Uint8Array): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b &&
    buf[2] === 0x03 && buf[3] === 0x04;
}

function parseBR(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function clientWithAuth(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function getUserAndRoles(authHeader: string): Promise<
  { userId: string; roles: Set<Role>; empresaId: string | null } | null
> {
  const user = clientWithAuth(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await user.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub as string;
  const admin = adminClient();
  const [{ data: rolesRows }, { data: emp }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin.rpc("get_user_empresa", { _user_id: userId }),
  ]);
  const roles = new Set<Role>(
    (rolesRows ?? []).map((r: any) => r.role as Role),
  );
  return { userId, roles, empresaId: (emp as string | null) ?? null };
}

function canUpload(roles: Set<Role>, escopo: string): boolean {
  if (escopo === "consolidado") return roles.has("admin");
  return roles.has("admin") || roles.has("controladoria") ||
    roles.has("financeiro");
}
function canMutateBatch(
  roles: Set<Role>,
  escopo: string,
  batchEmpresa: string | null,
  userEmpresa: string | null,
): boolean {
  if (escopo === "consolidado") return roles.has("admin");
  if (roles.has("admin")) return true;
  if (!batchEmpresa || !userEmpresa) return false;
  return batchEmpresa === userEmpresa &&
    (roles.has("controladoria") || roles.has("financeiro"));
}
function canReadBatch(
  roles: Set<Role>,
  escopo: string,
  batchEmpresa: string | null,
  userEmpresa: string | null,
): boolean {
  if (escopo === "consolidado") {
    return roles.has("admin") || roles.has("presidencia") ||
      roles.has("diretor_adm");
  }
  if (
    roles.has("admin") || roles.has("presidencia") || roles.has("diretor_adm")
  ) return true;
  if (!batchEmpresa || !userEmpresa) return false;
  return batchEmpresa === userEmpresa &&
    (roles.has("controladoria") || roles.has("financeiro"));
}

// ----------------------------- handlers -----------------------------

async function handleUpload(req: Request, ctx: AuthCtx): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return json(400, { error: "multipart/form-data esperado" });
  const file = form.get("file");
  const escopo = String(form.get("escopo") ?? "");
  const empresaRaw = form.get("empresa_id");
  const empresa_id = empresaRaw ? String(empresaRaw) : null;

  if (!(file instanceof File)) return json(400, { error: "file faltando" });
  if (escopo !== "empresa" && escopo !== "consolidado") {
    return json(400, { error: "escopo deve ser empresa|consolidado" });
  }
  if (escopo === "empresa" && !empresa_id) {
    return json(400, { error: "empresa_id obrigatório para escopo=empresa" });
  }

  if (!canUpload(ctx.roles, escopo)) {
    return json(403, { error: "role sem permissão para upload neste escopo" });
  }
  if (escopo === "empresa" && !ctx.roles.has("admin")) {
    if (ctx.empresaId !== empresa_id) {
      return json(403, { error: "empresa fora do escopo do usuário" });
    }
  }
  if (file.size > MAX_BYTES) return json(413, { error: "arquivo > 25MB" });
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return json(400, { error: "apenas .xlsx" });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  if (!isXlsxMagic(buf)) return json(400, { error: "não é xlsx válido" });

  const file_sha256 = await sha256(buf);
  const admin = adminClient();

  // duplicidade antes do upload
  const { data: dup } = await admin
    .from("fcr_batch")
    .select("id, status, escopo_carga, empresa_id")
    .eq("totais_excel->>file_sha256", file_sha256)
    .not("status", "in", "(revertido,erro)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    dup && dup.escopo_carga === escopo &&
    (dup.empresa_id ?? null) === empresa_id
  ) {
    return json(409, {
      error: "arquivo_identico_ja_carregado",
      existing_batch_id: dup.id,
      existing_status: dup.status,
      hint: "Faça rollback do batch existente para recarregar.",
    });
  }

  const batch_id = crypto.randomUUID();
  const folder = escopo === "empresa" ? empresa_id! : "consolidado";
  const storage_path = `${folder}/${batch_id}/${file.name}`;

  const up = await admin.storage.from("fcr-uploads").upload(storage_path, buf, {
    upsert: false,
    contentType:
      file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (up.error) {
    return json(500, { error: "storage_upload_falhou", detail: up.error.message });
  }

  const { error: insErr } = await admin.from("fcr_batch").insert({
    id: batch_id,
    empresa_id,
    escopo_carga: escopo,
    arquivo_origem: file.name,
    storage_path,
    modo: "dry_run",
    status: "criado",
    criado_por: ctx.userId,
    totais_excel: {
      file_sha256,
      size: file.size,
      mime: file.type || null,
    },
  });
  if (insErr) {
    await admin.storage.from("fcr-uploads").remove([storage_path]);
    return json(500, { error: "fcr_batch_insert_falhou", detail: insErr.message });
  }

  return json(200, { batch_id, status: "criado", file_sha256 });
}

interface RawRow {
  batch_id: string;
  empresa_id_origem_celula: string | null;
  empresa_id_resolvida: string | null;
  status_resolucao_empresa: string;
  banco_origem_texto: string | null;
  conta_origem_texto: string | null;
  arquivo_origem: string;
  aba_origem: string;
  linha_origem: number;
  coluna_origem: number;
  endereco_celula: string;
  cabecalho_coluna: string | null;
  data_caixa_derivada: string | null;
  classificacao_excel_original: string | null;
  historico_original: string | null;
  valor_celula_texto: string | null;
  valor_numerico: number | null;
  valor_assinado_caixa: number | null;
  fora_do_periodo: boolean;
  id_origem_texto: string | null;
  tipo_linha: string;
  bloco_funcional: string;
  par_transferencia_id: string | null;
  raw_json: Record<string, unknown>;
  hash_idempotencia: string;
}

// ----- long_table helpers (PR-2.1) -----

const LT_ALIASES: Record<string, string[]> = {
  data: ["DATA", "DATA MOVIMENTO", "DATA CAIXA", "DATA OPERACAO", "DT", "DT MOVIMENTO"],
  valor: ["VALOR", "VALOR MOVIMENTO", "VL", "VLR"],
  tipo: ["TIPO", "TIPO MOVIMENTO", "TIPO LANCAMENTO", "E/S", "D/C"],
  classificacao: ["CLASSIFICACAO", "CLASSIFICACAO CAIXA", "CATEGORIA", "NATUREZA"],
  empresa: ["EMPRESA", "EMPRESAS", "FILIAL", "UNIDADE", "RAZAO SOCIAL"],
  banco: ["BANCO", "INSTITUICAO", "INSTITUICAO FINANCEIRA"],
  conta: ["CONTA", "CONTA CORRENTE", "CC", "NUMERO CONTA"],
  historico: ["HISTORICO", "DESCRICAO", "OBSERVACAO", "MEMO"],
  id_origem: ["ID", "ID ORIGEM", "IDORIGEM", "DOCUMENTO", "DOC", "REFERENCIA", "NUMERO DOC"],
};

// Normaliza valor da coluna Tipo do Excel para 'entrada' | 'saida' | 'desconhecido'
function normalizeTipoMovimento(raw: unknown): "entrada" | "saida" | "desconhecido" {
  if (raw == null) return "desconhecido";
  const n = normalize(String(raw));
  if (!n) return "desconhecido";
  if (/^(E|ENTRADA|ENTRADAS|CREDITO|CR|RECEBIMENTO|D)$/.test(n)) {
    // 'D' (débito bancário) representa entrada no extrato; mantemos só ENTRADA explícita
  }
  if (/^E$|ENTRADA|CREDITO|RECEBIMENTO/.test(n)) return "entrada";
  if (/^S$|SAIDA|SA[IÍ]DA|DEBITO|D[ÉE]BITO|PAGAMENTO/.test(n)) return "saida";
  return "desconhecido";
}

function mapLongTableHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let c = 0; c < headers.length; c++) {
    const n = normalize(headers[c] ?? "");
    if (!n) continue;
    for (const [key, aliases] of Object.entries(LT_ALIASES)) {
      if (map[key] !== undefined) continue;
      if (aliases.some((a) => n === a || n.startsWith(a + " ") || n.endsWith(" " + a))) {
        map[key] = c;
        break;
      }
    }
  }
  return map;
}

function isLongTable(map: Record<string, number>): boolean {
  return map.valor !== undefined &&
    map.data !== undefined &&
    map.classificacao !== undefined;
}

function parseCellDate(cell: any): string | null {
  if (!cell) return null;
  if (cell.v instanceof Date) {
    const d = cell.v as Date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const s = cell.w ?? (cell.v != null ? String(cell.v) : "");
  return tryParseDateFromHeader(String(s));
}

function periodoFromBatch(batch: any): { inicio: string; fim: string } {
  const p = batch?.totais_excel?.periodo;
  if (p?.inicio && p?.fim) return { inicio: p.inicio, fim: p.fim };
  const ano = Number(batch?.totais_excel?.ano ?? 2026);
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

function classifyBloco(label: string): string {
  const n = normalize(label);
  if (!n) return "operacional";
  if (/SALDO\s+ANTERIOR/.test(n)) return "saldo";
  if (/SALDO\s+INICIAL/.test(n)) return "saldo";
  if (/SALDO\s+FINAL/.test(n)) return "saldo";
  if (/SUBTOTAL|TOTAL/.test(n)) return "subtotal";
  if (/TRANSF/.test(n)) return "transferencia_interna";
  if (/APLIC|RESGATE|CDB|FUNDO/.test(n)) return "aplicacao_resgate";
  if (/CHEQUE\s+ESPECIAL/.test(n)) return "credito_cheque_especial";
  if (/CREDITO|EMPRESTIMO|FINANCIAMENTO/.test(n)) {
    return "credito_cheque_especial";
  }
  if (/PRO\s*LABORE|RETIRADA\s+DE\s+SOCIO|^SOCIOS?$|ACIONISTA|DIVIDENDO|JCP/.test(n)) {
    return "socios";
  }
  if (/INTERCOMP|MUTUO|MÚTUO/.test(n)) return "intercompany_mutuo";
  if (/CONTA\s+VINCULADA/.test(n)) return "a_conciliar";
  if (/CONCILIAR|A\s+CLASSIFICAR|N\s*AO\s+IDENTIFICAD/.test(n)) {
    return "a_conciliar";
  }
  if (/JURO|RENDIMENTO|TARIFA|IOF|IMPOSTO\s+FINANC/.test(n)) {
    return "resultado_financeiro";
  }
  if (/N\s*AO\s+OPERAC/.test(n)) return "nao_operacional";
  return "operacional";
}

function classifyTipoLinha(label: string): string {
  const n = normalize(label);
  if (/SALDO\s+ANTERIOR/.test(n)) return "saldo_inicial";
  if (/SALDO\s+INICIAL/.test(n)) return "saldo_inicial";
  if (/SALDO\s+FINAL/.test(n)) return "saldo_final";
  if (/SUBTOTAL|TOTAL/.test(n)) return "subtotal";
  if (!n) return "vazia";
  return "movimento";
}

function tryParseDateFromHeader(h: string): string | null {
  if (!h) return null;
  // dd/mm/yyyy
  const m = h.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // dd/mm
  const m2 = h.match(/^(\d{2})\/(\d{2})$/);
  if (m2) {
    const y = new Date().getFullYear();
    return `${y}-${m2[2]}-${m2[1]}`;
  }
  if (h instanceof Date) return (h as Date).toISOString().slice(0, 10);
  return null;
}

async function handleParse(req: Request, ctx: AuthCtx): Promise<Response> {
  const { batch_id } = await req.json().catch(() => ({}));
  if (!batch_id || typeof batch_id !== "string") {
    return json(400, { error: "batch_id obrigatório" });
  }
  const admin = adminClient();
  const { data: batch } = await admin.from("fcr_batch").select("*").eq(
    "id",
    batch_id,
  ).maybeSingle();
  if (!batch) return json(404, { error: "batch não encontrado" });
  if (
    !canMutateBatch(
      ctx.roles,
      batch.escopo_carga,
      batch.empresa_id,
      ctx.empresaId,
    )
  ) {
    return json(403, { error: "sem permissão para mutar este batch" });
  }
  if (!["criado", "parseando"].includes(batch.status)) {
    return json(409, { error: `status inválido para parse: ${batch.status}` });
  }

  await admin.from("fcr_batch").update({ status: "parseando" }).eq(
    "id",
    batch_id,
  );

  try {
    const dl = await admin.storage.from("fcr-uploads").download(
      batch.storage_path,
    );
    if (dl.error || !dl.data) {
      throw new Error("falha download storage: " + dl.error?.message);
    }
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    const wb = XLSX.read(buf, {
      type: "array",
      cellDates: true,
      cellFormula: true,
      cellNF: true,
      sheetStubs: true,
    });

    const file_sha256 = (batch.totais_excel?.file_sha256 as string) || "";
    const raws: RawRow[] = [];

    for (let si = 0; si < wb.SheetNames.length; si++) {
      const sheetName = wb.SheetNames[si];
      const ws = wb.Sheets[sheetName];
      if (!ws || !ws["!ref"]) continue;
      const sheetHidden = Boolean(
        (wb as any).Workbook?.Sheets?.[si]?.Hidden,
      );
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const rowsMeta = (ws as any)["!rows"] || [];
      const colsMeta = (ws as any)["!cols"] || [];

      // cabeçalho: primeira linha não-vazia da aba
      let headerRow = range.s.r;
      for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
        let nonEmpty = 0;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v != null && String(cell.v).trim() !== "") {
            nonEmpty++;
          }
        }
        if (nonEmpty >= 2) {
          headerRow = r;
          break;
        }
      }
      const headers: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const hc = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
        headers[c] = hc?.v != null ? String(hc.v).trim() : "";
      }

      // PR-2.1: detector long_table vs matriz
      const ltMap = mapLongTableHeaders(headers);
      const longTable = isLongTable(ltMap);
      const periodo = periodoFromBatch(batch);
      const layoutMode = longTable ? "long_table" : "matrix";

      if (longTable) {
        // 1 linha do Excel = 1 raw. Célula principal = coluna Valor.
        const cValor = ltMap.valor!;
        const cData = ltMap.data!;
        const cClass = ltMap.classificacao!;
        const cTipo = ltMap.tipo;
        const cEmpresa = ltMap.empresa;
        const cBanco = ltMap.banco;
        const cConta = ltMap.conta;
        const cHist = ltMap.historico;
        const cId = ltMap.id_origem;

        const ltPendencias: Array<{
          tipo_pendencia: string;
          motivo: string;
          destino_proposto: string;
          row_index: number;
        }> = [];

        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const rowHidden = Boolean(rowsMeta[r]?.hidden);
          const colHiddenValor = Boolean(colsMeta[cValor]?.hidden);

          const fullRow: Record<string, unknown> = {};
          let rowHasAnyValue = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            const key = headers[c] || `col_${c}`;
            if (cell && cell.v != null && String(cell.v).trim() !== "") {
              rowHasAnyValue = true;
            }
            fullRow[key] = cell?.v ?? null;
          }
          if (!rowHasAnyValue) continue;

          const valorCell = ws[XLSX.utils.encode_cell({ r, c: cValor })];
          const classCell = ws[XLSX.utils.encode_cell({ r, c: cClass })];
          const dataCell = ws[XLSX.utils.encode_cell({ r, c: cData })];
          const tipoCell = cTipo !== undefined
            ? ws[XLSX.utils.encode_cell({ r, c: cTipo })]
            : undefined;

          const classificacao = classCell?.v != null ? String(classCell.v) : "";
          const tipo = classifyTipoLinha(classificacao);
          const bloco = classifyBloco(classificacao);
          if (!ALLOWED_BLOCOS.has(bloco)) continue;

          const valor_texto = valorCell?.w ??
            (valorCell?.v != null ? String(valorCell.v) : null);
          const valor_num = parseBR(valorCell?.v);
          const data_caixa = parseCellDate(dataCell);
          const addr = XLSX.utils.encode_cell({ r, c: cValor });
          const formula = valorCell?.f ?? "";

          const cellTxt = (col: number | undefined) =>
            col !== undefined && ws[XLSX.utils.encode_cell({ r, c: col })]?.v != null
              ? String(ws[XLSX.utils.encode_cell({ r, c: col })].v)
              : null;
          const banco_txt = cellTxt(cBanco);
          const conta_txt = cellTxt(cConta);
          const empresa_txt = cellTxt(cEmpresa);
          const hist_txt = cellTxt(cHist);
          const id_origem = cId !== undefined && ws[XLSX.utils.encode_cell({ r, c: cId })]?.v != null
            ? String(ws[XLSX.utils.encode_cell({ r, c: cId })].v).trim()
            : null;
          const tipo_mov_orig = tipoCell?.v != null ? String(tipoCell.v) : null;
          const tipo_mov_norm = normalizeTipoMovimento(tipo_mov_orig);

          // REGRA OFICIAL DE SINAL (long_table)
          // valor_numerico = bruto original do Excel (preservado)
          // valor_assinado_caixa = derivado:
          //   SALDO ANTERIOR  -> valor_numerico (não entra como movimento)
          //   Tipo=ENTRADA    -> +ABS(valor_numerico)
          //   Tipo=SAÍDA      -> -ABS(valor_numerico)
          //   Tipo inválido p/ movimento -> null + pendência sinal_inconsistente
          let valor_assinado: number | null = null;
          let pend_sinal = false;
          if (tipo === "saldo_inicial") {
            valor_assinado = valor_num;
          } else if (tipo === "movimento" && valor_num !== null) {
            if (tipo_mov_norm === "entrada") {
              valor_assinado = Math.abs(valor_num);
            } else if (tipo_mov_norm === "saida") {
              valor_assinado = -Math.abs(valor_num);
            } else {
              valor_assinado = null;
              pend_sinal = true;
            }
          } else {
            valor_assinado = valor_num;
          }

          const fora = data_caixa
            ? (data_caixa < periodo.inicio || data_caixa > periodo.fim)
            : false;

          const hashInput =
            `${batch_id}|${file_sha256}|${sheetName}|${addr}|${valor_texto ?? ""}|${formula}|LT|${id_origem ?? ""}`;
          const hash = await sha256(new TextEncoder().encode(hashInput));

          const requer_revisao = /CONTA\s+VINCULADA/.test(normalize(classificacao));

          raws.push({
            batch_id,
            empresa_id_origem_celula: empresa_txt,
            empresa_id_resolvida: batch.escopo_carga === "empresa"
              ? batch.empresa_id
              : null,
            status_resolucao_empresa: batch.escopo_carga === "empresa"
              ? "resolvida"
              : "pendente",
            banco_origem_texto: banco_txt,
            conta_origem_texto: conta_txt,
            arquivo_origem: batch.arquivo_origem,
            aba_origem: sheetName,
            linha_origem: r + 1,
            coluna_origem: cValor + 1,
            endereco_celula: addr,
            cabecalho_coluna: headers[cValor] || null,
            data_caixa_derivada: data_caixa,
            classificacao_excel_original: classificacao || null,
            historico_original: hist_txt,
            valor_celula_texto: valor_texto,
            valor_numerico: valor_num,
            valor_assinado_caixa: valor_assinado,
            fora_do_periodo: fora,
            id_origem_texto: id_origem,
            tipo_linha: tipo,
            bloco_funcional: bloco,
            par_transferencia_id: null,
            raw_json: {
              layout_mode: layoutMode,
              sheet_hidden: sheetHidden,
              row_hidden: rowHidden,
              col_hidden: colHiddenValor,
              exclude_from_math: sheetHidden || rowHidden || colHiddenValor,
              formula: formula || null,
              cell_type: valorCell?.t ?? null,
              full_row: fullRow,
              header_map: ltMap,
              id_origem: id_origem,
              tipo_movimento_original: tipo_mov_orig,
              tipo_movimento_normalizado: tipo_mov_norm,
              requer_revisao,
            },
            hash_idempotencia: hash,
          });

          if (pend_sinal) {
            ltPendencias.push({
              tipo_pendencia: "sinal_inconsistente",
              motivo: `Tipo invalido/ausente p/ movimento: '${tipo_mov_orig ?? ""}'`,
              destino_proposto: "a_conciliar",
              row_index: raws.length - 1,
            });
          }
          if (fora) {
            ltPendencias.push({
              tipo_pendencia: "fora_do_periodo",
              motivo: `data ${data_caixa} fora de ${periodo.inicio}..${periodo.fim}`,
              destino_proposto: "ignorar",
              row_index: raws.length - 1,
            });
          }
          if (requer_revisao) {
            ltPendencias.push({
              tipo_pendencia: "a_conciliar",
              motivo: "CONTA VINCULADA — requer revisão",
              destino_proposto: "a_conciliar",
              row_index: raws.length - 1,
            });
          }
        }

        (batch as any).__lt_pendencias =
          ((batch as any).__lt_pendencias ?? []).concat(ltPendencias);
        continue;
      }

      // ----- layout matriz (compat) -----
      // detecta coluna provável de label/classificação (primeira coluna textual)
      let labelCol = range.s.c;

      for (let r = headerRow + 1; r <= range.e.r; r++) {
        const rowHidden = Boolean(rowsMeta[r]?.hidden);
        const labelCell =
          ws[XLSX.utils.encode_cell({ r, c: labelCol })];
        const label = labelCell?.v != null ? String(labelCell.v) : "";
        const tipo = classifyTipoLinha(label);
        const bloco = classifyBloco(label);
        if (!ALLOWED_BLOCOS.has(bloco)) continue;

        for (let c = range.s.c; c <= range.e.c; c++) {
          const colHidden = Boolean(colsMeta[c]?.hidden);
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (!cell) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          const headerVal = headers[c] ?? "";
          const valor_texto = cell.w ?? (cell.v != null ? String(cell.v) : null);
          const valor_num = c === labelCol ? null : parseBR(cell.v);
          // ignorar a célula do label
          if (c === labelCol) continue;
          if (valor_num === null && !cell.v) continue;

          const data_caixa = tryParseDateFromHeader(headerVal);
          const formula = cell.f ?? "";

          const hashInput =
            `${batch_id}|${file_sha256}|${sheetName}|${addr}|${valor_texto ?? ""}|${formula}`;
          const hash = await sha256(new TextEncoder().encode(hashInput));

          raws.push({
            batch_id,
            empresa_id_origem_celula: null,
            empresa_id_resolvida: batch.escopo_carga === "empresa"
              ? batch.empresa_id
              : null,
            status_resolucao_empresa: batch.escopo_carga === "empresa"
              ? "resolvida"
              : "pendente",
            banco_origem_texto: null,
            conta_origem_texto: null,
            arquivo_origem: batch.arquivo_origem,
            aba_origem: sheetName,
            linha_origem: r + 1,
            coluna_origem: c + 1,
            endereco_celula: addr,
            cabecalho_coluna: headerVal || null,
            data_caixa_derivada: data_caixa,
            classificacao_excel_original: label || null,
            historico_original: null,
            valor_celula_texto: valor_texto,
            valor_numerico: valor_num,
            valor_assinado_caixa: valor_num,
            fora_do_periodo: false,
            id_origem_texto: null,
            tipo_linha: tipo,
            bloco_funcional: bloco,
            par_transferencia_id: null,
            raw_json: {
              layout_mode: layoutMode,
              sheet_hidden: sheetHidden,
              row_hidden: rowHidden,
              col_hidden: colHidden,
              exclude_from_math: sheetHidden || rowHidden || colHidden,
              formula: formula || null,
              cell_type: cell.t ?? null,
            },
            hash_idempotencia: hash,
          });
        }
      }
    }

    let inserted_count = 0;
    const CHUNK = 1000;
    for (let i = 0; i < raws.length; i += CHUNK) {
      const slice = raws.slice(i, i + CHUNK);
      const { data, error } = await admin.from("fcr_raw_excel").upsert(slice, {
        onConflict: "hash_idempotencia",
        ignoreDuplicates: true,
      }).select("id");
      if (error) throw new Error("insert raw: " + error.message);
      inserted_count += data?.length ?? 0;
    }

    // pendências por linha oculta com valor numérico não-zero classificada como movimento
    const pendencias = raws
      .filter((r) =>
        r.tipo_linha === "movimento" &&
        r.raw_json.exclude_from_math &&
        r.valor_numerico !== null && Math.abs(r.valor_numerico) > 0
      )
      .map((r) => ({
        batch_id,
        raw_id: null,
        empresa_id: r.empresa_id_resolvida,
        tipo_pendencia: "linha_calculada_ambigua",
        destino_proposto: "a_conciliar",
        status: "pendente",
        motivo: "cell_hidden_has_numeric_value",
      }));
    if (pendencias.length) {
      // raw_id ficaria null — só registramos no fluxo de bloqueio via raw_json
    }

    // estatísticas long_table
    const ltCount = raws.filter((r) => (r.raw_json as any).layout_mode === "long_table").length;
    const foraPeriodo = raws.filter((r) => r.fora_do_periodo).length;
    const idCounts = new Map<string, number>();
    for (const r of raws) {
      if (!r.id_origem_texto) continue;
      idCounts.set(r.id_origem_texto, (idCounts.get(r.id_origem_texto) ?? 0) + 1);
    }
    const idDup = Array.from(idCounts.entries()).filter(([, n]) => n > 1).length;

    await admin.from("fcr_batch").update({
      totais_promovidos: {
        parse: {
          total: raws.length,
          inserted_count,
          skipped_count: raws.length - inserted_count,
          long_table_rows: ltCount,
          fora_do_periodo: foraPeriodo,
          id_origem_duplicados: idDup,
        },
      },
    }).eq("id", batch_id);

    return json(200, {
      batch_id,
      total: raws.length,
      inserted_count,
      skipped_count: raws.length - inserted_count,
      long_table_rows: ltCount,
      fora_do_periodo: foraPeriodo,
      id_origem_duplicados: idDup,
    });
  } catch (e) {
    await admin.from("fcr_batch").update({
      status: "erro",
      totais_promovidos: { error: String(e), step: "parse" },
    }).eq("id", batch_id);
    return json(500, { error: "parse_falhou", detail: String(e) });
  }
}

async function handleReconcile(
  req: Request,
  ctx: AuthCtx,
): Promise<Response> {
  const { batch_id } = await req.json().catch(() => ({}));
  if (!batch_id) return json(400, { error: "batch_id obrigatório" });
  const admin = adminClient();
  const { data: batch } = await admin.from("fcr_batch").select("*").eq(
    "id",
    batch_id,
  ).maybeSingle();
  if (!batch) return json(404, { error: "batch não encontrado" });
  if (
    !canMutateBatch(
      ctx.roles,
      batch.escopo_carga,
      batch.empresa_id,
      ctx.empresaId,
    )
  ) {
    return json(403, { error: "sem permissão" });
  }
  if (batch.status !== "parseando") {
    return json(409, { error: `status inválido para reconcile: ${batch.status}` });
  }

  // agrega por dia
  const { data: raws } = await admin.from("fcr_raw_excel")
    .select("data_caixa_derivada, valor_numerico, tipo_linha, bloco_funcional, raw_json")
    .eq("batch_id", batch_id);

  const byDay = new Map<
    string,
    { soma: number; qtd: number }
  >();
  let saldoInicial: number | null = null;
  let saldoFinalExcel: number | null = null;

  for (const r of raws ?? []) {
    const ex = (r.raw_json as any)?.exclude_from_math;
    if (ex) continue;
    if (r.tipo_linha === "saldo_inicial" && r.valor_numerico !== null) {
      saldoInicial = (saldoInicial ?? 0) + Number(r.valor_numerico);
      continue;
    }
    if (r.tipo_linha === "saldo_final" && r.valor_numerico !== null) {
      saldoFinalExcel = (saldoFinalExcel ?? 0) + Number(r.valor_numerico);
      continue;
    }
    if (r.tipo_linha !== "movimento") continue;
    if (r.bloco_funcional === "subtotal" || r.bloco_funcional === "saldo") continue;
    if (!r.data_caixa_derivada || r.valor_numerico === null) continue;
    const k = r.data_caixa_derivada;
    const e = byDay.get(k) ?? { soma: 0, qtd: 0 };
    e.soma += Number(r.valor_numerico);
    e.qtd += 1;
    byDay.set(k, e);
  }

  const recRows = Array.from(byDay.entries()).map(([dia, v]) => ({
    batch_id,
    empresa_id: batch.empresa_id,
    escopo: "dia",
    chave: dia,
    valor_excel: v.soma,
    valor_sistema: v.soma,
    qtd_linhas_excel: v.qtd,
    qtd_linhas_sistema: v.qtd,
    qtd_pendencias: 0,
  }));

  let saldoCalculado: number | null = null;
  if (saldoInicial !== null) {
    saldoCalculado = saldoInicial +
      Array.from(byDay.values()).reduce((a, b) => a + b.soma, 0);
  }
  if (saldoFinalExcel !== null) {
    recRows.push({
      batch_id,
      empresa_id: batch.empresa_id,
      escopo: "total",
      chave: "saldo_final",
      valor_excel: saldoFinalExcel,
      valor_sistema: saldoCalculado ?? 0,
      qtd_linhas_excel: 1,
      qtd_linhas_sistema: 1,
      qtd_pendencias: 0,
    });
  }

  // limpa reconciliação anterior do batch (idempotente)
  await admin.from("fcr_reconciliacao_lote").delete().eq("batch_id", batch_id);
  if (recRows.length) {
    const { error } = await admin.from("fcr_reconciliacao_lote").insert(recRows);
    if (error) {
      await admin.from("fcr_batch").update({
        status: "erro",
        totais_promovidos: { error: error.message, step: "reconcile" },
      }).eq("id", batch_id);
      return json(500, { error: "reconcile_falhou", detail: error.message });
    }
  }

  // avalia bloqueios
  const bloqueios: string[] = [];
  if (batch.escopo_carga === "consolidado") {
    const pendentes = (raws ?? []).filter((r) =>
      r.tipo_linha === "movimento" &&
      (r as any).status_resolucao_empresa !== "resolvida"
    ).length;
    if (pendentes > 0) bloqueios.push(`${pendentes}_empresa_nao_resolvida`);
  }
  const { data: pend } = await admin.from("fcr_sugestoes_pendencias")
    .select("tipo_pendencia").eq("batch_id", batch_id).eq("status", "pendente");
  const blockers = new Set([
    "banco_nao_reconhecido",
    "de_para_ambiguo",
  ]);
  for (const p of pend ?? []) {
    if (blockers.has(p.tipo_pendencia)) bloqueios.push(p.tipo_pendencia);
  }
  // saldo divergente
  for (const r of recRows) {
    if (Math.abs((r.valor_excel ?? 0) - (r.valor_sistema ?? 0)) > 0.01) {
      bloqueios.push(`diferenca_${r.escopo}_${r.chave}`);
    }
  }

  const novoStatus = bloqueios.length === 0 ? "dry_run_ok" : "dry_run_erro";
  await admin.from("fcr_batch").update({
    status: novoStatus,
    saldos_finais_reconciliacao: {
      saldo_inicial_excel: saldoInicial,
      saldo_final_excel: saldoFinalExcel,
      saldo_final_calculado: saldoCalculado,
      bloqueios,
    },
  }).eq("id", batch_id);

  return json(200, { batch_id, status: novoStatus, bloqueios });
}

async function handleRollback(
  req: Request,
  ctx: AuthCtx,
): Promise<Response> {
  const { batch_id } = await req.json().catch(() => ({}));
  if (!batch_id) return json(400, { error: "batch_id obrigatório" });
  const admin = adminClient();
  const { data: batch } = await admin.from("fcr_batch").select("*").eq(
    "id",
    batch_id,
  ).maybeSingle();
  if (!batch) return json(404, { error: "batch não encontrado" });
  if (
    !canMutateBatch(
      ctx.roles,
      batch.escopo_carga,
      batch.empresa_id,
      ctx.empresaId,
    )
  ) {
    return json(403, { error: "sem permissão" });
  }
  if (batch.status === "promovido") {
    return json(409, { error: "batch promovido não pode ser revertido no PR-2" });
  }

  await admin.from("fcr_reconciliacao_lote").delete().eq("batch_id", batch_id);
  await admin.from("fcr_sugestoes_pendencias").delete().eq("batch_id", batch_id);
  await admin.from("fcr_raw_excel").delete().eq("batch_id", batch_id);
  const rm = await admin.storage.from("fcr-uploads").remove([batch.storage_path]);
  const cleanupOk = !rm.error;

  const update: Record<string, unknown> = {
    status: "revertido",
    revertido_por: ctx.userId,
    revertido_em: new Date().toISOString(),
  };
  if (!cleanupOk) {
    update.observacao =
      `[CLEANUP_PENDENTE] storage.remove falhou: ${rm.error?.message ?? "?"}`;
    update.totais_promovidos = {
      ...((batch.totais_promovidos as object) ?? {}),
      cleanup_pendente: {
        storage_path: batch.storage_path,
        erro: rm.error?.message ?? "?",
        em: new Date().toISOString(),
      },
    };
  }
  await admin.from("fcr_batch").update(update).eq("id", batch_id);

  return json(200, {
    batch_id,
    status: "revertido",
    storage_cleanup_ok: cleanupOk,
    cleanup_pendente: !cleanupOk,
  });
}

async function handleStatus(req: Request, ctx: AuthCtx): Promise<Response> {
  const url = new URL(req.url);
  const batch_id = url.searchParams.get("batch_id");
  if (!batch_id) return json(400, { error: "batch_id obrigatório" });
  const admin = adminClient();
  const { data: batch } = await admin.from("fcr_batch").select("*").eq(
    "id",
    batch_id,
  ).maybeSingle();
  if (!batch) return json(404, { error: "não encontrado" });
  if (
    !canReadBatch(ctx.roles, batch.escopo_carga, batch.empresa_id, ctx.empresaId)
  ) {
    return json(403, { error: "sem permissão" });
  }
  const [{ count: rawCount }, { count: pendCount }, { count: recCount }] =
    await Promise.all([
      admin.from("fcr_raw_excel").select("*", { count: "exact", head: true })
        .eq("batch_id", batch_id),
      admin.from("fcr_sugestoes_pendencias").select("*", {
        count: "exact",
        head: true,
      }).eq("batch_id", batch_id),
      admin.from("fcr_reconciliacao_lote").select("*", {
        count: "exact",
        head: true,
      }).eq("batch_id", batch_id),
    ]);
  return json(200, {
    batch,
    counts: {
      raw: rawCount ?? 0,
      pendencias: pendCount ?? 0,
      reconciliacao: recCount ?? 0,
    },
  });
}

// ----------------------------- entrypoint -----------------------------

interface AuthCtx {
  userId: string;
  roles: Set<Role>;
  empresaId: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Authorization Bearer obrigatório" });
    }
    const auth = await getUserAndRoles(authHeader);
    if (!auth) return json(401, { error: "token inválido" });
    if (auth.roles.size === 0) {
      return json(403, { error: "usuário sem role" });
    }
    const ctx: AuthCtx = auth;

    const url = new URL(req.url);
    const path = url.pathname.replace(/^.*\/fcr-load/, "") || "/";

    if (path === "/upload" && req.method === "POST") {
      return await handleUpload(req, ctx);
    }
    if (path === "/parse" && req.method === "POST") {
      return await handleParse(req, ctx);
    }
    if (path === "/reconcile" && req.method === "POST") {
      return await handleReconcile(req, ctx);
    }
    if (path === "/rollback" && req.method === "POST") {
      return await handleRollback(req, ctx);
    }
    if (path === "/status" && req.method === "GET") {
      return await handleStatus(req, ctx);
    }
    return json(404, { error: `rota não encontrada: ${req.method} ${path}` });
  } catch (e) {
    return json(500, { error: "internal", detail: String(e) });
  }
});
