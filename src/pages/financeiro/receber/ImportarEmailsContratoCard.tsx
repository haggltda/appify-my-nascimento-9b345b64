import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

// Mesma lógica de normalização/casamento já validada no sistema de cobranças antigo
// (main.py: normalizar_contrato) - só arrisca um "match" automático quando o número
// final do contrato bate com um único candidato; o resto fica pra revisão manual.

function normalizar(txt: unknown): string {
  return String(txt ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function numeroFinal(txtNormalizado: string): string {
  const m = txtNormalizado.match(/(\d+)$/);
  return m ? m[1] : "";
}

const PADRAO_EMAIL = /[\w.\-+]+@[\w.\-]+\.\w+/g;

type LinhaPlanilha = { empresa: string; contrato: string; emails: string[] };
type LinhaResultado = LinhaPlanilha & {
  contratoId: string | null;
  contratoEncontrado: string | null;
  tipoMatch: "exato" | "numero_unico" | "sem_match";
};

export default function ImportarEmailsContratoCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [resultados, setResultados] = useState<LinhaResultado[]>([]);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; erros: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoNome(file.name);
    setImportResult(null);
    setProcessando(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const linhas: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const planilha: LinhaPlanilha[] = linhas
          .map((row) => {
            const empresa = String(row.EMPRESA ?? row.empresa ?? "").trim().toUpperCase();
            const contrato = String(row.CONTRATO ?? row.contrato ?? "").trim();
            const emailTexto = String(row.EMAIL ?? row.email ?? "");
            const emails = Array.from(emailTexto.matchAll(PADRAO_EMAIL)).map((m) => m[0]);
            return { empresa, contrato, emails };
          })
          .filter((l) => l.contrato);

        // Busca todas as empresas e contratos de uma vez pra casar em memória
        const { data: empresas } = await (supabase as any).from("empresas").select("id, codigo");
        const { data: contratos } = await (supabase as any).from("contrato").select("id, numero, orgao, empresa_id");

        const empresaPorCodigo = new Map((empresas ?? []).map((e: any) => [e.codigo, e.id]));

        const resultado: LinhaResultado[] = planilha.map((linha) => {
          const empresaId = empresaPorCodigo.get(linha.empresa);
          const candidatos = (contratos ?? []).filter((c: any) => !empresaId || c.empresa_id === empresaId);

          const chaveAlvo = normalizar(linha.contrato);
          let match = candidatos.find((c: any) => normalizar(`${c.orgao ?? ""}${c.numero ?? ""}`) === chaveAlvo);
          let tipoMatch: LinhaResultado["tipoMatch"] = match ? "exato" : "sem_match";

          if (!match) {
            const numAlvo = numeroFinal(chaveAlvo);
            if (numAlvo) {
              const mesmoNumero = candidatos.filter((c: any) => numeroFinal(normalizar(c.numero)) === numAlvo);
              if (mesmoNumero.length === 1) {
                match = mesmoNumero[0];
                tipoMatch = "numero_unico";
              }
            }
          }

          return {
            ...linha,
            contratoId: match?.id ?? null,
            contratoEncontrado: match ? `${match.orgao ?? ""} ${match.numero ?? ""}`.trim() : null,
            tipoMatch,
          };
        });

        setResultados(resultado);
      } catch (err: any) {
        toast.error("Erro ao ler arquivo: " + err.message);
      } finally {
        setProcessando(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const limpar = () => {
    setArquivoNome(null);
    setResultados([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const linhasComMatch = resultados.filter((r) => r.contratoId);
  const totalEmails = linhasComMatch.reduce((acc, r) => acc + r.emails.length, 0);

  const importar = async () => {
    if (linhasComMatch.length === 0) return;
    setImportando(true);
    let ok = 0;
    let erros = 0;

    for (const linha of linhasComMatch) {
      for (const email of linha.emails) {
        const { error } = await (supabase as any)
          .from("contrato_email_cobranca")
          .insert({ contrato_id: linha.contratoId, email });
        if (error) erros++;
        else ok++;
      }
    }

    setImportResult({ ok, erros });
    toast[erros === 0 ? "success" : "warning"](
      erros === 0 ? `${ok} e-mail(s) importado(s) com sucesso!` : `${ok} importados, ${erros} com erro.`,
    );
    setImportando(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" /> Importar e-mails dos tomadores
        </CardTitle>
        <CardDescription>
          Planilha com colunas EMPRESA, CONTRATO e EMAIL (mesma fonte usada no sistema de cobranças antigo).
          Cada linha vira o(s) e-mail(s) padrão do contrato correspondente - só confirma automaticamente
          quando o casamento é exato ou o número do contrato bate com um único candidato; o resto fica marcado
          pra revisão manual, nada é importado sem você conferir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="cursor-pointer">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleFileChange} />
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted transition-colors cursor-pointer">
              <Upload className="h-4 w-4" /> Selecionar planilha
            </span>
          </label>
          {arquivoNome && (
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-mono">
              {arquivoNome}
              <button onClick={limpar} className="ml-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {processando && <p className="text-sm text-muted-foreground">Lendo planilha...</p>}

        {resultados.length > 0 && !processando && (
          <>
            <div className="flex items-center gap-2 mb-3 text-sm">
              <Badge variant="default">{linhasComMatch.length} contrato(s) identificado(s)</Badge>
              <Badge variant="secondary">{totalEmails} e-mail(s) no total</Badge>
              {resultados.length - linhasComMatch.length > 0 && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {resultados.length - linhasComMatch.length} sem match
                </Badge>
              )}
            </div>

            <div className="max-h-80 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Planilha</th>
                    <th className="px-2 py-1 text-left">Contrato no ERP</th>
                    <th className="px-2 py-1 text-left">E-mails</th>
                    <th className="px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{r.contrato}</td>
                      <td className="px-2 py-1">{r.contratoEncontrado ?? "-"}</td>
                      <td className="px-2 py-1 max-w-[220px] truncate" title={r.emails.join(", ")}>{r.emails.join(", ") || "-"}</td>
                      <td className="px-2 py-1">
                        {r.tipoMatch === "exato" && <Badge variant="default" className="text-[10px]">exato</Badge>}
                        {r.tipoMatch === "numero_unico" && <Badge variant="secondary" className="text-[10px]">nº único</Badge>}
                        {r.tipoMatch === "sem_match" && <Badge variant="outline" className="text-[10px] text-amber-700">sem match</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!importResult ? (
              <Button className="mt-3" onClick={importar} disabled={importando || linhasComMatch.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                {importando ? "Importando..." : `Importar ${totalEmails} e-mail(s) de ${linhasComMatch.length} contrato(s)`}
              </Button>
            ) : (
              <div className={`mt-3 rounded-md border px-4 py-3 text-sm ${importResult.erros === 0 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {importResult.erros === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {importResult.ok} e-mail(s) importado(s){importResult.erros > 0 ? `, ${importResult.erros} com erro` : ""}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
