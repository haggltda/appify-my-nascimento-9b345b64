import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ChevronDown, ChevronRight } from "lucide-react";

type Row = { bloco: "ENTRADAS" | "SAIDAS_OP" | "SAIDAS_NAO_OP"; categoria: string; dia: string; valor: number; saldo_inicial: number };

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dow = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const BLOCO_LABEL: Record<Row["bloco"], string> = {
  ENTRADAS: "ENTRADAS",
  SAIDAS_OP: "SAÍDAS OPERACIONAIS",
  SAIDAS_NAO_OP: "SAÍDAS NÃO OPERACIONAIS",
};

const today = new Date();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function FluxoCaixaDiario() {
  const [dataIni, setDataIni] = useState(isoDate(addDays(today, -14)));
  const [dataFim, setDataFim] = useState(isoDate(today));
  const [empresaId, setEmpresaId] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
      setEmpresaId((hagg ?? empresasQ.data[0]).id);
    }
  }, [empresasQ.data, empresaId]);

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
      return (data ?? []) as Row[];
    },
  });

  // Lista de dias do período
  const dias = useMemo(() => {
    const out: string[] = [];
    const a = new Date(dataIni + "T00:00:00");
    const b = new Date(dataFim + "T00:00:00");
    for (let d = new Date(a); d <= b; d = addDays(d, 1)) out.push(isoDate(d));
    return out;
  }, [dataIni, dataFim]);

  const saldoInicial = dadosQ.data?.[0]?.saldo_inicial ?? 0;

  // Agrega por bloco → categoria → dia
  const grid = useMemo(() => {
    const blocos: Record<Row["bloco"], Map<string, Record<string, number>>> = {
      ENTRADAS: new Map(),
      SAIDAS_OP: new Map(),
      SAIDAS_NAO_OP: new Map(),
    };
    (dadosQ.data ?? []).forEach((r) => {
      const m = blocos[r.bloco];
      if (!m) return;
      if (!m.has(r.categoria)) m.set(r.categoria, {});
      m.get(r.categoria)![r.dia] = (m.get(r.categoria)![r.dia] ?? 0) + Number(r.valor);
    });
    return blocos;
  }, [dadosQ.data]);

  const totaisBloco = (b: Row["bloco"]) => {
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
  const tSNop = totaisBloco("SAIDAS_NAO_OP");

  const saldoDia = (d: string) =>
    (tEntradas.totDia[d] ?? 0) + (tSOp.totDia[d] ?? 0) + (tSNop.totDia[d] ?? 0);
  const saldoTotalPeriodo = tEntradas.total + tSOp.total + tSNop.total;
  const saldoFinal = saldoInicial + saldoTotalPeriodo;

  const exportCsv = () => {
    const header = ["Bloco", "Categoria", ...dias, "Total Período"];
    const rows: (string | number)[][] = [];
    (Object.keys(grid) as Row["bloco"][]).forEach((b) => {
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

  const renderBloco = (b: Row["bloco"], cor: string) => {
    const cats = [...grid[b].entries()].sort(([a], [c]) => a.localeCompare(c));
    const totais = totaisBloco(b);
    const isCollapsed = collapsed[b];
    return (
      <>
        <tr className="bg-muted/40 font-semibold cursor-pointer" onClick={() => setCollapsed((s) => ({ ...s, [b]: !s[b] }))}>
          <td className="px-3 py-2 sticky left-0 bg-muted/40 z-10">
            <span className={`inline-flex items-center gap-1 ${cor}`}>
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {BLOCO_LABEL[b]}
            </span>
          </td>
          {dias.map((d) => (
            <td key={d} className={`px-2 py-2 text-right tabular-nums ${cor}`}>
              {totais.totDia[d] ? fmt(totais.totDia[d]) : "—"}
            </td>
          ))}
          <td className={`px-3 py-2 text-right tabular-nums ${cor}`}>{fmt(totais.total)}</td>
        </tr>
        {!isCollapsed && cats.map(([nome, cat]) => {
          const total = Object.values(cat).reduce((a, c) => a + c, 0);
          return (
            <tr key={`${b}-${nome}`} className="border-t border-border/40 hover:bg-muted/20">
              <td className="px-3 py-2 pl-8 sticky left-0 bg-background z-10">{nome}</td>
              {dias.map((d) => (
                <td key={d} className={`px-2 py-2 text-right tabular-nums ${cat[d] ? cor : "text-muted-foreground"}`}>
                  {cat[d] ? fmt(cat[d]) : "—"}
                </td>
              ))}
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${cor}`}>{fmt(total)}</td>
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
          <Button variant="outline" onClick={exportCsv} disabled={!dadosQ.data?.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
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
        <div className="ml-auto text-xs text-muted-foreground">
          {dias.length} dias · {dadosQ.data?.length ?? 0} categorias·dia
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <Kpi titulo="Saldo Inicial" valor={saldoInicial} sub={`Em ${new Date(dataIni + "T00:00:00").toLocaleDateString("pt-BR")}`} />
        <Kpi titulo="Total Entradas" valor={tEntradas.total} cor="text-success" sub={`${dias.length} dias`} />
        <Kpi titulo="Saídas Operacionais" valor={tSOp.total} cor="text-destructive" sub={`${dias.length} dias`} />
        <Kpi titulo="Saídas Não Operacionais" valor={tSNop.total} cor="text-warning" sub={`${dias.length} dias`} />
        <Kpi titulo="Saldo Final" valor={saldoFinal} sub={`Em ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`} />
      </div>

      <Card className="overflow-auto">
        {dadosQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-20">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-muted/60 z-30 min-w-[220px]">Categoria</th>
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
              {renderBloco("ENTRADAS", "text-success")}
              {renderBloco("SAIDAS_OP", "text-destructive")}
              {renderBloco("SAIDAS_NAO_OP", "text-warning")}
              <tr className="bg-primary text-primary-foreground font-bold sticky bottom-0">
                <td className="px-3 py-2 sticky left-0 bg-primary z-10">SALDO DO DIA</td>
                {dias.map((d) => {
                  const v = saldoDia(d);
                  return (
                    <td key={d} className="px-2 py-2 text-right tabular-nums">
                      {v ? fmt(v) : "—"}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums">{fmt(saldoTotalPeriodo)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Fonte: Migração Zero — <code>mz_40_fato_fluxo_caixa_realizado</code>. Categorias agrupadas por classificação gerencial (Custo/Despesa = Operacional; Patrimonial e demais = Não Operacional).
      </p>
    </div>
  );
}

function Kpi({ titulo, valor, cor = "", sub }: { titulo: string; valor: number; cor?: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${cor}`}>{fmtBRL(valor)}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
