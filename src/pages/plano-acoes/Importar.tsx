import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { ForbiddenCard } from "./Lista";
import { useToast } from "@/hooks/use-toast";
import { PLANO_ACOES_SEED, PLANO_ACOES_SEED_TOTAL } from "@/data/planoAcoesSeed";
import { Upload, CheckCircle2, AlertTriangle, Database, FileSpreadsheet, X } from "lucide-react";

// ── Normalização de valores ────────────────────────────────────────────────────

function strip(s: unknown): string {
  return String(s ?? "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function normalizeStatus(raw: unknown): string {
  const v = strip(raw);
  if (!v) return "a_definir";
  if (v.includes("nao iniciada") || v === "nao iniciada") return "nao_iniciada";
  if (v.includes("em andamento") || v === "iniciada" || v === "em andamento") return "em_andamento";
  if (v.includes("aguardando")) return "aguardando_validacao";
  if (v === "atrasada") return "atrasada";
  if (v.includes("pendente") || v.includes("pend. evidencia")) return "concluida_pendente_evidencia";
  if (v.includes("conclu") || v === "finalizada" || v.includes("validada")) return "concluida_validada";
  if (v === "cancelada") return "cancelada";
  return "a_definir";
}

function normalizePrioridade(raw: unknown): string {
  const v = strip(raw);
  if (v === "emergencial") return "emergencial";
  if (v === "alta") return "alta";
  if (v === "media" || v === "medio") return "media";
  if (v === "baixa") return "baixa";
  return "nao_informada";
}

// ── Mapeamento de colunas do Excel ────────────────────────────────────────────
// Chave: texto normalizado do cabeçalho → campo interno

const HEADER_MAP: Record<string, string> = {
  "titulo":             "titulo",
  "problema":           "problema",
  "acao":               "acao",
  "comite":             "comite",
  "setor":              "area",
  "setores":            "area",
  "area":               "area",
  "status":             "_status",
  "prioridade":         "_prioridade",
  "responsavel":        "responsavel_nome_origem",
  "lider do comite":    "lider_comite_nome_origem",
  "lider comite":       "lider_comite_nome_origem",
  "comentarios":        "comentarios",
  "comentario":         "comentarios",
};

function mapHeaders(raw: unknown[]): Record<number, string> {
  const result: Record<number, string> = {};
  raw.forEach((cell, i) => {
    const key = strip(cell);
    if (HEADER_MAP[key]) result[i] = HEADER_MAP[key];
  });
  return result;
}

function rowToRecord(cells: unknown[], colMap: Record<number, string>): Record<string, any> | null {
  const record: Record<string, any> = {};
  Object.entries(colMap).forEach(([idx, field]) => {
    const val = String(cells[Number(idx)] ?? "").trim();
    if (field === "_status") record.status_normalizado = normalizeStatus(val);
    else if (field === "_prioridade") record.prioridade_normalizada = normalizePrioridade(val);
    else record[field] = val || null;
  });
  // Deve ter ao menos título, problema ou ação não vazio
  const hasContent = !!(record.titulo || record.problema || record.acao);
  return hasContent ? record : null;
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function PlanoAcoesImportar() {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;
  const { can, loading } = usePlanoAcaoPermissao();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Seed (carga hardcoded)
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);

  // Excel import
  const fileRef = useRef<HTMLInputElement>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; erros: number } | null>(null);

  const carregarBatches = async () => {
    if (!empresaId) return;
    const { data } = await supabase.from("plano_acao_import_batch")
      .select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(10);
    setBatches(data ?? []);
  };

  if (loading) return null;
  if (!can("importar")) return <ForbiddenCard />;

  // ── Seed ──────────────────────────────────────────────────────────────────

  const executarSeed = async () => {
    if (!empresaId) return;
    if (!confirm(`Executar carga inicial das ${PLANO_ACOES_SEED_TOTAL} ações? A operação é idempotente — reexecutar não duplica dados.`)) return;
    setRunning(true); setResult(null);
    try {
      const { data, error } = await supabase.rpc("plano_acao_seed_inicial", {
        _empresa: empresaId,
        _payload: PLANO_ACOES_SEED as any,
      });
      if (error) throw error;
      setResult(data);
      toast({ title: "Carga concluída", description: JSON.stringify(data) });
      qc.invalidateQueries({ queryKey: ["plano_acoes"] });
      carregarBatches();
    } catch (e: any) {
      toast({ title: "Erro na carga", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  // ── Excel parsing ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Procura a linha de cabeçalho (primeira linha com pelo menos 3 células preenchidas)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(5, matrix.length); i++) {
          const filled = matrix[i].filter(c => String(c ?? "").trim().length > 0).length;
          if (filled >= 3) { headerRowIdx = i; break; }
        }

        const headerRow = matrix[headerRowIdx] as unknown[];
        const colMap = mapHeaders(headerRow);

        if (Object.keys(colMap).length === 0) {
          toast({ title: "Colunas não reconhecidas", description: "Verifique se o arquivo tem as colunas esperadas.", variant: "destructive" });
          return;
        }

        const dataRows = matrix.slice(headerRowIdx + 1);
        const parsed: Record<string, any>[] = [];
        dataRows.forEach(row => {
          const rec = rowToRecord(row as unknown[], colMap);
          if (rec) parsed.push(rec);
        });

        // Preview: primeiras 5 linhas com os campos mapeados
        const mappedFields = [...new Set(Object.values(colMap))].filter(f => !f.startsWith("_"));
        const previewRows = parsed.slice(0, 5).map(r =>
          mappedFields.map(f => String(r[f] ?? r.status_normalizado ?? r.prioridade_normalizada ?? "—").slice(0, 60))
        );

        setPreview({ headers: mappedFields, rows: previewRows });
        setRecords(parsed);
      } catch (err: any) {
        toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearFile = () => {
    setXlsxFile(null);
    setPreview(null);
    setRecords([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const importarExcel = async () => {
    if (!empresaId || records.length === 0) return;
    setImporting(true);
    let ok = 0; let erros = 0;
    const BATCH = 50;
    const lastErrors: string[] = [];

    for (let i = 0; i < records.length; i += BATCH) {
      const chunk = records.slice(i, i + BATCH).map(r => {
        // Registros importados nunca têm anexo de evidência ainda — o trigger do banco
        // bloqueia INSERT com concluida_validada sem evidência, então rebaixamos.
        const status = r.status_normalizado ?? "a_definir";
        return {
          empresa_id: empresaId,
          origem: "importacao_excel",
          titulo:                   r.titulo ?? null,
          problema:                 r.problema ?? null,
          acao:                     r.acao ?? null,
          comite:                   r.comite ?? null,
          area:                     r.area ?? null,
          responsavel_nome_origem:  r.responsavel_nome_origem ?? null,
          lider_comite_nome_origem: r.lider_comite_nome_origem ?? null,
          comentarios:              r.comentarios ?? null,
          status_normalizado:       status === "concluida_validada" ? "concluida_pendente_evidencia" : status,
          prioridade_normalizada:   r.prioridade_normalizada ?? "nao_informada",
        };
      });

      const { error } = await supabase.from("plano_acao").insert(chunk);
      if (error) {
        erros += chunk.length;
        lastErrors.push(error.message);
      } else {
        ok += chunk.length;
      }
    }

    setImportResult({ ok, erros });
    if (ok > 0) qc.invalidateQueries({ queryKey: ["plano_acoes"] });
    toast({
      title: erros === 0 ? "Importação concluída" : erros === records.length ? "Falha na importação" : "Importação parcial",
      description: erros === 0
        ? `${ok} planos criados`
        : `${ok} criados · ${erros} com erro${lastErrors[0] ? `: ${lastErrors[0]}` : ""}`,
      variant: erros > 0 ? "destructive" : "default",
    });
    setImporting(false);
  };

  return (
    <div>
      <PageHeader
        title="Importação — Plano de Ações"
        subtitle="Carga via Excel ou importação do seed inicial"
        module="Plano de Ações"
        breadcrumb={["Importar"]}
        actions={<Button asChild variant="outline" size="sm"><Link to="/app/plano-acoes">← Lista</Link></Button>}
      />

      {/* ── Excel import ── */}
      <Card className="mb-4 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-emerald-500/10 p-3"><FileSpreadsheet className="h-6 w-6 text-emerald-600" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-bold">Importar por Excel</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione um arquivo <span className="font-mono">.xlsx</span> com as colunas:
              {" "}<span className="font-mono text-xs">titulo, problema, ação, comitê, setor, status, prioridade, responsável, líder do comitê, comentários</span>.
              Colunas extras são ignoradas automaticamente.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted transition-colors cursor-pointer">
                  <Upload className="h-4 w-4" /> Selecionar arquivo xlsx
                </span>
              </label>
              {xlsxFile && (
                <>
                  <span className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-mono">
                    {xlsxFile.name}
                    <button onClick={clearFile} className="ml-1 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                  </span>
                  <Badge variant="secondary">{records.length} registros detectados</Badge>
                </>
              )}
            </div>

            {/* Preview */}
            {preview && preview.rows.length > 0 && (
              <div className="mt-4 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-2 py-1 text-left font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {row.map((cell, j) => <td key={j} className="px-2 py-1 max-w-[200px] truncate" title={cell}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 5 && <p className="px-2 py-1 text-[11px] text-muted-foreground">… e mais {records.length - 5} registros</p>}
              </div>
            )}

            {/* Import button */}
            {records.length > 0 && !importResult && (
              <Button className="mt-3" onClick={importarExcel} disabled={importing}>
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importando…" : `Criar ${records.length} planos de ação`}
              </Button>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`mt-3 rounded-md border px-4 py-3 text-sm ${importResult.erros === 0 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {importResult.erros === 0
                    ? <><CheckCircle2 className="h-4 w-4" /> {importResult.ok} planos criados com sucesso</>
                    : <><AlertTriangle className="h-4 w-4" /> {importResult.ok} criados · {importResult.erros} com erro</>}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Seed inicial ── */}
      <Card className="mb-4 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-primary/10 p-3"><Database className="h-6 w-6 text-primary" /></div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Carga atualizada — {PLANO_ACOES_SEED_TOTAL} ações Nascimento</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Origem: <span className="font-mono">Gerenciamento de Tarefas - Nascimento - Tático 4.xlsx</span>.
              Reexecuções fazem upsert por <span className="font-mono">id_importacao</span>, atualizando status,
              datas, prioridades e responsáveis sem duplicar.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={executarSeed} disabled={running}>
                <Upload className="mr-2 h-4 w-4" />
                {running ? "Executando..." : `Executar carga (${PLANO_ACOES_SEED_TOTAL} ações)`}
              </Button>
              <Button variant="outline" onClick={carregarBatches}>Atualizar lotes</Button>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Reconciliação
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <Stat label="Recebidas"   value={result.recebidas} />
              <Stat label="Processadas" value={result.processadas} />
              <Stat label="Inseridas"   value={result.inseridas}   tone="success" />
              <Stat label="Atualizadas" value={result.atualizadas} />
              <Stat label="Pendentes"   value={result.pendentes}   tone="warning" />
            </div>
          </div>
        )}
      </Card>

      {/* ── Histórico de lotes ── */}
      <Card className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Últimos lotes (seed)</h3>
        {batches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum lote ainda carregado. Clique em <strong>Atualizar lotes</strong> ou execute a carga acima.
          </p>
        )}
        <div className="space-y-2">
          {batches.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
              <div>
                <p className="font-medium">{b.arquivo_nome ?? "Lote sem arquivo"}</p>
                <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Badge variant="secondary">{b.total_linhas} linhas</Badge>
                <Badge variant="outline">{b.total_importado} importadas</Badge>
                {b.total_pendente > 0 && <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400"><AlertTriangle className="mr-1 h-3 w-3" />{b.total_pendente} pendentes</Badge>}
                <Badge>{b.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: "success" | "warning" }) {
  const t = tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold ${t}`}>{value}</div>
    </div>
  );
}
