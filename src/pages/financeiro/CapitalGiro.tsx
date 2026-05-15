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
import { Download, FileText, AlertTriangle, Info, TrendingDown, TrendingUp, Wallet, RefreshCw } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RawRow = { bloco: "ENTRADAS" | "SAIDAS_OP" | "SAIDAS_NAO_OP"; categoria: string; dia: string; valor: number; saldo_inicial: number };
type ProjRow = { bloco: "ENTRADAS" | "SAIDAS_OP" | "SAIDAS_NAO_OP"; categoria: string; dia: string; valor: number };

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date(); today.setHours(0, 0, 0, 0);
const todayIso = isoDate(today);

const FIN_RE = /(JURO|IOF|TARIF|FINANC|RENDIMENT|APLIC|BANC[AÁ]RI|EMPR[ÉE]STIM|D[ÉE]BITO\s+AUT)/i;
const ALL = "__all__";

type Hor = "15" | "30" | "45" | "90" | "180";

export default function CapitalGiro() {
  const [horizonte, setHorizonte] = useState<Hor>("30");
  const [empresaId, setEmpresaId] = useState<string>(ALL);
  const [empresaNome, setEmpresaNome] = useState<string>("Consolidado — Todas as empresas");
  const [saldoMinimo, setSaldoMinimo] = useState(500000);

  // Janela FUTURA: hoje até hoje + (h - 1)
  const dataIni = todayIso;
  const dataFim = isoDate(addDays(today, parseInt(horizonte) - 1));

  const empresasQ = useQuery({
    queryKey: ["empresas-cg"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, codigo, razao_social").eq("ativa", true).order("codigo");
      return (data ?? []) as Array<{ id: string; codigo: string; razao_social: string }>;
    },
  });

  useEffect(() => {
    if (empresaId === ALL) { setEmpresaNome("Consolidado — Todas as empresas"); return; }
    const sel = empresasQ.data?.find((e) => e.id === empresaId);
    if (sel) setEmpresaNome(`${sel.codigo} — ${sel.razao_social}`);
  }, [empresaId, empresasQ.data]);

  const empresaParam = empresaId === ALL ? null : empresaId;

  // Realizado (saldo inicial + movimentos passados/hoje)
  const realQ = useQuery({
    queryKey: ["fcd-real-cg", empresaParam, dataIni, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fluxo_caixa_diario", {
        _empresa_id: empresaParam, _data_ini: dataIni, _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as RawRow[];
    },
  });

  // Orçado/Projetado (mz_41) — entradas previstas + saídas previstas no horizonte
  const orcQ = useQuery({
    queryKey: ["fcd-orc-cg", empresaParam, dataIni, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fluxo_caixa_diario_orcado", {
        _empresa_id: empresaParam, _data_ini: dataIni, _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as ProjRow[];
    },
  });

  const dias = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(dataIni + "T00:00:00"); d <= new Date(dataFim + "T00:00:00"); d = addDays(d, 1)) out.push(isoDate(d));
    return out;
  }, [dataIni, dataFim]);

  const saldoInicialBase = realQ.data?.[0]?.saldo_inicial ?? 0;

  const projecao = useMemo(() => {
    const totDia: Record<string, { entradas: number; sop: number; fin: number; snop: number; previsto: boolean }> = {};
    dias.forEach((d) => (totDia[d] = { entradas: 0, sop: 0, fin: 0, snop: 0, previsto: d > todayIso }));

    // Realizado: aplica para dias <= hoje
    (realQ.data ?? []).forEach((r) => {
      if (!totDia[r.dia] || r.dia > todayIso) return;
      const isFin = FIN_RE.test(r.categoria);
      if (r.bloco === "ENTRADAS") totDia[r.dia].entradas += Number(r.valor);
      else if (r.bloco === "SAIDAS_OP") totDia[r.dia].sop += Number(r.valor);
      else if (isFin) totDia[r.dia].fin += Number(r.valor);
      else totDia[r.dia].snop += Number(r.valor);
    });
    // Orçado/Previsto: aplica para dias > hoje
    (orcQ.data ?? []).forEach((r) => {
      if (!totDia[r.dia] || r.dia <= todayIso) return;
      const isFin = FIN_RE.test(r.categoria);
      if (r.bloco === "ENTRADAS") totDia[r.dia].entradas += Number(r.valor);
      else if (r.bloco === "SAIDAS_OP") totDia[r.dia].sop += Number(r.valor);
      else if (isFin) totDia[r.dia].fin += Number(r.valor);
      else totDia[r.dia].snop += Number(r.valor);
    });

    let saldo = saldoInicialBase;
    return dias.map((d) => {
      const t = totDia[d];
      const saldoIni = saldo;
      const mov = t.entradas + t.sop + t.fin + t.snop;
      saldo = saldo + mov;
      const dt = new Date(d + "T00:00:00");
      const dd = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const necessidade = saldo < saldoMinimo ? saldoMinimo - saldo : 0;
      const status = saldo < 0 ? "Crítico" : saldo < saldoMinimo ? "Atenção" : "Saudável";
      return {
        dia: d, label: dd, saldoIni, previsto: t.previsto,
        entradas: t.entradas, saidasOp: t.sop, financeiras: t.fin, saidasNaoOp: t.snop,
        saldoFinal: saldo, necessidade, status,
      };
    });
  }, [dias, realQ.data, orcQ.data, saldoInicialBase, saldoMinimo]);

  const totalEntradas = projecao.reduce((a, c) => a + c.entradas, 0);
  const totalSOp = projecao.reduce((a, c) => a + c.saidasOp, 0);
  const totalFin = projecao.reduce((a, c) => a + c.financeiras, 0);
  const totalSNop = projecao.reduce((a, c) => a + c.saidasNaoOp, 0);
  const saldoFinal = projecao[projecao.length - 1]?.saldoFinal ?? saldoInicialBase;
  const saldoMin = projecao.reduce((m, c) => Math.min(m, c.saldoFinal), saldoInicialBase);
  const necessidadeMax = projecao.reduce((m, c) => Math.max(m, c.necessidade), 0);
  const temPrevisto = projecao.some((p) => p.previsto);
  const labelEntradas = temPrevisto ? "Entradas Previstas" : "Entradas Realizadas";

  const logs = useMemo(() => {
    const list: { tipo: "Crítico" | "Alerta" | "Informativo"; titulo: string; data?: string }[] = [];
    if (saldoMin < 0) {
      const d = projecao.find((p) => p.saldoFinal === saldoMin);
      list.push({ tipo: "Crítico", titulo: `Saldo projetado NEGATIVO de ${fmtBRL(saldoMin)}.`, data: d?.label });
    } else if (saldoMin < saldoMinimo) {
      const d = projecao.find((p) => p.saldoFinal === saldoMin);
      list.push({ tipo: "Alerta", titulo: `Saldo projetado de ${fmtBRL(saldoMin)} abaixo do mínimo (${fmtBRL(saldoMinimo)}).`, data: d?.label });
    }
    const concentSop = totalSOp !== 0 ? Math.abs(totalSOp) / Math.max(1, Math.abs(totalSOp) + Math.abs(totalSNop) + Math.abs(totalFin)) : 0;
    if (concentSop > 0.7) list.push({ tipo: "Alerta", titulo: `Saídas operacionais concentram ${(concentSop * 100).toFixed(0)}% do consumo projetado.` });
    if (totalEntradas + totalSOp + totalFin + totalSNop < 0) list.push({ tipo: "Alerta", titulo: "Resultado de caixa projetado negativo no período." });
    if (necessidadeMax > 0) list.push({ tipo: "Informativo", titulo: `Capital de giro mínimo sugerido: ${fmtBRL(necessidadeMax)}.` });
    if (!list.length) list.push({ tipo: "Informativo", titulo: "Projeção saudável: saldo permanece acima do mínimo em todos os dias." });
    return list;
  }, [projecao, saldoMin, saldoMinimo, totalSOp, totalSNop, totalFin, totalEntradas, necessidadeMax]);

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text("Análise de Capital de Giro", 40, 36);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text(empresaNome, 40, 52);
    pdf.text(`Período: ${new Date(dataIni + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}  ·  Próximos ${horizonte} dias`, 40, 66);

    autoTable(pdf, {
      startY: 80, theme: "grid",
      head: [["Data", "Tipo", "Saldo Inicial", labelEntradas, "Saídas Op.", "Financeiras", "Saídas Não Op.", "Necessidade", "Saldo Final", "Status"]],
      body: projecao.map((p) => [
        p.label, p.previsto ? "Previsto" : "Realizado",
        fmt(p.saldoIni), fmt(p.entradas), fmt(p.saidasOp), fmt(p.financeiras), fmt(p.saidasNaoOp), fmt(p.necessidade), fmt(p.saldoFinal), p.status,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    });
    pdf.save(`capital-giro-${dataIni}_${dataFim}.pdf`);
  };

  const exportCsv = () => {
    const header = ["Data", "Tipo", "Saldo Inicial", labelEntradas, "Saidas Op", "Financeiras", "Saidas Nao Op", "Necessidade", "Saldo Final", "Status"];
    const rows = projecao.map((p) => [p.label, p.previsto ? "Previsto" : "Realizado", p.saldoIni, p.entradas, p.saidasOp, p.financeiras, p.saidasNaoOp, p.necessidade, p.saldoFinal, p.status]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `capital-giro-${dataIni}_${dataFim}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string) => {
    if (s === "Crítico") return "bg-destructive/10 text-destructive border border-destructive/30";
    if (s === "Atenção") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30";
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Financeiro", "FP&A", "Análise de Capital de Giro"]}
        title="Análise de Capital de Giro"
        subtitle="Projeção de necessidade de caixa, compromissos futuros e impacto operacional / não operacional."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { realQ.refetch(); orcQ.refetch(); }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar análise
            </Button>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> CSV</Button>
            <Button onClick={exportPdf}><FileText className="mr-2 h-4 w-4" /> Exportar PDF</Button>
          </div>
        }
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-full sm:w-auto">
          <Label>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="w-full sm:w-[260px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Consolidado — Todas as empresas</SelectItem>
              {(empresasQ.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Label>Horizonte</Label>
          <div className="flex gap-1 flex-wrap">
            {(["15", "30", "45", "90", "180"] as Hor[]).map((h) => (
              <Button key={h} size="sm" variant={horizonte === h ? "default" : "outline"} onClick={() => setHorizonte(h)}>
                Próximos {h} dias
              </Button>
            ))}
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Label>Saldo Mínimo</Label>
          <Input type="number" value={saldoMinimo} onChange={(e) => setSaldoMinimo(Number(e.target.value) || 0)} className="w-full sm:w-44" />
        </div>
        <div className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
          {dias.length} dias · {temPrevisto ? "previsto (mz_41)" : "realizado (mz_40)"}
        </div>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<Wallet className="h-4 w-4" />} titulo="Saldo Inicial" valor={saldoInicialBase} cor="text-primary" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} titulo={labelEntradas} valor={totalEntradas} cor="text-emerald-600" />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} titulo="Saídas Operacionais" valor={totalSOp} cor="text-rose-600" />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} titulo="Saídas Não Operacionais" valor={totalSNop} cor="text-amber-600" />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} titulo="Necessidade CG" valor={necessidadeMax} cor="text-destructive" sub="Mínimo projetado" />
        <Kpi icon={<Wallet className="h-4 w-4" />} titulo="Saldo Final Projetado" valor={saldoFinal} cor={saldoFinal < 0 ? "text-destructive" : saldoFinal < saldoMinimo ? "text-amber-600" : "text-emerald-600"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold mb-2">Projeção de Caixa e Necessidade de Capital de Giro</h3>
          <div className="chart-h">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projecao} barCategoryGap="18%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => v.toLocaleString("pt-BR", { notation: "compact" })} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend />
                <ReferenceLine y={saldoMinimo} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Saldo mínimo", fontSize: 10, fill: "hsl(var(--destructive))" }} />
                <Bar dataKey="entradas" name={labelEntradas} fill="hsl(142 71% 45%)" maxBarSize={28} />
                <Bar dataKey="saidasOp" name="Saídas operacionais" fill="hsl(0 84% 60%)" maxBarSize={28} />
                <Bar dataKey="saidasNaoOp" name="Saídas não operacionais" fill="hsl(38 92% 50%)" maxBarSize={28} />
                <Line type="monotone" dataKey="saldoFinal" name="Saldo projetado" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Info className="h-4 w-4" /> Logs e Impactos da Análise</h3>
          <div className="space-y-2 max-h-[280px] overflow-auto">
            {logs.map((l, i) => {
              const cls = l.tipo === "Crítico" ? "border-destructive/40 bg-destructive/5"
                : l.tipo === "Alerta" ? "border-amber-500/40 bg-amber-500/5"
                : "border-emerald-500/30 bg-emerald-500/5";
              return (
                <div key={i} className={`rounded-md border p-2 text-xs ${cls}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{l.titulo}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{l.tipo}{l.data ? ` · ${l.data}` : ""}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t pt-3">
            <h4 className="text-xs font-semibold mb-2">Insights Automáticos</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Capital de giro mínimo sugerido: <strong>{fmtBRL(necessidadeMax)}</strong></li>
              <li>• Menor saldo projetado: <strong className={saldoMin < 0 ? "text-destructive" : saldoMin < saldoMinimo ? "text-amber-600" : "text-emerald-600"}>{fmtBRL(saldoMin)}</strong></li>
              <li>• Resultado líquido projetado: <strong>{fmtBRL(totalEntradas + totalSOp + totalFin + totalSNop)}</strong></li>
            </ul>
          </div>
        </Card>
      </div>

      <Card className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-center">Tipo</th>
              <th className="px-3 py-2 text-right">Saldo Inicial</th>
              <th className="px-3 py-2 text-right">{labelEntradas}</th>
              <th className="px-3 py-2 text-right">Saídas Op.</th>
              <th className="px-3 py-2 text-right">Financeiras</th>
              <th className="px-3 py-2 text-right">Não Op.</th>
              <th className="px-3 py-2 text-right">Necessidade / Folga</th>
              <th className="px-3 py-2 text-right">Saldo Final</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {projecao.map((p) => (
              <tr key={p.dia} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-2">{p.label}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.previsto ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {p.previsto ? "Previsto" : "Realizado"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(p.saldoIni)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmt(p.entradas)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-600">{fmt(p.saidasOp)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-600">{fmt(p.financeiras)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{fmt(p.saidasNaoOp)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${p.necessidade ? "text-destructive" : "text-emerald-600"}`}>
                  {p.necessidade ? `-${fmt(p.necessidade)}` : fmt(p.saldoFinal - saldoMinimo)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${p.saldoFinal < 0 ? "text-destructive" : p.saldoFinal < saldoMinimo ? "text-amber-600" : ""}`}>{fmt(p.saldoFinal)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Kpi({ titulo, valor, cor = "", sub, icon }: { titulo: string; valor: number; cor?: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{titulo}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={`mt-1 font-display text-lg font-bold ${cor}`}>{fmtBRL(valor)}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
