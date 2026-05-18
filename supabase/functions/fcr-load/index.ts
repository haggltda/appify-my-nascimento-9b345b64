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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
  const { data, error } = await user.auth.getUser();
  if (error || !data?.user?.id) return null;
  const userId = data.user.id;
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
  const periodoInicio = form.get("periodo_inicio")
    ? String(form.get("periodo_inicio"))
    : null;
  const periodoFim = form.get("periodo_fim")
    ? String(form.get("periodo_fim"))
    : null;

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
      ...(periodoInicio && periodoFim
        ? { periodo: { inicio: periodoInicio, fim: periodoFim } }
        : {}),
    },
  });
  if (insErr) {
    await admin.storage.from("fcr-uploads").remove([storage_path]);
    return json(500, { error: "fcr_batch_insert_falhou", detail: insErr.message });
  }

  return json(200, { batch_id, status: "criado", file_sha256 });
}

async function handleUploadJson(req: Request, ctx: AuthCtx): Promise<Response> {
  const body = await req.json().catch(() => null) as any;
  if (!body) return json(400, { error: "json esperado" });
  const escopo = String(body.escopo ?? "");
  const empresa_id = body.empresa_id ? String(body.empresa_id) : null;
  const filename = String(body.filename ?? "upload.xlsx");
  const fileB64 = String(body.file_base64 ?? "");
  const periodoInicio = body.periodo_inicio ? String(body.periodo_inicio) : null;
  const periodoFim = body.periodo_fim ? String(body.periodo_fim) : null;

  if (!fileB64) return json(400, { error: "file_base64 obrigatório" });
  if (escopo !== "empresa" && escopo !== "consolidado") {
    return json(400, { error: "escopo deve ser empresa|consolidado" });
  }
  if (escopo === "empresa" && !empresa_id) {
    return json(400, { error: "empresa_id obrigatório" });
  }
  if (!canUpload(ctx.roles, escopo)) {
    return json(403, { error: "role sem permissão" });
  }
  if (escopo === "empresa" && !ctx.roles.has("admin") && ctx.empresaId !== empresa_id) {
    return json(403, { error: "empresa fora do escopo" });
  }

  const bin = Uint8Array.from(atob(fileB64), (c) => c.charCodeAt(0));
  if (bin.length > MAX_BYTES) return json(413, { error: "arquivo > 25MB" });
  if (!filename.toLowerCase().endsWith(".xlsx")) {
    return json(400, { error: "apenas .xlsx" });
  }
  if (!isXlsxMagic(bin)) return json(400, { error: "não é xlsx válido" });

  const file_sha256 = await sha256(bin);
  const admin = adminClient();

  const { data: dup } = await admin
    .from("fcr_batch")
    .select("id, status, escopo_carga, empresa_id")
    .eq("totais_excel->>file_sha256", file_sha256)
    .not("status", "in", "(revertido,erro)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dup && dup.escopo_carga === escopo && (dup.empresa_id ?? null) === empresa_id) {
    return json(409, {
      error: "arquivo_identico_ja_carregado",
      existing_batch_id: dup.id,
      existing_status: dup.status,
    });
  }

  const batch_id = crypto.randomUUID();
  const folder = escopo === "empresa" ? empresa_id! : "consolidado";
  const storage_path = `${folder}/${batch_id}/${filename}`;

  const up = await admin.storage.from("fcr-uploads").upload(storage_path, bin, {
    upsert: false,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (up.error) {
    return json(500, { error: "storage_upload_falhou", detail: up.error.message });
  }

  const { error: insErr } = await admin.from("fcr_batch").insert({
    id: batch_id,
    empresa_id,
    escopo_carga: escopo,
    arquivo_origem: filename,
    storage_path,
    modo: "dry_run",
    status: "criado",
    criado_por: ctx.userId,
    totais_excel: {
      file_sha256,
      size: bin.length,
      ...(periodoInicio && periodoFim
        ? { periodo: { inicio: periodoInicio, fim: periodoFim } }
        : {}),
    },
  });
  if (insErr) {
    await admin.storage.from("fcr-uploads").remove([storage_path]);
    return json(500, { error: "fcr_batch_insert_falhou", detail: insErr.message });
  }
  return json(200, { batch_id, status: "criado", file_sha256 });
}

// Registra um batch a partir de um arquivo JÁ enviado pelo cliente (tus) para o bucket fcr-uploads.
async function handleRegister(body: any, ctx: AuthCtx): Promise<Response> {
  const storage_path = String(body?.storage_path ?? "");
  const arquivo_origem = String(body?.arquivo_origem ?? storage_path.split("/").pop() ?? "upload.xlsx");
  const empresa_id: string | null = body?.empresa_id ? String(body.empresa_id) : null;
  const periodoInicio: string | null = body?.periodo_inicio ? String(body.periodo_inicio) : null;
  const periodoFim: string | null = body?.periodo_fim ? String(body.periodo_fim) : null;
  const escopo = empresa_id ? "empresa" : "consolidado";

  if (!storage_path) return json(400, { error: "storage_path obrigatório" });
  if (!arquivo_origem.toLowerCase().endsWith(".xlsx")) {
    return json(400, { error: "apenas .xlsx" });
  }
  if (!canUpload(ctx.roles, escopo)) {
    return json(403, { error: "role sem permissão" });
  }
  if (escopo === "empresa" && !ctx.roles.has("admin") && ctx.empresaId !== empresa_id) {
    return json(403, { error: "empresa fora do escopo" });
  }

  const admin = adminClient();

  // baixa para validar magic xlsx + sha256
  const dl = await admin.storage.from("fcr-uploads").download(storage_path);
  if (dl.error || !dl.data) {
    return json(404, { error: "arquivo_nao_encontrado_no_storage", detail: dl.error?.message });
  }
  const bin = new Uint8Array(await dl.data.arrayBuffer());
  if (bin.length > MAX_BYTES) {
    await admin.storage.from("fcr-uploads").remove([storage_path]);
    return json(413, { error: "arquivo > 25MB" });
  }
  if (!isXlsxMagic(bin)) {
    await admin.storage.from("fcr-uploads").remove([storage_path]);
    return json(400, { error: "não é xlsx válido" });
  }
  const file_sha256 = await sha256(bin);

  // dedupe
  const { data: dup } = await admin
    .from("fcr_batch")
    .select("id, status, escopo_carga, empresa_id")
    .eq("totais_excel->>file_sha256", file_sha256)
    .not("status", "in", "(revertido,erro)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dup && dup.escopo_carga === escopo && (dup.empresa_id ?? null) === empresa_id) {
    return json(409, {
      error: "arquivo_identico_ja_carregado",
      existing_batch_id: dup.id,
      existing_status: dup.status,
    });
  }

  const batch_id = crypto.randomUUID();
  const { error: insErr } = await admin.from("fcr_batch").insert({
    id: batch_id,
    empresa_id,
    escopo_carga: escopo,
    arquivo_origem,
    storage_path,
    modo: "dry_run",
    status: "criado",
    criado_por: ctx.userId,
    totais_excel: {
      file_sha256,
      size: bin.length,
      ...(periodoInicio && periodoFim
        ? { periodo: { inicio: periodoInicio, fim: periodoFim } }
        : {}),
    },
  });
  if (insErr) {
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

// PR-2.2: parse em chunks de 5.000 com EdgeRuntime.waitUntil + retry 3× backoff.
// O response retorna 202 em <2s; o trabalho roda em background e a UI faz polling em /status.
const PARSE_CHUNK_SIZE = 5000;
const PARSE_RETRY_BACKOFF_MS = [1000, 3000, 9000];

async function insertChunkWithRetry(
  admin: SupabaseClient,
  table: string,
  rows: any[],
  batch_id: string,
  chunk_idx: number,
  linha_inicio: number,
  linha_fim: number,
): Promise<{ inserted: number; ok: boolean; lastError: string | null }> {
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await admin.from(table).upsert(rows, {
        onConflict: "hash_idempotencia",
        ignoreDuplicates: true,
      }).select("id");
      if (error) throw new Error(error.message);
      return { inserted: data?.length ?? 0, ok: true, lastError: null };
    } catch (e) {
      lastError = String(e instanceof Error ? e.message : e);
      await admin.from("fcr_parse_chunk_erro").insert({
        batch_id,
        chunk_idx,
        linha_inicio,
        linha_fim,
        tentativa: attempt,
        erro_msg: lastError,
      });
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, PARSE_RETRY_BACKOFF_MS[attempt - 1]));
      }
    }
  }
  return { inserted: 0, ok: false, lastError };
}

