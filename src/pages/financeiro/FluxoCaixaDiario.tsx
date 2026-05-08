import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type BlocoKey = "ENTRADAS" | "SAIDAS_OP" | "FINANCEIRAS" | "SAIDAS_NAO_OP";
type RawRow = { bloco: "ENTRADAS" | "SAIDAS_OP" | "SAIDAS_NAO_OP"; categoria: string; dia: string; valor: number; saldo_inicial: number };
type OrcRow = { bloco: "ENTRADAS" | "SAIDAS_OP" | "SAIDAS_NAO_OP"; categoria: string; dia: string; valor: number };
type Visao = "realizado" | "comparativo";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dow = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const BLOCO_LABEL: Record<BlocoKey, string> = {
  ENTRADAS: "ENTRADAS",
  SAIDAS_OP: "SAÍDAS OPERACIONAIS",
  FINANCEIRAS: "DESPESAS / RECEITAS FINANCEIRAS",
  SAIDAS_NAO_OP: "SAÍDAS NÃO OPERACIONAIS",
};

// Cores suaves alinhadas ao layout — fundo claro + borda lateral colorida
const BLOCO_HEADER_CLS: Record<BlocoKey, string> = {
  ENTRADAS: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-l-4 border-emerald-500",
  SAIDAS_OP: "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-l-4 border-rose-500",
  FINANCEIRAS: "bg-violet-50 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200 border-l-4 border-violet-500",
  SAIDAS_NAO_OP: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-l-4 border-amber-500",
};

const BLOCO_PDF_RGB: Record<BlocoKey, [number, number, number]> = {
  ENTRADAS: [209, 250, 229],
  SAIDAS_OP: [254, 226, 226],
  FINANCEIRAS: [237, 233, 254],
  SAIDAS_NAO_OP: [254, 243, 199],
};

// Reclassifica categorias do bloco SAIDAS_NAO_OP em "Financeiras" quando casam com palavras-chave
const FIN_RE = /(JURO|IOF|TARIF|FINANC|RENDIMENT|APLIC|BANC[AÁ]RI|EMPR[ÉE]STIM|CR[ÉE]DITO|D[ÉE]BITO\s+AUT)/i;
const reclassify = (bloco: RawRow["bloco"], categoria: string): BlocoKey => {
  if (bloco === "SAIDAS_NAO_OP" && FIN_RE.test(categoria)) return "FINANCEIRAS";
  if (bloco === "ENTRADAS" && FIN_RE.test(categoria)) return "FINANCEIRAS";
  return bloco as BlocoKey;
};

