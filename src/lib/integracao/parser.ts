import * as XLSX from "xlsx";

/** Compute SHA-256 hash of a File using browser SubtleCrypto. */
export async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export interface ParsedFile {
  fileName: string;
  sheets: ParsedSheet[];
}

/** Parse an XLSX/CSV file. Returns first 50 sheets, all rows per sheet. */
export async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    if (!aoa.length) {
      sheets.push({ sheetName, headers: [], rows: [], totalRows: 0 });
      continue;
    }
    const headerRow = (aoa[0] ?? []).map((h, i) =>
      h == null || String(h).trim() === "" ? `col_${i + 1}` : String(h).trim(),
    );
    const rows: Record<string, unknown>[] = aoa.slice(1).map((r) => {
      const obj: Record<string, unknown> = {};
      headerRow.forEach((h, i) => (obj[h] = r[i] ?? null));
      return obj;
    });
    sheets.push({ sheetName, headers: headerRow, rows, totalRows: rows.length });
  }
  return { fileName: file.name, sheets };
}

/** Normalize a header for fingerprint comparison. */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export interface LayoutFingerprint {
  layout_id: string;
  arquivo_pattern: string | null;
  sheet_pattern: string | null;
  colunas_obrigatorias: string[];
  peso: number;
}

export interface LayoutMatch {
  layout_id: string;
  sheet: string;
  score: number; // 0..1
  matchedColumns: string[];
  missingColumns: string[];
}

/** Score each fingerprint against parsed sheets, return ranked matches. */
export function detectLayout(
  parsed: ParsedFile,
  fingerprints: LayoutFingerprint[],
): LayoutMatch[] {
  const out: LayoutMatch[] = [];
  for (const sheet of parsed.sheets) {
    const normHeaders = new Set(sheet.headers.map(normalizeHeader));
    for (const fp of fingerprints) {
      // arquivo_pattern (regex case-insensitive)
      if (fp.arquivo_pattern) {
        try {
          if (!new RegExp(fp.arquivo_pattern, "i").test(parsed.fileName)) continue;
        } catch { /* ignore bad regex */ }
      }
      if (fp.sheet_pattern) {
        try {
          if (!new RegExp(fp.sheet_pattern, "i").test(sheet.sheetName)) continue;
        } catch { /* ignore */ }
      }
      const required = fp.colunas_obrigatorias.map(normalizeHeader);
      if (!required.length) continue;
      const matched = required.filter((c) => normHeaders.has(c));
      const missing = required.filter((c) => !normHeaders.has(c));
      const score = (matched.length / required.length) * (fp.peso || 1);
      if (matched.length > 0) {
        out.push({
          layout_id: fp.layout_id,
          sheet: sheet.sheetName,
          score: Math.min(1, score),
          matchedColumns: matched,
          missingColumns: missing,
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