async function runParseBackground(batch_id: string): Promise<void> {
  const admin = adminClient();
  const startedAt = Date.now();
  const { data: batch } = await admin.from("fcr_batch").select("*").eq("id", batch_id).maybeSingle();
  if (!batch) return;

  try {
    const dl = await admin.storage.from("fcr-uploads").download(batch.storage_path);
    if (dl.error || !dl.data) throw new Error("falha download storage: " + dl.error?.message);
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    const wb = XLSX.read(buf, {
      type: "array",
      cellDates: true,
      cellFormula: false, // economia de memória — formulas não são necessárias
      cellHTML: false,
      cellNF: false,
      sheetStubs: false,
    });

    const file_sha256 = (batch.totais_excel?.file_sha256 as string) || "";
    const periodo = periodoFromBatch(batch);

    // contadores agregados
    let linhasLidas = 0;
    let linhasInseridas = 0;
    let chunkIdx = 0;
    let totalChunksEstimado = 0;
    let ltCount = 0;
    let foraPeriodo = 0;
    let layoutGlobal: "long_table" | "matrix" | null = null;
    let chunkErros = 0;
    let buffer: RawRow[] = [];
    // pendências por raw → resolvidas DEPOIS via raw_id consultando hashes
    const pendBuffer: Array<{
      hash: string;
      tipo_pendencia: string;
      motivo: string;
      destino_proposto: string;
      classificacao_excel_original: string | null;
      historico_original: string | null;
      data_caixa: string | null;
      valor_original: number | null;
      empresa_id: string | null;
    }> = [];

    // estima total de linhas para chunks_total
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      if (!ws || !ws["!ref"]) continue;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      totalChunksEstimado += Math.ceil((range.e.r - range.s.r) / PARSE_CHUNK_SIZE);
    }
    await admin.from("fcr_batch").update({
      chunks_total: Math.max(1, totalChunksEstimado),
      parse_iniciado_em: new Date().toISOString(),
    }).eq("id", batch_id);

    const flushBuffer = async () => {
      if (buffer.length === 0) return;
      const linhaInicio = buffer[0].linha_origem;
      const linhaFim = buffer[buffer.length - 1].linha_origem;
      chunkIdx += 1;
      const res = await insertChunkWithRetry(
        admin, "fcr_raw_excel", buffer, batch_id, chunkIdx, linhaInicio, linhaFim,
      );
      if (res.ok) {
        linhasInseridas += res.inserted;
      } else {
        chunkErros += 1;
      }
      await admin.from("fcr_batch").update({
        chunk_atual: chunkIdx,
        linhas_lidas: linhasLidas,
        linhas_inseridas: linhasInseridas,
        ultimo_erro: res.lastError,
      }).eq("id", batch_id);
      buffer = [];
    };

    for (let si = 0; si < wb.SheetNames.length; si++) {
      const sheetName = wb.SheetNames[si];
      const ws = wb.Sheets[sheetName];
      if (!ws || !ws["!ref"]) continue;
      const sheetHidden = Boolean((wb as any).Workbook?.Sheets?.[si]?.Hidden);
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const rowsMeta = (ws as any)["!rows"] || [];
      const colsMeta = (ws as any)["!cols"] || [];

      // cabeçalho
      let headerRow = range.s.r;
      for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
        let nonEmpty = 0;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v != null && String(cell.v).trim() !== "") nonEmpty++;
        }
        if (nonEmpty >= 2) { headerRow = r; break; }
      }
      const headers: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const hc = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
        headers[c] = hc?.v != null ? String(hc.v).trim() : "";
      }

      const ltMap = mapLongTableHeaders(headers);
      const longTable = isLongTable(ltMap);
      const layoutMode = longTable ? "long_table" : "matrix";
      if (!layoutGlobal) layoutGlobal = layoutMode;

      if (longTable) {
        const cValor = ltMap.valor!;
        const cData = ltMap.data!;
        const cClass = ltMap.classificacao!;
        const cTipo = ltMap.tipo;
        const cEmpresa = ltMap.empresa;
        const cBanco = ltMap.banco;
        const cConta = ltMap.conta;
        const cHist = ltMap.historico;
        const cId = ltMap.id_origem;

        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const rowHidden = Boolean(rowsMeta[r]?.hidden);
          const colHiddenValor = Boolean(colsMeta[cValor]?.hidden);

          const valorCell = ws[XLSX.utils.encode_cell({ r, c: cValor })];
          const classCell = ws[XLSX.utils.encode_cell({ r, c: cClass })];
          const dataCell = ws[XLSX.utils.encode_cell({ r, c: cData })];
          const tipoCell = cTipo !== undefined
            ? ws[XLSX.utils.encode_cell({ r, c: cTipo })] : undefined;

          const classificacao = classCell?.v != null ? String(classCell.v) : "";
          const tipo = classifyTipoLinha(classificacao);
          const bloco = classifyBloco(classificacao);
          if (!ALLOWED_BLOCOS.has(bloco)) continue;

          const valor_texto = valorCell?.w ?? (valorCell?.v != null ? String(valorCell.v) : null);
          const valor_num = parseBR(valorCell?.v);
          const data_caixa = parseCellDate(dataCell);
          const addr = XLSX.utils.encode_cell({ r, c: cValor });

          const cellTxt = (col: number | undefined) =>
            col !== undefined && ws[XLSX.utils.encode_cell({ r, c: col })]?.v != null
              ? String(ws[XLSX.utils.encode_cell({ r, c: col })].v) : null;
          const banco_txt = cellTxt(cBanco);
          const conta_txt = cellTxt(cConta);
          const empresa_txt = cellTxt(cEmpresa);
          const hist_txt = cellTxt(cHist);
          const id_origem = cId !== undefined && ws[XLSX.utils.encode_cell({ r, c: cId })]?.v != null
            ? String(ws[XLSX.utils.encode_cell({ r, c: cId })].v).trim() : null;
          const tipo_mov_orig = tipoCell?.v != null ? String(tipoCell.v) : null;
          const tipo_mov_norm = normalizeTipoMovimento(tipo_mov_orig);

          // regra de sinal
          let valor_assinado: number | null = null;
          let pend_sinal = false;
          if (tipo === "saldo_inicial") {
            valor_assinado = valor_num;
          } else if (tipo === "movimento" && valor_num !== null) {
            if (tipo_mov_norm === "entrada") valor_assinado = Math.abs(valor_num);
            else if (tipo_mov_norm === "saida") valor_assinado = -Math.abs(valor_num);
            else { valor_assinado = null; pend_sinal = true; }
          } else {
            valor_assinado = valor_num;
          }

          const fora = data_caixa
            ? (data_caixa < periodo.inicio || data_caixa > periodo.fim) : false;
          if (fora) foraPeriodo += 1;

          const hashInput =
            `${batch_id}|${file_sha256}|${sheetName}|${addr}|${valor_texto ?? ""}|LT|${id_origem ?? ""}`;
          const hash = await sha256(new TextEncoder().encode(hashInput));

          const requer_revisao = /CONTA\s+VINCULADA/.test(normalize(classificacao));
          const excludeFromMath = sheetHidden || rowHidden || colHiddenValor;

          buffer.push({
            batch_id,
            empresa_id_origem_celula: empresa_txt,
            empresa_id_resolvida: batch.escopo_carga === "empresa" ? batch.empresa_id : null,
            status_resolucao_empresa: batch.escopo_carga === "empresa" ? "resolvida" : "pendente",
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
              exclude_from_math: excludeFromMath,
              cell_type: valorCell?.t ?? null,
              tipo_movimento_original: tipo_mov_orig,
              tipo_movimento_normalizado: tipo_mov_norm,
              requer_revisao,
            },
            hash_idempotencia: hash,
          });
          linhasLidas += 1;
          ltCount += 1;

          if (pend_sinal) {
            pendBuffer.push({
              hash, tipo_pendencia: "sinal_inconsistente",
              motivo: `Tipo invalido/ausente p/ movimento: '${tipo_mov_orig ?? ""}'`,
              destino_proposto: "a_conciliar",
              classificacao_excel_original: classificacao || null,
              historico_original: hist_txt, data_caixa,
              valor_original: valor_num,
              empresa_id: batch.escopo_carga === "empresa" ? batch.empresa_id : null,
            });
          }
          if (fora) {
            pendBuffer.push({
              hash, tipo_pendencia: "fora_do_periodo",
              motivo: `data ${data_caixa} fora de ${periodo.inicio}..${periodo.fim}`,
              destino_proposto: "ignorar",
              classificacao_excel_original: classificacao || null,
              historico_original: hist_txt, data_caixa,
              valor_original: valor_num,
              empresa_id: batch.escopo_carga === "empresa" ? batch.empresa_id : null,
            });
          }
          if (requer_revisao) {
            pendBuffer.push({
              hash, tipo_pendencia: "a_conciliar",
              motivo: "CONTA VINCULADA — requer revisão",
              destino_proposto: "a_conciliar",
              classificacao_excel_original: classificacao || null,
              historico_original: hist_txt, data_caixa,
              valor_original: valor_num,
              empresa_id: batch.escopo_carga === "empresa" ? batch.empresa_id : null,
            });
          }
          if (excludeFromMath && tipo === "movimento" && valor_num !== null && Math.abs(valor_num) > 0) {
            pendBuffer.push({
              hash, tipo_pendencia: "linha_calculada_ambigua",
              motivo: "cell_hidden_has_numeric_value",
              destino_proposto: "a_conciliar",
              classificacao_excel_original: classificacao || null,
              historico_original: hist_txt, data_caixa,
              valor_original: valor_num,
              empresa_id: batch.escopo_carga === "empresa" ? batch.empresa_id : null,
            });
          }

          if (buffer.length >= PARSE_CHUNK_SIZE) {
            await flushBuffer();
          }
        }
      } else {
        // layout matriz (compat). Tipicamente arquivo pequeno.
        let labelCol = range.s.c;
        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const rowHidden = Boolean(rowsMeta[r]?.hidden);
          const labelCell = ws[XLSX.utils.encode_cell({ r, c: labelCol })];
          const label = labelCell?.v != null ? String(labelCell.v) : "";
          const tipo = classifyTipoLinha(label);
          const bloco = classifyBloco(label);
          if (!ALLOWED_BLOCOS.has(bloco)) continue;

          for (let c = range.s.c; c <= range.e.c; c++) {
            const colHidden = Boolean(colsMeta[c]?.hidden);
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (!cell) continue;
            if (c === labelCol) continue;
            const addr = XLSX.utils.encode_cell({ r, c });
            const headerVal = headers[c] ?? "";
            const valor_texto = cell.w ?? (cell.v != null ? String(cell.v) : null);
            const valor_num = parseBR(cell.v);
            if (valor_num === null && !cell.v) continue;
            const data_caixa = tryParseDateFromHeader(headerVal);
            const hashInput = `${batch_id}|${file_sha256}|${sheetName}|${addr}|${valor_texto ?? ""}`;
            const hash = await sha256(new TextEncoder().encode(hashInput));
            buffer.push({
              batch_id,
              empresa_id_origem_celula: null,
              empresa_id_resolvida: batch.escopo_carga === "empresa" ? batch.empresa_id : null,
              status_resolucao_empresa: batch.escopo_carga === "empresa" ? "resolvida" : "pendente",
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
                layout_mode: layoutMode, sheet_hidden: sheetHidden,
                row_hidden: rowHidden, col_hidden: colHidden,
                exclude_from_math: sheetHidden || rowHidden || colHidden,
                cell_type: cell.t ?? null,
              },
              hash_idempotencia: hash,
            });
            linhasLidas += 1;
            if (buffer.length >= PARSE_CHUNK_SIZE) await flushBuffer();
          }
        }
      }
    }
    // flush final
    await flushBuffer();

    // ---------- pendências: resolver raw_id por hash em batches ----------
    if (pendBuffer.length > 0) {
      const HASH_LOOKUP = 500;
      const hashToId = new Map<string, string>();
      const allHashes = [...new Set(pendBuffer.map((p) => p.hash))];
      for (let i = 0; i < allHashes.length; i += HASH_LOOKUP) {
        const slice = allHashes.slice(i, i + HASH_LOOKUP);
        const { data } = await admin.from("fcr_raw_excel")
          .select("id, hash_idempotencia")
          .eq("batch_id", batch_id)
          .in("hash_idempotencia", slice);
        for (const row of data ?? []) hashToId.set(row.hash_idempotencia, row.id);
      }
      const pendRows = pendBuffer
        .map((p) => {
          const raw_id = hashToId.get(p.hash);
          if (!raw_id) return null;
          return {
            batch_id, raw_id,
            empresa_id: p.empresa_id,
            classificacao_excel_original: p.classificacao_excel_original,
            historico_original: p.historico_original,
            data_caixa: p.data_caixa,
            valor_original: p.valor_original,
            tipo_pendencia: p.tipo_pendencia,
            destino_proposto: p.destino_proposto,
            status: "pendente",
            motivo: p.motivo,
          };
        })
        .filter((r) => r !== null);
      for (let i = 0; i < pendRows.length; i += 1000) {
        const slice = pendRows.slice(i, i + 1000);
        await admin.from("fcr_sugestoes_pendencias").insert(slice as any[]);
      }
    }

    // ---------- id_origem duplicado: detectar em DB (não em memória) ----------
    let idDup = 0;
    try {
      const { data: dups } = await admin
        .from("fcr_raw_excel")
        .select("id, id_origem_texto, empresa_id_resolvida, classificacao_excel_original, historico_original, data_caixa_derivada, valor_numerico")
        .eq("batch_id", batch_id)
        .not("id_origem_texto", "is", null);
      const groups = new Map<string, any[]>();
      for (const row of dups ?? []) {
        const list = groups.get(row.id_origem_texto) ?? [];
        list.push(row);
        groups.set(row.id_origem_texto, list);
      }
      const dupPends: any[] = [];
      for (const [id_origem, items] of groups) {
        if (items.length < 2) continue;
        idDup += 1;
        for (const it of items) {
          dupPends.push({
            batch_id, raw_id: it.id,
            empresa_id: it.empresa_id_resolvida,
            classificacao_excel_original: it.classificacao_excel_original,
            historico_original: it.historico_original,
            data_caixa: it.data_caixa_derivada,
            valor_original: it.valor_numerico,
            tipo_pendencia: "id_origem_duplicado",
            destino_proposto: "a_conciliar",
            status: "pendente",
            motivo: `id_origem '${id_origem}' repetido ${items.length}x`,
          });
        }
      }
      for (let i = 0; i < dupPends.length; i += 1000) {
        await admin.from("fcr_sugestoes_pendencias").insert(dupPends.slice(i, i + 1000));
      }
    } catch (e) {
      console.error("id_origem dedup falhou", e);
    }

    const finalStatus = chunkErros === 0 ? "parseando" : "erro_parse";
    // Mantemos status='parseando' quando ok para permitir Reconcile (que exige parseando).
    await admin.from("fcr_batch").update({
      status: finalStatus,
      parse_finalizado_em: new Date().toISOString(),
      totais_promovidos: {
        parse: {
          total: linhasLidas,
          inserted_count: linhasInseridas,
          long_table_rows: ltCount,
          fora_do_periodo: foraPeriodo,
          id_origem_duplicados: idDup,
          layout: layoutGlobal,
          chunks: chunkIdx,
          chunk_erros: chunkErros,
          duracao_ms: Date.now() - startedAt,
        },
      },
    }).eq("id", batch_id);
  } catch (e) {
    await admin.from("fcr_batch").update({
      status: "erro_parse",
      ultimo_erro: String(e instanceof Error ? e.message : e),
      parse_finalizado_em: new Date().toISOString(),
    }).eq("id", batch_id);
  }
}

