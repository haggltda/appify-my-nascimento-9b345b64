import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RawRow = { bloco: "ENTRADAS" | "SAIDAS_OP" | "SAIDAS_NAO_OP"; categoria: string; dia: string; valor: number; saldo_inicial: number };

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();

export default function ConciliacaoFluxoCaixa() {
  const [dataIni, setDataIni] = useState(isoDate(addDays(today, -14)));
  const [dataFim, setDataFim] = useState(isoDate(today));
  const [empresaId, setEmpresaId] = useState<string | undefined>();
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [tolerancia, setTolerancia] = useState(1);

  const empresasQ = useQuery({
    queryKey: ["empresas-conc"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, codigo, razao_social").eq("ativa", true).order("codigo");
      return (data ?? []) as Array<{ id: string; codigo: string; razao_social: string }>;
    },
  });

  useEffect(() => {
    if (!empresaId && empresasQ.data?.length) {
      const sel = empresasQ.data.find((e) => e.codigo === "HAGG") ?? empresasQ.data[0];
      setEmpresaId(sel.id);
      setEmpresaNome(`${sel.codigo} — ${sel.razao_social}`);
    }
  }, [empresasQ.data, empresaId]);

  useEffect(() => {
    const sel = empresasQ.data?.find((e) => e.id === empresaId);
    if (sel) setEmpresaNome(`${sel.codigo} — ${sel.razao_social}`);
  }, [empresaId, empresasQ.data]);

  const fluxoQ = useQuery({
    queryKey: ["fluxo-conc", empresaId, dataIni, dataFim],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fluxo_caixa_diario", {
        _empresa_id: empresaId, _data_ini: dataIni, _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as RawRow[];
    },
  });

  // Movimentos bancários (relatório de suporte)
  const bancosQ = useQuery({
    queryKey: ["mov-bancarios-conc", empresaId, dataIni, dataFim],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mz_30_movimentos_bancarios")
        .select("data_movimento, valor, tipo")
        .eq("empresa_id", empresaId)
        .gte("data_movimento", dataIni)
        .lte("data_movimento", dataFim);
      if (error) return [];
      return (data ?? []) as Array<{ data_movimento: string; valor: number; tipo: string }>;
    },
  });

  const dias = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(dataIni + "T00:00:00"); d <= new Date(dataFim + "T00:00:00"); d = addDays(d, 1)) out.push(isoDate(d));
    return out;
  }, [dataIni, dataFim]);

  const conciliacao = useMemo(() => {
    const fluxoDia: Record<string, number> = {};
    (fluxoQ.data ?? []).forEach((r) => {
      fluxoDia[r.dia] = (fluxoDia[r.dia] ?? 0) + Number(r.valor);
    });
    const bancoDia: Record<string, number> = {};
    (bancosQ.data ?? []).forEach((m) => {
      const v = m.tipo === "C" || m.tipo === "credito" ? Number(m.valor) : -Math.abs(Number(m.valor));
      bancoDia[m.data_movimento] = (bancoDia[m.data_movimento] ?? 0) + v;
    });
    return dias.map((d) => {
      const f = fluxoDia[d] ?? 0;
      const b = bancoDia[d] ?? 0;
      const dif = f - b;
      const status: "OK" | "Divergente" | "Sem suporte" =
        b === 0 && f !== 0 ? "Sem suporte" : Math.abs(dif) <= tolerancia ? "OK" : "Divergente";
      return { dia: d, label: new Date(d + "T00:00:00").toLocaleDateString("pt-BR"), fluxo: f, banco: b, diferenca: dif, status };
    });
  }, [dias, fluxoQ.data, bancosQ.data, tolerancia]);

  const totalFluxo = conciliacao.reduce((a, c) => a + c.fluxo, 0);
  const totalBanco = conciliacao.reduce((a, c) => a + c.banco, 0);
  const totalDiff = totalFluxo - totalBanco;
  const okCount = conciliacao.filter((c) => c.status === "OK").length;
  const divergCount = conciliacao.filter((c) => c.status === "Divergente").length;
  const semSupCount = conciliacao.filter((c) => c.status === "Sem suporte").length;

  const exportCsv = () => {
    const header = ["Data", "Fluxo de Caixa", "Banco (Suporte)", "Diferenca", "Status"];
    const rows = conciliacao.map((c) => [c.label, c.fluxo, c.banco, c.diferenca, c.status]);
    rows.push(["TOTAL", totalFluxo, totalBanco, totalDiff, ""]);
    const csv = [header, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `conciliacao-fluxo-${dataIni}_${dataFim}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Excel export (TSV salvo como .xls — abre direto no Excel)
  const exportExcel = () => {
    const header = ["Data", "Fluxo de Caixa", "Banco (Suporte)", "Diferenca", "Status"];
    const rows = conciliacao.map((c) => [c.label, c.fluxo, c.banco, c.diferenca, c.status]);
    rows.push(["TOTAL", totalFluxo, totalBanco, totalDiff, ""]);
    const html = `
      <html><head><meta charset="utf-8"></head><body>
      <table border="1">
        <thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `conciliacao-fluxo-${dataIni}_${dataFim}.xls`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text("Conciliação do Fluxo de Caixa", 40, 36);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text(empresaNome, 40, 52);
    pdf.text(`Período: ${new Date(dataIni + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`, 40, 66);
    pdf.text(`Tolerância: ${fmtBRL(tolerancia)} · OK: ${okCount} · Divergentes: ${divergCount} · Sem suporte: ${semSupCount}`, 40, 80);

    autoTable(pdf, {
      startY: 96, theme: "grid",
      head: [["Data", "Fluxo de Caixa", "Banco (Suporte)", "Diferença", "Status"]],
      body: [
        ...conciliacao.map((c) => [c.label, fmt(c.fluxo), fmt(c.banco), fmt(c.diferenca), c.status]),
        [{ content: "TOTAL", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: fmt(totalFluxo), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: fmt(totalBanco), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: fmt(totalDiff), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: "", styles: { fillColor: [241, 245, 249] } }],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center" } },
    });
    pdf.save(`conciliacao-fluxo-${dataIni}_${dataFim}.pdf`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Financeiro", "Fluxo de Caixa", "Conciliação"]}
        title="Conciliação do Fluxo de Caixa"
        subtitle="Compare diariamente o fluxo de caixa com os relatórios de suporte (movimentos bancários)."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> CSV</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
            <Button onClick={exportPdf}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <Label>Empresa</Label>
          <Select value={empresaId ?? ""} onValueChange={setEmpresaId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(empresasQ.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Data Inicial</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-44" /></div>
        <div><Label>Data Final</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-44" /></div>
        <div><Label>Tolerância (R$)</Label><Input type="number" value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value) || 0)} className="w-32" /></div>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <Kpi titulo="Fluxo Caixa (Total)" valor={totalFluxo} />
        <Kpi titulo="Banco / Suporte (Total)" valor={totalBanco} />
        <Kpi titulo="Diferença" valor={totalDiff} cor={Math.abs(totalDiff) <= tolerancia ? "text-emerald-600" : "text-destructive"} />
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
          <div className="mt-2 flex flex-col gap-1 text-xs">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> OK: <strong>{okCount}</strong></span>
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Divergente: <strong>{divergCount}</strong></span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" /> Sem suporte: <strong>{semSupCount}</strong></span>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cobertura</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{conciliacao.length ? `${Math.round((okCount / conciliacao.length) * 100)}%` : "—"}</p>
          <p className="text-[10px] text-muted-foreground">dias conciliados dentro da tolerância</p>
        </Card>
      </div>

      <Card className="overflow-auto">
        {fluxoQ.isLoading || bancosQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-right">Fluxo de Caixa</th>
                <th className="px-3 py-2 text-right">Banco / Suporte</th>
                <th className="px-3 py-2 text-right">Diferença</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {conciliacao.map((c) => {
                const cor = c.status === "OK" ? "default" : c.status === "Divergente" ? "destructive" : "secondary";
                return (
                  <tr key={c.dia} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">{c.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(c.fluxo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(c.banco)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${Math.abs(c.diferenca) <= tolerancia ? "" : "text-destructive"}`}>{fmt(c.diferenca)}</td>
                    <td className="px-3 py-2 text-center"><Badge variant={cor as any}>{c.status}</Badge></td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-bold border-t-2 border-border">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalFluxo)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalBanco)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalDiff)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Fluxo de Caixa: <code>fluxo_caixa_diario</code>. Suporte: <code>mz_30_movimentos_bancarios</code>. Diferenças acima da tolerância são marcadas como divergentes.
      </p>
    </div>
  );
}

function Kpi({ titulo, valor, cor = "" }: { titulo: string; valor: number; cor?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-lg font-bold ${cor}`}>{fmtBRL(valor)}</p>
    </Card>
  );
}
