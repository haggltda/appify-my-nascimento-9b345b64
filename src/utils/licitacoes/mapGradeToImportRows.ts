/**
 * Mapper Grade → contrato de licitacao_importacao_anexar_linhas (REV4).
 * - raw_original ENUMERÁVEL (H20).
 * - Normaliza abertura para YYYY-MM-DD quando seguro; senão mantém original (H18).
 * - Normaliza valor BR/US sem corromper (H19).
 * - Mantém "Resp: ..." em observacoes (não converte para user_id) (H11).
 * - Não corrige status silenciosamente (backend rejeita).
 */

export type GradeImportRow = {
  numero: string;
  orgao: string;
  objeto: string;
  modalidade?: string | null;
  valor_estimado?: string | number | null;
  status?: string | null;
  abertura: string;
  observacoes?: string | null;
  local_prestacao?: string | null;
  raw_original?: unknown;
};

export const STATUS_VALIDOS = [
  "rascunho",
  "oportunidade",
  "em_andamento",
  "vencida",
  "perdida",
  "cancelada",
] as const;
export type StatusValido = (typeof STATUS_VALIDOS)[number];

/** Campos do seed atual sem destino direto no contrato da RPC — preservados em raw_original. */
export const COLUNAS_SEM_DESTINO_NO_BANCO = ["empresa_id", "origem_carga"];

/** "Resp: Fulano | ..." → "Fulano" */
export function extrairResponsavelTexto(obs?: string | null): string | null {
  const m = String(obs ?? "").match(/Resp:\s*([^|;\n]+)/i);
  return m?.[1]?.trim() || null;
}

export function normalizarAbertura(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (iso) return iso[1];
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s; // mantém para backend marcar data_invalida
}

export function normalizarValor(v: unknown): number | string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  const original = String(v).trim();
  if (!original) return null;
  const s = original.replace(/[R$\s]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    // 1.234,56
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : original;
  }
  if (/^-?\d+,\d+$/.test(s)) {
    // 1234,56
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : original;
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    // 1234.56 / 1234
    const n = Number(s);
    return Number.isFinite(n) ? n : original;
  }
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // 1.234
    const n = Number(s.replace(/\./g, ""));
    return Number.isFinite(n) ? n : original;
  }
  return original;
}

export function mapGradeToImportRows(input: unknown[]): GradeImportRow[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      numero: String(r.numero ?? "").trim(),
      orgao: String(r.orgao ?? "").trim(),
      objeto: String(r.objeto ?? "").trim(),
      modalidade: r.modalidade == null ? null : String(r.modalidade),
      valor_estimado: normalizarValor(r.valor_estimado),
      status: r.status == null ? null : String(r.status).trim(),
      abertura: normalizarAbertura(r.abertura),
      observacoes: r.observacoes == null ? null : String(r.observacoes),
      local_prestacao: r.local_prestacao == null ? null : String(r.local_prestacao),
      raw_original: raw, // enumerável (H20)
    };
  });
}

/** Hash FNV-1a 32 bits hex para arquivo_hash do lote. */
export function hashRows(rows: unknown): string {
  const s = JSON.stringify(rows);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