const today = new Date();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function FluxoCaixaDiario() {
  const [dataIni, setDataIni] = useState(isoDate(addDays(today, -14)));
  const [dataFim, setDataFim] = useState(isoDate(today));
  const [empresaId, setEmpresaId] = useState<string | undefined>();
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [visao, setVisao] = useState<Visao>("realizado");

  const empresasQ = useQuery({
    queryKey: ["empresas-fcd"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("empresas").select("id, codigo, razao_social").eq("ativa", true).order("codigo");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; codigo: string; razao_social: string }>;
    },
  });

  useEffect(() => {
    if (!empresaId && empresasQ.data?.length) {
      const hagg = empresasQ.data.find((e) => e.codigo === "HAGG");
      const sel = hagg ?? empresasQ.data[0];
      setEmpresaId(sel.id);
      setEmpresaNome(`${sel.codigo} — ${sel.razao_social}`);
    }
  }, [empresasQ.data, empresaId]);

  useEffect(() => {
    const sel = empresasQ.data?.find((e) => e.id === empresaId);
    if (sel) setEmpresaNome(`${sel.codigo} — ${sel.razao_social}`);
  }, [empresaId, empresasQ.data]);

  const dadosQ = useQuery({
    queryKey: ["fluxo_caixa_diario", empresaId, dataIni, dataFim],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fluxo_caixa_diario", {
        _empresa_id: empresaId,
        _data_ini: dataIni,
        _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as RawRow[];
    },
  });

  const orcQ = useQuery({
    queryKey: ["fluxo_caixa_diario_orcado", empresaId, dataIni, dataFim],
    enabled: !!empresaId && visao === "comparativo",
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fluxo_caixa_diario_orcado", {
        _empresa_id: empresaId, _data_ini: dataIni, _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as OrcRow[];
    },
  });

  const dias = useMemo(() => {
    const out: string[] = [];
    const a = new Date(dataIni + "T00:00:00");
    const b = new Date(dataFim + "T00:00:00");
    for (let d = new Date(a); d <= b; d = addDays(d, 1)) out.push(isoDate(d));
    return out;
  }, [dataIni, dataFim]);

  const saldoInicialBase = dadosQ.data?.[0]?.saldo_inicial ?? 0;

  const grid = useMemo(() => {
    const blocos: Record<BlocoKey, Map<string, Record<string, number>>> = {
      ENTRADAS: new Map(),
      SAIDAS_OP: new Map(),
      FINANCEIRAS: new Map(),
      SAIDAS_NAO_OP: new Map(),
    };
    (dadosQ.data ?? []).forEach((r) => {
      const b = reclassify(r.bloco, r.categoria);
      const m = blocos[b];
      if (!m) return;
      if (!m.has(r.categoria)) m.set(r.categoria, {});
      m.get(r.categoria)![r.dia] = (m.get(r.categoria)![r.dia] ?? 0) + Number(r.valor);
    });
    return blocos;
  }, [dadosQ.data]);

  const totaisBloco = (b: BlocoKey) => {
    const totDia: Record<string, number> = {};
    let total = 0;
    grid[b].forEach((cat) => {
      Object.entries(cat).forEach(([d, v]) => {
        totDia[d] = (totDia[d] ?? 0) + v;
        total += v;
      });
    });
    return { totDia, total };
  };

  const tEntradas = totaisBloco("ENTRADAS");
  const tSOp = totaisBloco("SAIDAS_OP");
  const tFin = totaisBloco("FINANCEIRAS");
  const tSNop = totaisBloco("SAIDAS_NAO_OP");

  const movimentoDia = (d: string) =>
    (tEntradas.totDia[d] ?? 0) + (tSOp.totDia[d] ?? 0) + (tFin.totDia[d] ?? 0) + (tSNop.totDia[d] ?? 0);

  const saldosIniciaisDia = useMemo(() => {
    const out: Record<string, number> = {};
    let acc = saldoInicialBase;
    for (const d of dias) {
      out[d] = acc;
      acc = acc + movimentoDia(d);
    }
    return out;
  }, [dias, saldoInicialBase, tEntradas, tSOp, tFin, tSNop]);

  const saldoTotalPeriodo = tEntradas.total + tSOp.total + tFin.total + tSNop.total;
  const saldoFinal = saldoInicialBase + saldoTotalPeriodo;

  // Comparativo Realizado x Orçado (totais por bloco)
  const comparativo = useMemo(() => {
    const FIN = /(JURO|IOF|TARIF|FINANC|RENDIMENT|APLIC|BANC[AÁ]RI|EMPR[ÉE]STIM|D[ÉE]BITO\s+AUT)/i;
    const orc: Record<BlocoKey, number> = { ENTRADAS: 0, SAIDAS_OP: 0, FINANCEIRAS: 0, SAIDAS_NAO_OP: 0 };
    (orcQ.data ?? []).forEach((r) => {
      const isFin = FIN.test(r.categoria);
      const k: BlocoKey = r.bloco === "ENTRADAS" ? "ENTRADAS"
        : r.bloco === "SAIDAS_OP" ? "SAIDAS_OP"
        : isFin ? "FINANCEIRAS" : "SAIDAS_NAO_OP";
      orc[k] += Number(r.valor);
    });
    const real: Record<BlocoKey, number> = {
      ENTRADAS: tEntradas.total, SAIDAS_OP: tSOp.total, FINANCEIRAS: tFin.total, SAIDAS_NAO_OP: tSNop.total,
    };
    return (Object.keys(real) as BlocoKey[]).map((b) => {
      const r = real[b], o = orc[b];
      const variacao = r - o;
      const pct = o !== 0 ? (variacao / Math.abs(o)) * 100 : 0;
      return { bloco: b, realizado: r, orcado: o, variacao, pct };
    });
  }, [orcQ.data, tEntradas.total, tSOp.total, tFin.total, tSNop.total]);

  const exportCsv = () => {
    const header = ["Bloco", "Categoria", ...dias, "Total Período"];
    const rows: (string | number)[][] = [];
    rows.push(["—", "Saldo Inicial", ...dias.map((d) => saldosIniciaisDia[d]), ""]);
    rows.push(["—", "Movimentação do Dia", ...dias.map((d) => movimentoDia(d)), saldoTotalPeriodo]);
    (Object.keys(grid) as BlocoKey[]).forEach((b) => {
      grid[b].forEach((cat, nome) => {
        const total = Object.values(cat).reduce((a, c) => a + c, 0);
        rows.push([BLOCO_LABEL[b], nome, ...dias.map((d) => cat[d] ?? 0), total]);
      });
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxo-caixa-diario-${dataIni}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = pdf.internal.pageSize.getWidth();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Fluxo de Caixa Diário", 40, 36);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(empresaNome, 40, 52);
    pdf.text(
      `Período: ${new Date(dataIni + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`,
      40, 66,
    );
    pdf.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, W - 40, 36, { align: "right" });

    const head = [["Categoria", ...dias.map((d) => {
      const dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }), "Total"]];

    const body: any[] = [];
    body.push([
      { content: "SALDO INICIAL", styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" } },
      ...dias.map((d) => ({ content: fmt(saldosIniciaisDia[d]), styles: { fillColor: [248, 250, 252], halign: "right", fontStyle: "bold" } })),
      { content: "—", styles: { halign: "right", fillColor: [248, 250, 252] } },
    ]);
    body.push([
      { content: "MOVIMENTAÇÃO DO DIA", styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" } },
      ...dias.map((d) => ({ content: fmt(movimentoDia(d)), styles: { halign: "right", fontStyle: "bold" } })),
      { content: fmt(saldoTotalPeriodo), styles: { halign: "right", fontStyle: "bold" } },
    ]);

    const pushBloco = (b: BlocoKey) => {
      const t = totaisBloco(b);
      const rgb = BLOCO_PDF_RGB[b];
      body.push([
        { content: BLOCO_LABEL[b], styles: { fillColor: rgb, textColor: [15, 23, 42], fontStyle: "bold" } },
        ...dias.map((d) => ({ content: t.totDia[d] ? fmt(t.totDia[d]) : "—", styles: { fillColor: rgb, halign: "right", fontStyle: "bold" } })),
        { content: fmt(t.total), styles: { fillColor: rgb, halign: "right", fontStyle: "bold" } },
      ]);
      [...grid[b].entries()].sort(([a], [c]) => a.localeCompare(c)).forEach(([nome, cat]) => {
        const total = Object.values(cat).reduce((a, c) => a + c, 0);
        body.push([
          { content: "    " + nome },
          ...dias.map((d) => ({ content: cat[d] ? fmt(cat[d]) : "—", styles: { halign: "right" } })),
          { content: fmt(total), styles: { halign: "right" } },
        ]);
      });
    };

    pushBloco("ENTRADAS");
    pushBloco("SAIDAS_OP");
    pushBloco("FINANCEIRAS");
    pushBloco("SAIDAS_NAO_OP");

    body.push([
      { content: "SALDO FINAL", styles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" } },
      ...dias.map((d) => ({
        content: fmt(saldosIniciaisDia[d] + movimentoDia(d)),
        styles: { fillColor: [37, 99, 235], textColor: 255, halign: "right", fontStyle: "bold" },
      })),
      { content: fmt(saldoFinal), styles: { fillColor: [37, 99, 235], textColor: 255, halign: "right", fontStyle: "bold" } },
    ]);

    autoTable(pdf, {
      head, body, startY: 80, theme: "grid",
      styles: { fontSize: 7, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", halign: "center" },
      columnStyles: { 0: { cellWidth: 140, halign: "left" } },
      margin: { left: 30, right: 30 },
    });

    pdf.save(`fluxo-caixa-diario-${dataIni}_${dataFim}.pdf`);
  };

  const renderBloco = (b: BlocoKey) => {
    const cats = [...grid[b].entries()].sort(([a], [c]) => a.localeCompare(c));
    const totais = totaisBloco(b);
    const isCollapsed = collapsed[b];
    const headerCls = BLOCO_HEADER_CLS[b];
    return (
      <>
        <tr className={`${headerCls} font-semibold cursor-pointer`} onClick={() => setCollapsed((s) => ({ ...s, [b]: !s[b] }))}>
          <td className={`px-3 py-2 sticky left-0 z-10 ${headerCls}`}>
            <span className="inline-flex items-center gap-1">
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {BLOCO_LABEL[b]}
            </span>
          </td>
          {dias.map((d) => (
            <td key={d} className="px-2 py-2 text-right tabular-nums">
              {totais.totDia[d] ? fmt(totais.totDia[d]) : "—"}
            </td>
          ))}
          <td className="px-3 py-2 text-right tabular-nums">{fmt(totais.total)}</td>
        </tr>
        {!isCollapsed && cats.map(([nome, cat]) => {
          const total = Object.values(cat).reduce((a, c) => a + c, 0);
          const corCel =
            b === "ENTRADAS" ? "text-emerald-700 dark:text-emerald-400"
            : b === "SAIDAS_OP" ? "text-rose-700 dark:text-rose-400"
            : b === "FINANCEIRAS" ? "text-violet-700 dark:text-violet-400"
            : "text-amber-700 dark:text-amber-400";
          return (
            <tr key={`${b}-${nome}`} className="border-t border-border/40 hover:bg-muted/20">
              <td className="px-3 py-2 pl-8 sticky left-0 bg-background z-10">{nome}</td>
              {dias.map((d) => (
                <td key={d} className={`px-2 py-2 text-right tabular-nums ${cat[d] ? corCel : "text-muted-foreground"}`}>
                  {cat[d] ? fmt(cat[d]) : "—"}
                </td>
              ))}
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${corCel}`}>{fmt(total)}</td>
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Financeiro", "Fluxo de Caixa", "Fluxo de Caixa Diário"]}
        title="Fluxo de Caixa Diário"
        subtitle="Visão diária das movimentações de entradas e saídas por categoria."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!dadosQ.data?.length}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button onClick={exportPdf} disabled={!dadosQ.data?.length}>
              <FileText className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
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
        <div>
          <Label>Data Inicial</Label>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label>Data Final</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label>Visão</Label>
          <div className="flex gap-1">
            <Button size="sm" variant={visao === "realizado" ? "default" : "outline"} onClick={() => setVisao("realizado")}>
              Realizado
            </Button>
            <Button size="sm" variant={visao === "comparativo" ? "default" : "outline"} onClick={() => setVisao("comparativo")}>
              <BarChart3 className="mr-1 h-3 w-3" /> Realizado x Orçado
            </Button>
          </div>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {dias.length} dias · {dadosQ.data?.length ?? 0} categorias·dia
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-6">
        <Kpi titulo="Saldo Inicial" valor={saldoInicialBase} sub={`Em ${new Date(dataIni + "T00:00:00").toLocaleDateString("pt-BR")}`} />
        <Kpi titulo="Total Entradas" valor={tEntradas.total} cor="text-emerald-600" sub={`${dias.length} dias`} />
        <Kpi titulo="Saídas Operacionais" valor={tSOp.total} cor="text-rose-600" sub={`${dias.length} dias`} />
        <Kpi titulo="Financeiras" valor={tFin.total} cor="text-violet-600" sub={`${dias.length} dias`} />
        <Kpi titulo="Saídas Não Operacionais" valor={tSNop.total} cor="text-amber-600" sub={`${dias.length} dias`} />
        <Kpi titulo="Saldo Final" valor={saldoFinal} sub={`Em ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`} />
      </div>

      <Card className="overflow-auto">
        {dadosQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-20">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-muted/60 z-30 min-w-[240px]">Categoria</th>
                {dias.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  return (
                    <th key={d} className="px-2 py-2 text-right min-w-[80px]">
                      <div>{dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                      <div className="text-[9px] opacity-70">{dow[dt.getDay()]}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right min-w-[110px]">Total Período</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-100 dark:bg-slate-800/60 font-bold border-l-4 border-slate-500">
                <td className="px-3 py-2 sticky left-0 bg-slate-100 dark:bg-slate-800/60 z-10">SALDO INICIAL</td>
                {dias.map((d) => (
                  <td key={d} className="px-2 py-2 text-right tabular-nums">{fmt(saldosIniciaisDia[d])}</td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">—</td>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-800/30 font-semibold border-l-4 border-slate-400">
                <td className="px-3 py-2 sticky left-0 bg-slate-50 dark:bg-slate-800/30 z-10">MOVIMENTAÇÃO DO DIA</td>
                {dias.map((d) => {
                  const v = movimentoDia(d);
                  return (
                    <td key={d} className="px-2 py-2 text-right tabular-nums">
                      {v ? fmt(v) : "—"}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums">{fmt(saldoTotalPeriodo)}</td>
              </tr>

              {renderBloco("ENTRADAS")}
              {renderBloco("SAIDAS_OP")}
              {renderBloco("FINANCEIRAS")}
              {renderBloco("SAIDAS_NAO_OP")}

              <tr className="bg-primary text-primary-foreground font-bold sticky bottom-0">
                <td className="px-3 py-2 sticky left-0 bg-primary z-10">SALDO FINAL</td>
                {dias.map((d) => {
                  const v = saldosIniciaisDia[d] + movimentoDia(d);
                  return (
                    <td key={d} className="px-2 py-2 text-right tabular-nums">
                      {fmt(v)}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums">{fmt(saldoFinal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Saldo inicial baseado em <code>saldos_iniciais_caixa</code> (01/01/2026, 30 contas, R$ 4.307.442,06). Movimentações de <code>mz_40_fato_fluxo_caixa_realizado</code>. Despesas/Receitas Financeiras reclassificadas por palavras-chave (juro, IOF, tarifa, financeiro, rendimento, etc).
      </p>
    </div>
  );
}

function Kpi({ titulo, valor, cor = "", sub }: { titulo: string; valor: number; cor?: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-xl font-bold ${cor}`}>{fmtBRL(valor)}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