async function handleParse(req: Request, ctx: AuthCtx): Promise<Response> {
  const { batch_id } = await req.json().catch(() => ({}));
  if (!batch_id || typeof batch_id !== "string") {
    return json(400, { error: "batch_id obrigatório" });
  }
  const admin = adminClient();
  const { data: batch } = await admin.from("fcr_batch").select("*").eq("id", batch_id).maybeSingle();
  if (!batch) return json(404, { error: "batch não encontrado" });
  if (!canMutateBatch(ctx.roles, batch.escopo_carga, batch.empresa_id, ctx.empresaId)) {
    return json(403, { error: "sem permissão para mutar este batch" });
  }
  if (!["criado", "parseando", "erro_parse"].includes(batch.status)) {
    return json(409, { error: `status inválido para parse: ${batch.status}` });
  }

  // Reset contadores ao iniciar/retomar e marca parseando
  await admin.from("fcr_batch").update({
    status: "parseando",
    chunk_atual: 0,
    linhas_lidas: 0,
    linhas_inseridas: 0,
    chunks_total: null,
    parse_iniciado_em: new Date().toISOString(),
    parse_finalizado_em: null,
    ultimo_erro: null,
  }).eq("id", batch_id);
  await admin.from("fcr_parse_chunk_erro").delete().eq("batch_id", batch_id);

  // Dispara em background — não bloqueia o response
  // @ts-ignore - EdgeRuntime é fornecido pelo Deno Deploy/Supabase
  EdgeRuntime.waitUntil(runParseBackground(batch_id));

  return json(202, {
    batch_id,
    status: "parseando",
    message: "parse iniciado em background; consulte /status para progresso",
  });
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

  // Busca raws paginado (carga oficial pode ter > 1000 linhas)
  const allRaws: any[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await admin.from("fcr_raw_excel")
        .select(
          "data_caixa_derivada, valor_numerico, valor_assinado_caixa, fora_do_periodo, tipo_linha, bloco_funcional, classificacao_excel_original, banco_origem_texto, empresa_id_resolvida, empresa_id_origem_celula, status_resolucao_empresa, raw_json",
        )
        .eq("batch_id", batch_id)
        .range(from, from + PAGE - 1);
      if (error) return json(500, { error: "fetch raws falhou", detail: error.message });
      if (!data || data.length === 0) break;
      allRaws.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const raws = allRaws;

  // Detecta layout long_table (qualquer raw com layout_mode='long_table')
  const isLT = raws.some((r) => (r.raw_json as any)?.layout_mode === "long_table");

  // -------- Reconciliação LONG_TABLE --------
  // valor_numerico = bruto original (preservado)
  // valor_assinado_caixa = derivado para composição de caixa
  // SALDO ANTERIOR não entra como movimento; vira saldo inicial
  // fora_do_periodo não entra na reconciliação do período oficial
  const totalLinhas = raws.length;
  const linhasComValor = raws.filter((r) => r.valor_numerico !== null).length;
  const linhasSemValor = totalLinhas - linhasComValor;
  const linhasForaPeriodo = raws.filter((r) => r.fora_do_periodo).length;
  const linhas2026 = raws.filter((r) => !r.fora_do_periodo).length;

  let saldoInicial = 0;
  let entradas = 0;
  let saidas = 0;
  let liquido = 0;
  let saldoFinalExcel: number | null = null;

  const byDay = new Map<string, { entradas: number; saidas: number; liquido: number; qtd: number }>();
  const byBanco = new Map<string, { saldo_inicial: number; entradas: number; saidas: number; liquido: number }>();
  const byEmpresa = new Map<string, { saldo_inicial: number; entradas: number; saidas: number; liquido: number }>();
  const byClass = new Map<string, { total_bruto: number; total_assinado: number; qtd: number }>();
  const byBloco = new Map<string, { total_bruto: number; total_assinado: number; qtd: number }>();
  const empresasSet = new Set<string>();
  const bancosSet = new Set<string>();
  const classifSet = new Set<string>();

  const bumpClass = (key: string, bruto: number, assinado: number) => {
    const e = byClass.get(key) ?? { total_bruto: 0, total_assinado: 0, qtd: 0 };
    e.total_bruto += bruto; e.total_assinado += assinado; e.qtd += 1;
    byClass.set(key, e);
  };
  const bumpBloco = (key: string, bruto: number, assinado: number) => {
    const e = byBloco.get(key) ?? { total_bruto: 0, total_assinado: 0, qtd: 0 };
    e.total_bruto += bruto; e.total_assinado += assinado; e.qtd += 1;
    byBloco.set(key, e);
  };

  for (const r of raws) {
    const ex = (r.raw_json as any)?.exclude_from_math;
    if (ex) continue;

    const cls = r.classificacao_excel_original || "(sem classificacao)";
    const banco = r.banco_origem_texto || "(sem banco)";
    const empresa = r.empresa_id_resolvida || r.empresa_id_origem_celula || "(sem empresa)";
    classifSet.add(cls); bancosSet.add(banco); empresasSet.add(String(empresa));

    const vnum = r.valor_numerico !== null ? Number(r.valor_numerico) : null;
    const vass = r.valor_assinado_caixa !== null ? Number(r.valor_assinado_caixa) : null;

    // SALDO ANTERIOR: só agrega saldo inicial; não entra como movimento
    if (r.tipo_linha === "saldo_inicial") {
      if (vnum !== null) {
        saldoInicial += vnum;
        const eb = byBanco.get(banco) ?? { saldo_inicial: 0, entradas: 0, saidas: 0, liquido: 0 };
        eb.saldo_inicial += vnum; byBanco.set(banco, eb);
        const ee = byEmpresa.get(String(empresa)) ?? { saldo_inicial: 0, entradas: 0, saidas: 0, liquido: 0 };
        ee.saldo_inicial += vnum; byEmpresa.set(String(empresa), ee);
        bumpClass(cls, vnum, vnum); bumpBloco("saldo", vnum, vnum);
      }
      continue;
    }
    if (r.tipo_linha === "saldo_final" && vnum !== null) {
      saldoFinalExcel = (saldoFinalExcel ?? 0) + vnum;
      continue;
    }
    if (r.tipo_linha !== "movimento") continue;
    if (r.bloco_funcional === "subtotal") continue;
    if (r.fora_do_periodo) continue; // não entra na reconciliação 2026
    if (vass === null) continue;     // sem sinal definido → pendência; não compõe

    if (vass > 0) entradas += vass; else saidas += Math.abs(vass);
    liquido += vass;

    if (r.data_caixa_derivada) {
      const d = byDay.get(r.data_caixa_derivada) ?? { entradas: 0, saidas: 0, liquido: 0, qtd: 0 };
      if (vass > 0) d.entradas += vass; else d.saidas += Math.abs(vass);
      d.liquido += vass; d.qtd += 1;
      byDay.set(r.data_caixa_derivada, d);
    }
    const eb = byBanco.get(banco) ?? { saldo_inicial: 0, entradas: 0, saidas: 0, liquido: 0 };
    if (vass > 0) eb.entradas += vass; else eb.saidas += Math.abs(vass);
    eb.liquido += vass; byBanco.set(banco, eb);

    const ee = byEmpresa.get(String(empresa)) ?? { saldo_inicial: 0, entradas: 0, saidas: 0, liquido: 0 };
    if (vass > 0) ee.entradas += vass; else ee.saidas += Math.abs(vass);
    ee.liquido += vass; byEmpresa.set(String(empresa), ee);

    bumpClass(cls, vnum ?? 0, vass);
    bumpBloco(r.bloco_funcional, vnum ?? 0, vass);
  }

  const saldoCalculado = saldoInicial + liquido;

  // Linhas para fcr_reconciliacao_lote (escopos: dia/banco/empresa/total)
  const recRows: any[] = [];
  for (const [dia, v] of byDay) {
    recRows.push({
      batch_id, empresa_id: batch.empresa_id, escopo: "dia", chave: dia,
      valor_excel: v.liquido, valor_sistema: v.liquido,
      qtd_linhas_excel: v.qtd, qtd_linhas_sistema: v.qtd, qtd_pendencias: 0,
    });
  }
  for (const [banco, v] of byBanco) {
    recRows.push({
      batch_id, empresa_id: batch.empresa_id, escopo: "banco", chave: banco,
      valor_excel: v.liquido, valor_sistema: v.liquido,
      qtd_linhas_excel: 0, qtd_linhas_sistema: 0, qtd_pendencias: 0,
    });
  }
  recRows.push({
    batch_id, empresa_id: batch.empresa_id, escopo: "total", chave: "saldo_final",
    valor_excel: saldoFinalExcel ?? saldoCalculado, valor_sistema: saldoCalculado,
    qtd_linhas_excel: 1, qtd_linhas_sistema: 1, qtd_pendencias: 0,
  });

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
    const pendentes = raws.filter((r) =>
      r.tipo_linha === "movimento" &&
      (r as any).status_resolucao_empresa !== "resolvida"
    ).length;
    if (pendentes > 0) bloqueios.push(`${pendentes}_empresa_nao_resolvida`);
  }
  const { data: pend } = await admin.from("fcr_sugestoes_pendencias")
    .select("tipo_pendencia").eq("batch_id", batch_id).eq("status", "pendente");
  const pendByTipo: Record<string, number> = {};
  for (const p of pend ?? []) {
    pendByTipo[p.tipo_pendencia] = (pendByTipo[p.tipo_pendencia] ?? 0) + 1;
  }
  const blockers = new Set([
    "banco_nao_reconhecido",
    "de_para_ambiguo",
    "sinal_inconsistente",
    "transferencia_sem_par",
  ]);
  for (const tipo of Object.keys(pendByTipo)) {
    if (blockers.has(tipo)) bloqueios.push(`${tipo}:${pendByTipo[tipo]}`);
  }
  if (saldoFinalExcel !== null && Math.abs(saldoFinalExcel - saldoCalculado) > 0.01) {
    bloqueios.push(`diferenca_saldo_final:${(saldoFinalExcel - saldoCalculado).toFixed(2)}`);
  }

  const novoStatus = bloqueios.length === 0 ? "dry_run_ok" : "dry_run_erro";

  const relatorio = {
    layout_mode: isLT ? "long_table" : "matrix",
    cobertura: {
      total_linhas: totalLinhas,
      linhas_no_periodo: linhas2026,
      linhas_fora_do_periodo: linhasForaPeriodo,
      linhas_com_valor: linhasComValor,
      linhas_sem_valor: linhasSemValor,
      empresas: empresasSet.size,
      bancos: bancosSet.size,
      classificacoes: classifSet.size,
    },
    saldos: {
      saldo_anterior_total: round2(saldoInicial),
      entradas: round2(entradas),
      saidas: round2(saidas),
      movimento_liquido: round2(liquido),
      saldo_final_calculado: round2(saldoCalculado),
      saldo_final_excel: saldoFinalExcel !== null ? round2(saldoFinalExcel) : null,
    },
    por_dia: (() => {
      const arr = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      let acc = saldoInicial;
      return arr.map(([dia, v]) => {
        acc += v.liquido;
        return {
          dia, entradas: round2(v.entradas), saidas: round2(v.saidas),
          liquido: round2(v.liquido), saldo_acumulado: round2(acc), qtd: v.qtd,
        };
      });
    })(),
    por_banco: Array.from(byBanco.entries()).map(([banco, v]) => ({
      banco,
      saldo_inicial: round2(v.saldo_inicial),
      entradas: round2(v.entradas),
      saidas: round2(v.saidas),
      liquido: round2(v.liquido),
      saldo_final_calculado: round2(v.saldo_inicial + v.liquido),
    })),
    por_empresa: Array.from(byEmpresa.entries()).map(([empresa, v]) => ({
      empresa,
      saldo_inicial: round2(v.saldo_inicial),
      entradas: round2(v.entradas),
      saidas: round2(v.saidas),
      liquido: round2(v.liquido),
      saldo_final_calculado: round2(v.saldo_inicial + v.liquido),
    })),
    por_classificacao: Array.from(byClass.entries()).map(([cls, v]) => ({
      classificacao: cls,
      total_bruto: round2(v.total_bruto),
      total_assinado: round2(v.total_assinado),
      qtd: v.qtd,
    })),
    por_bloco_funcional: Array.from(byBloco.entries()).map(([bloco, v]) => ({
      bloco, total_bruto: round2(v.total_bruto),
      total_assinado: round2(v.total_assinado), qtd: v.qtd,
    })),
    pendencias_por_tipo: pendByTipo,
    bloqueios,
    impacto_substituicao: {
      observacao:
        "PR-3 deverá ser substituição oficial, não append. Comparação detalhada contra carga antiga será gerada no PR-3 (fora do escopo desta Fase A2).",
    },
  };

  await admin.from("fcr_batch").update({
    status: novoStatus,
    saldos_finais_reconciliacao: {
      saldo_inicial_total: round2(saldoInicial),
      entradas: round2(entradas),
      saidas: round2(saidas),
      movimento_liquido: round2(liquido),
      saldo_final_calculado: round2(saldoCalculado),
      saldo_final_excel: saldoFinalExcel !== null ? round2(saldoFinalExcel) : null,
      bloqueios,
      relatorio,
    },
  }).eq("id", batch_id);

  return json(200, { batch_id, status: novoStatus, bloqueios, relatorio });
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

    // Dispatch por action (frontend usa supabase.functions.invoke, que bate em "/")
    if ((path === "/" || path === "") && req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const raw = await req.text();
        let body: any = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
        const action = String(body.action ?? "");
        if (action === "register") {
          return await handleRegister(body, ctx);
        }
        const reqWithBody = new Request(req.url, {
          method: "POST",
          headers: req.headers,
          body: JSON.stringify(body),
        });
        if (action === "parse") return await handleParse(reqWithBody, ctx);
        if (action === "reconcile") return await handleReconcile(reqWithBody, ctx);
        if (action === "rollback") return await handleRollback(reqWithBody, ctx);
        if (action === "status") return await handleStatus(reqWithBody, ctx);
        return json(400, { error: `action inválida: ${action || "(vazia)"}` });
      }
    }

    if (path === "/upload" && req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return await handleUploadJson(req, ctx);
      }
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
