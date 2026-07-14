import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { definirFaixa } from "@/lib/faixaCobranca";
import { encontrarContrato, type ContratoCandidato, type TipoMatchContrato } from "@/lib/contratoMatch";

// Mesmo mapeamento de colunas (por posição, não por cabeçalho) usado no sistema antigo
// (main.py: usecols=[1,3,4,5,8,11,14,15] -> empresa,data,nota,competencia,cliente,situacao,valor,pagamento).
// A planilha do Financeiro não tem cabeçalho padronizado, então lemos por posição de coluna.
const COL = { empresa: 1, data: 3, nota: 4, competencia: 5, cliente: 8, situacao: 11, valor: 14, pagamento: 15 };
const LIMIAR_DIAS_EXIBICAO = 20;

const MESES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function excelParaData(valor: unknown): Date | null {
  if (valor instanceof Date) return valor;
  if (typeof valor === "number") {
    // Serial de data do Excel (dias desde 1899-12-30)
    return new Date(Math.round((valor - 25569) * 86400 * 1000));
  }
  if (typeof valor === "string" && valor.trim()) {
    const d = new Date(valor);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatarCompetencia(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const texto = String(valor).trim();
  if (!texto || texto.toLowerCase() === "nan") return "";
  const dt = excelParaData(valor);
  if (dt && (valor instanceof Date || typeof valor === "number")) {
    return `${MESES[dt.getMonth() + 1]}/${String(dt.getFullYear()).slice(-2)}`;
  }
  return texto;
}

function extrairValor(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const limpo = valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

interface LinhaImportada {
  empresaCodigo: string;
  clienteContrato: string;
  nota: string;
  competencia: string;
  dataReferencia: Date;
  valor: number;
  diasAtraso: number;
  faixa: string;
  empresaId: string | null;
  contratoId: string | null;
  tipoMatchContrato: TipoMatchContrato;
}

export default function ImportarRelatorioServicoCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivosNomes, setArquivosNomes] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<LinhaImportada[]>([]);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ total: number; semContrato: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;
    setArquivosNomes(arquivos.map((f) => f.name));
    setResultado(null);
    setProcessando(true);

    try {
      const { data: empresas } = await (supabase as any).from("empresas").select("id, codigo");
      const { data: contratos } = await (supabase as any).from("contrato").select("id, numero, orgao, empresa_id");
      const empresaPorCodigo = new Map<string, string>((empresas ?? []).map((e: any) => [e.codigo, e.id]));
      const todosContratos: ContratoCandidato[] = contratos ?? [];

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const linhasFinal: LinhaImportada[] = [];

      for (const arquivo of arquivos) {
        const buf = await arquivo.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const linhasBrutas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

        for (let i = 1; i < linhasBrutas.length; i++) {
          const row = linhasBrutas[i];
          if (!row || row.length === 0) continue;

          const situacao = String(row[COL.situacao] ?? "").trim().toUpperCase();
          if (situacao !== "NORMAL") continue;

          const pagamento = String(row[COL.pagamento] ?? "").trim();
          if (pagamento !== "" && pagamento !== "-") continue;

          const dataRef = excelParaData(row[COL.data]);
          if (!dataRef) continue;

          const diasAtraso = Math.floor((hoje.getTime() - dataRef.getTime()) / 86400000);
          if (diasAtraso < LIMIAR_DIAS_EXIBICAO) continue;

          const empresaCodigo = String(row[COL.empresa] ?? "").trim().toUpperCase();
          const clienteContrato = String(row[COL.cliente] ?? "").trim();
          const nota = String(row[COL.nota] ?? "").trim().replace(/\.0$/, "");
          if (!nota || !clienteContrato) continue;

          const empresaId = empresaPorCodigo.get(empresaCodigo) ?? null;
          const candidatos = empresaId ? todosContratos.filter((c) => c.empresa_id === empresaId) : todosContratos;
          const { match, tipo } = encontrarContrato(candidatos, clienteContrato);

          linhasFinal.push({
            empresaCodigo,
            clienteContrato,
            nota,
            competencia: formatarCompetencia(row[COL.competencia]),
            dataReferencia: dataRef,
            valor: extrairValor(row[COL.valor]),
            diasAtraso,
            faixa: definirFaixa(diasAtraso),
            empresaId,
            contratoId: match?.id ?? null,
            tipoMatchContrato: tipo,
          });
        }
      }

      setLinhas(linhasFinal);
    } catch (err: any) {
      toast.error("Erro ao ler planilha(s): " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  const limpar = () => {
    setArquivosNomes([]);
    setLinhas([]);
    setResultado(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const semContrato = linhas.filter((l) => !l.contratoId).length;

  const importar = async () => {
    if (linhas.length === 0) return;
    setImportando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: delError } = await (supabase as any).from("cobranca_relatorio_nota").delete().not("id", "is", null);
      if (delError) throw delError;

      const registros = linhas.map((l) => ({
        empresa_id: l.empresaId,
        empresa_codigo: l.empresaCodigo,
        contrato_id: l.contratoId,
        cliente_contrato: l.clienteContrato,
        nota: l.nota,
        competencia: l.competencia || null,
        data_referencia: l.dataReferencia.toISOString().slice(0, 10),
        valor: l.valor,
        dias_atraso: l.diasAtraso,
        faixa: l.faixa,
        importado_por: userData.user?.id ?? null,
      }));

      const { error: insError } = await (supabase as any).from("cobranca_relatorio_nota").insert(registros);
      if (insError) throw insError;

      setResultado({ total: registros.length, semContrato });
      toast.success(`${registros.length} nota(s) em aberto importada(s).`);
    } catch (err: any) {
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setImportando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" /> Importar Relatório de Serviços
        </CardTitle>
        <CardDescription>
          Planilha oficial do Financeiro (mesma fonte do sistema de cobranças antigo). Cada importação substitui
          por completo a lista de notas em aberto — pode selecionar os dois arquivos (ano atual e anterior) de
          uma vez. Só entram notas com situação NORMAL, sem pagamento registrado e com 20+ dias desde a
          data de referência.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="sr-only"
              onChange={handleFileChange}
            />
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted transition-colors cursor-pointer">
              <Upload className="h-4 w-4" /> Selecionar planilha(s)
            </span>
          </label>
          {arquivosNomes.map((nome) => (
            <span key={nome} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-mono">
              {nome}
            </span>
          ))}
          {arquivosNomes.length > 0 && (
            <button onClick={limpar} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {processando && <p className="text-sm text-muted-foreground">Lendo planilha(s)...</p>}

        {linhas.length > 0 && !processando && (
          <>
            <div className="flex items-center gap-2 mb-3 text-sm">
              <Badge variant="default">{linhas.length} nota(s) em aberto encontradas</Badge>
              {semContrato > 0 && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {semContrato} sem contrato casado
                </Badge>
              )}
            </div>

            <div className="max-h-80 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Empresa</th>
                    <th className="px-2 py-1 text-left">Cliente/Contrato</th>
                    <th className="px-2 py-1 text-left">Nota</th>
                    <th className="px-2 py-1 text-left">Dias</th>
                    <th className="px-2 py-1 text-left">Faixa</th>
                    <th className="px-2 py-1 text-left">Contrato ERP</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{l.empresaCodigo}</td>
                      <td className="px-2 py-1 max-w-[220px] truncate" title={l.clienteContrato}>{l.clienteContrato}</td>
                      <td className="px-2 py-1">{l.nota}</td>
                      <td className="px-2 py-1">{l.diasAtraso}</td>
                      <td className="px-2 py-1">{l.faixa}</td>
                      <td className="px-2 py-1">
                        {l.tipoMatchContrato === "sem_match" ? (
                          <Badge variant="outline" className="text-[10px] text-amber-700">sem match</Badge>
                        ) : (
                          <Badge variant={l.tipoMatchContrato === "exato" ? "default" : "secondary"} className="text-[10px]">
                            {l.tipoMatchContrato === "exato" ? "exato" : "nº único"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!resultado ? (
              <Button className="mt-3" onClick={importar} disabled={importando}>
                <Upload className="mr-2 h-4 w-4" />
                {importando ? "Importando..." : `Substituir lista atual por essas ${linhas.length} nota(s)`}
              </Button>
            ) : (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  {resultado.total} nota(s) importada(s){resultado.semContrato > 0 ? `, ${resultado.semContrato} sem contrato casado` : ""}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
