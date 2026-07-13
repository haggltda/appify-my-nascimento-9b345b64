import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Colaborador } from "./ColaboradorForm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: Colaborador[];
}

type ColKey =
  | "nome" | "cpf" | "matricula" | "cargo" | "departamento"
  | "data_admissao" | "salario_base" | "status" | "email" | "telefone";

const COLUNAS: { key: ColKey; label: string; width?: number; align?: "left" | "right" | "center" }[] = [
  { key: "nome",          label: "Nome", width: 50 },
  { key: "cpf",           label: "CPF", width: 28 },
  { key: "matricula",     label: "Matrícula", width: 22 },
  { key: "cargo",         label: "Cargo", width: 35 },
  { key: "departamento",  label: "Departamento", width: 32 },
  { key: "data_admissao", label: "Admissão", width: 22 },
  { key: "salario_base",  label: "Salário", width: 24, align: "right" },
  { key: "status",        label: "Status", width: 18 },
  { key: "email",         label: "E-mail", width: 45 },
  { key: "telefone",      label: "Telefone", width: 28 },
];

const fmtBRL = (v: any) =>
  v == null || v === "" ? "-" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "-");

export function RelatorioColaboradoresDialog({ open, onOpenChange, rows }: Props) {
  const [status, setStatus] = useState<"todos" | "ativo" | "inativo" | "afastado">("todos");
  const [departamento, setDepartamento] = useState<string>("__all");
  const [cargo, setCargo] = useState<string>("__all");
  const [busca, setBusca] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [colunas, setColunas] = useState<Record<ColKey, boolean>>({
    nome: true, cpf: true, matricula: true, cargo: true, departamento: true,
    data_admissao: true, salario_base: true, status: true, email: false, telefone: false,
  });

  const departamentos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.departamento).filter(Boolean))).sort() as string[],
    [rows],
  );
  const cargos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.cargo).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      if (departamento !== "__all" && r.departamento !== departamento) return false;
      if (cargo !== "__all" && r.cargo !== cargo) return false;
      if (q && !`${r.nome ?? ""} ${r.cpf ?? ""} ${r.matricula ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, departamento, cargo, busca]);

  const totalSalarios = useMemo(
    () => filtered.reduce((acc, r) => acc + Number(r.salario_base ?? 0), 0),
    [filtered],
  );

  const toggleCol = (k: ColKey) => setColunas((c) => ({ ...c, [k]: !c[k] }));
  const colsAtivas = COLUNAS.filter((c) => colunas[c.key]);

  const generate = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum colaborador no filtro selecionado.");
      return;
    }
    if (colsAtivas.length === 0) {
      toast.error("Selecione pelo menos uma coluna.");
      return;
    }

    const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Colaboradores", 14, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const filtros: string[] = [];
    if (status !== "todos") filtros.push(`Status: ${status}`);
    if (departamento !== "__all") filtros.push(`Depto: ${departamento}`);
    if (cargo !== "__all") filtros.push(`Cargo: ${cargo}`);
    if (busca) filtros.push(`Busca: "${busca}"`);
    const filtrosStr = filtros.length ? filtros.join(" • ") : "Todos os registros";
    doc.text(filtrosStr, 14, 20);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} • ${filtered.length} colaborador(es)`,
      14, 25,
    );

    // Tabela
    autoTable(doc, {
      startY: 30,
      head: [colsAtivas.map((c) => c.label)],
      body: filtered.map((r) =>
        colsAtivas.map((c) => {
          const v = (r as any)[c.key];
          if (c.key === "salario_base") return fmtBRL(v);
          if (c.key === "data_admissao") return fmtDate(v);
          return v ?? "-";
        }),
      ),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(
        colsAtivas.map((c, i) => [i, { cellWidth: c.width, halign: c.align ?? "left" }]),
      ),
      margin: { left: 8, right: 8 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        const str = `Página ${data.pageNumber} de ${pageCount}`;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
      },
    });

    // Totais
    if (colunas.salario_base) {
      const finalY = (doc as any).lastAutoTable.finalY ?? 30;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(`Folha total (filtro): ${fmtBRL(totalSalarios)}`, 14, finalY + 8);
    }

    const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    doc.save(`colaboradores-${ts}.pdf`);
    toast.success(`PDF gerado com ${filtered.length} colaborador(es).`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar relatório PDF</DialogTitle>
          <DialogDescription>Selecione os filtros e as colunas que devem aparecer no relatório.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Departamento</Label>
              <Select value={departamento} onValueChange={setDepartamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {departamentos.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cargo</Label>
              <Select value={cargo} onValueChange={setCargo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Buscar (nome, CPF, matrícula)</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label className="text-xs">Orientação</Label>
              <Select value={orientation} onValueChange={(v) => setOrientation(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Paisagem</SelectItem>
                  <SelectItem value="portrait">Retrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs">Colunas do relatório</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {COLUNAS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={colunas[c.key]} onCheckedChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded border bg-muted/30 p-2 text-xs">
            <p>{filtered.length} colaborador(es) atendem ao filtro.</p>
            {colunas.salario_base && (
              <p>Folha total no filtro: <span className="font-semibold">{fmtBRL(totalSalarios)}</span></p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={generate}>
            <FileDown className="mr-2 h-4 w-4" /> Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
