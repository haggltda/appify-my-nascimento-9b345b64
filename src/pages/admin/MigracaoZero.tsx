import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Play, RefreshCw, PlayCircle, CheckCircle2, AlertTriangle, Clock, FolderUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type Status = {
  id: string;
  arquivo: string;
  tabela: string;
  storage_path: string | null;
  uploaded_at: string | null;
  linhas_esperadas: number;
  linhas_carregadas: number;
  status: string;
  ultimo_erro: string | null;
  migration_batch_id: string | null;
};

const SUPABASE_URL = "https://fwmzeaztjxrxxzxzxmgc.supabase.co";
const LARGE_UPLOAD_LIMIT = 45 * 1024 * 1024;

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  ENVIADO: "bg-blue-500/10 text-blue-600 border-blue-300",
  EM_ANDAMENTO: "bg-amber-500/10 text-amber-600 border-amber-300",
  OK: "bg-emerald-500/10 text-emerald-600 border-emerald-300",
  ERRO: "bg-destructive/10 text-destructive border-destructive/40",
};

export default function MigracaoZero() {
  const [rows, setRows] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [globalRunning, setGlobalRunning] = useState(false);
  const cancelRef = useRef(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("mz_status").select("*").order("arquivo");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Status[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function uploadLargeFile(path: string, file: File, arquivo: string) {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) throw sessionErr;
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente para enviar arquivos grandes.");

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          authorization: `Bearer ${token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXplYXp0anhyeHh6eHp4bWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDc0NTAsImV4cCI6MjA5MjE4MzQ1MH0.i08oF2-9N6w-CxDVy8ink29-ydHTJEc-eQBZDYRxGwI",
          "x-upsert": "true",
        },
        metadata: {
          bucketName: "migracao-zero",
          objectName: path,
          contentType: file.type || "text/csv",
          cacheControl: "3600",
        },
        onError: reject,
        onProgress: (sent, total) => {
          setUploadProgress((p) => ({ ...p, [arquivo]: Math.round((sent / total) * 100) }));
        },
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  }

  async function uploadFile(arquivo: string, file: File) {
    setBusy((b) => ({ ...b, [arquivo]: true }));
    try {
      const path = `csv/${arquivo}`;
      setUploadProgress((p) => ({ ...p, [arquivo]: 0 }));
      if (file.size >= LARGE_UPLOAD_LIMIT) {
        await uploadLargeFile(path, file, arquivo);
      } else {
        const { error: upErr } = await supabase.storage
          .from("migracao-zero").upload(path, file, { upsert: true, contentType: "text/csv" });
        if (upErr) throw upErr;
      }
      const { error: stErr } = await supabase.from("mz_status").update({
        storage_path: path,
        uploaded_at: new Date().toISOString(),
        status: "ENVIADO",
        linhas_carregadas: 0,
        ultimo_erro: null,
        updated_at: new Date().toISOString(),
      }).eq("arquivo", arquivo);
      if (stErr) throw stErr;
      toast.success(`${arquivo}: enviado (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      await load();
    } catch (e) {
      toast.error(`${arquivo}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy((b) => ({ ...b, [arquivo]: false }));
      setUploadProgress((p) => {
        const next = { ...p };
        delete next[arquivo];
        return next;
      });
    }
  }

  async function processFile(arquivo: string): Promise<boolean> {
    const batchId = crypto.randomUUID();
    let offset = 0;
    let safety = 10000;
    while (safety-- > 0) {
      if (cancelRef.current) return false;
      const { data, error } = await supabase.functions.invoke("mz-load", {
        body: { arquivo, batch_id: batchId, offset },
      });
      if (error) {
        toast.error(`${arquivo}: ${error.message}`);
        return false;
      }
      if (!data?.ok) {
        toast.error(`${arquivo}: ${data?.error ?? "erro desconhecido"}`);
        await load();
        return false;
      }
      offset = data.next_offset;
      await load();
      if (data.finalizou) {
        toast.success(`${arquivo}: ${data.linhas_carregadas_acumulado} linhas carregadas`);
        return true;
      }
    }
    return false;
  }

  async function processOne(arquivo: string) {
    setBusy((b) => ({ ...b, [arquivo]: true }));
    try { await processFile(arquivo); } finally {
      setBusy((b) => ({ ...b, [arquivo]: false }));
    }
  }

  async function processAll() {
    cancelRef.current = false;
    setGlobalRunning(true);
    try {
      const ready = rows.filter((r) => r.storage_path && r.status !== "OK");
      for (const r of ready) {
        if (cancelRef.current) break;
        setBusy((b) => ({ ...b, [r.arquivo]: true }));
        await processFile(r.arquivo);
        setBusy((b) => ({ ...b, [r.arquivo]: false }));
      }
      toast.success("Processamento finalizado.");
    } finally {
      setGlobalRunning(false);
    }
  }

  async function uploadBatch(files: FileList) {
    const known = new Set(rows.map((r) => r.arquivo));
    const matched: File[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(files)) {
      if (known.has(f.name)) matched.push(f);
      else skipped.push(f.name);
    }
    if (skipped.length) toast.message(`Ignorados (${skipped.length}): não constam em mz_status`, { description: skipped.slice(0, 5).join(", ") + (skipped.length > 5 ? "…" : "") });
    if (!matched.length) { toast.error("Nenhum arquivo casou com as 32 linhas."); return; }
    toast.success(`Iniciando upload de ${matched.length} arquivos…`);
    for (const f of matched) {
      // sequencial para evitar saturar rede / Storage
      // eslint-disable-next-line no-await-in-loop
      await uploadFile(f.name, f);
    }
    toast.success(`Upload em lote concluído: ${matched.length} arquivos.`);
  }
  const totalEsperado = rows.reduce((a, r) => a + r.linhas_esperadas, 0);
  const totalCarregado = rows.reduce((a, r) => a + r.linhas_carregadas, 0);
  const pctGlobal = totalEsperado ? Math.min(100, Math.round((totalCarregado / totalEsperado) * 100)) : 0;
  const okCount = rows.filter((r) => r.status === "OK").length;
  const errCount = rows.filter((r) => r.status === "ERRO").length;
  const enviados = rows.filter((r) => r.storage_path).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migração DO ZERO"
        subtitle="Carga linha-a-linha dos 32 arquivos CSV do pacote oficial. Não destrói nada existente — popula tabelas mz_*."
        module="Administração"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progresso geral</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) uploadBatch(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button asChild variant="secondary" size="sm">
                  <span><FolderUp className="h-4 w-4 mr-2" /> Upload em lote</span>
                </Button>
              </label>
              <Button onClick={processAll} disabled={globalRunning || enviados === 0}>
                <PlayCircle className="h-4 w-4 mr-2" />
                {globalRunning ? "Processando…" : "Processar todos"}
              </Button>
              {globalRunning && (
                <Button variant="destructive" size="sm" onClick={() => (cancelRef.current = true)}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Stat label="Arquivos" value={`${rows.length}`} />
            <Stat label="Enviados" value={`${enviados}`} />
            <Stat label="OK" value={`${okCount}`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
            <Stat label="Com erro" value={`${errCount}`} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
            <Stat label="Linhas" value={`${totalCarregado.toLocaleString()} / ${totalEsperado.toLocaleString()}`} />
          </div>
          <Progress value={pctGlobal} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Arquivos do pacote (ordem de carga)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2">Arquivo</th>
                <th className="text-left">Tabela destino</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Carregado</th>
                <th className="text-left">Status</th>
                <th className="text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.linhas_esperadas ? Math.min(100, Math.round((r.linhas_carregadas / r.linhas_esperadas) * 100)) : 0;
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-mono text-xs">{r.arquivo}</td>
                    <td className="font-mono text-xs text-muted-foreground">{r.tabela}</td>
                    <td className="text-right">{r.linhas_esperadas.toLocaleString()}</td>
                    <td className="text-right">
                      <div>{r.linhas_carregadas.toLocaleString()}</div>
                      <div className="w-24 ml-auto"><Progress value={pct} className="h-1" /></div>
                    </td>
                    <td>
                      <Badge variant="outline" className={STATUS_COLORS[r.status] ?? ""}>
                        {r.status === "EM_ANDAMENTO" && <Clock className="h-3 w-3 mr-1" />}
                        {r.status}
                      </Badge>
                      {r.ultimo_erro && (
                        <div className="text-xs text-destructive mt-1 max-w-xs truncate" title={r.ultimo_erro}>
                          {r.ultimo_erro}
                        </div>
                      )}
                    </td>
                    <td className="space-x-2 whitespace-nowrap py-2">
                      <label className="inline-flex">
                        <Input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          disabled={!!busy[r.arquivo]}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadFile(r.arquivo, f);
                            e.target.value = "";
                          }}
                        />
                        <Button asChild size="sm" variant="outline" disabled={!!busy[r.arquivo]}>
                          <span><Upload className="h-3.5 w-3.5 mr-1" /> Upload</span>
                        </Button>
                      </label>
                      <Button
                        size="sm"
                        onClick={() => processOne(r.arquivo)}
                        disabled={!r.storage_path || !!busy[r.arquivo] || globalRunning}
                      >
                        <Play className="h-3.5 w-3.5 mr-1" /> Processar
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum arquivo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 bg-card">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
