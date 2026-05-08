import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const fmt = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function FluxoCaixa() {
  const ano = new Date().getFullYear();
  const [anoSel, setAnoSel] = useState(ano);
  const [empresaId, setEmpresaId] = useState<string>("todas");

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ["empresas-fc"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, razao_social, codigo").order("razao_social");
      return data ?? [];
    },
  });

  const { data: linhas = [], isLoading } = useQuery<any[]>({
    queryKey: ["fluxo_caixa_consolidado", anoSel, empresaId],
    queryFn: async () => {
      let q = (supabase as any).from("v_fluxo_caixa_consolidado")
        .select("*").eq("ano", anoSel).limit(5000);
      if (empresaId !== "todas") q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Aggregate by month × regime
  const grid = useMemo(() => {
    const out: Record<string, { entradas: number; saidas: number; saldo: number }> = {};
    for (let m = 1; m <= 12; m++) {
      out[`real-${m}`] = { entradas: 0, saidas: 0, saldo: 0 };
      out[`proj-${m}`] = { entradas: 0, saidas: 0, saldo: 0 };
    }
    linhas.forEach((l) => {
      const k = `${l.regime === "realizado" ? "real" : "proj"}-${l.mes}`;
      if (!out[k]) return;
      out[k].entradas += Number(l.entradas || 0);
      out[k].saidas += Number(l.saidas || 0);
      out[k].saldo += Number(l.saldo || 0);
    });
    return out;
  }, [linhas]);

  const totalReal = useMemo(() => {
    const t = { entradas: 0, saidas: 0, saldo: 0 };
    for (let m = 1; m <= 12; m++) { const v = grid[`real-${m}`]; t.entradas += v.entradas; t.saidas += v.saidas; t.saldo += v.saldo; }
    return t;
  }, [grid]);
  const totalProj = useMemo(() => {
    const t = { entradas: 0, saidas: 0, saldo: 0 };
    for (let m = 1; m <= 12; m++) { const v = grid[`proj-${m}`]; t.entradas += v.entradas; t.saidas += v.saidas; t.saldo += v.saldo; }
    return t;
  }, [grid]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Consolidado mensal — realizado (recebido/pago) e projetado (vencimentos abertos)"
        module="Financeiro"
        breadcrumb={["Fluxo de Caixa"]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Saldo realizado {anoSel}</CardDescription><CardTitle className={`text-2xl ${totalReal.saldo < 0 ? "text-destructive" : ""}`}>{fmt(totalReal.saldo)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Saldo projetado {anoSel}</CardDescription><CardTitle className={`text-2xl ${totalProj.saldo < 0 ? "text-destructive" : ""}`}>{fmt(totalProj.saldo)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Saldo total previsto</CardDescription><CardTitle className={`text-2xl ${(totalReal.saldo + totalProj.saldo) < 0 ? "text-destructive" : ""}`}>{fmt(totalReal.saldo + totalProj.saldo)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
          <div><Label>Ano</Label>
            <Select value={String(anoSel)} onValueChange={(v) => setAnoSel(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.sigla ?? e.razao_social}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Regime</TableHead>
                  <TableHead></TableHead>
                  {meses.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(["real", "proj"] as const).map((regime) => (
                  <>
                    <TableRow key={`${regime}-e`}>
                      <TableCell rowSpan={3} className="align-top font-medium">
                        <Badge variant={regime === "real" ? "default" : "outline"}>{regime === "real" ? "Realizado" : "Projetado"}</Badge>
                      </TableCell>
                      <TableCell className="text-success">Entradas</TableCell>
                      {meses.map((_, i) => <TableCell key={i} className="text-right tabular-nums">{fmt(grid[`${regime}-${i + 1}`].entradas)}</TableCell>)}
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(meses.reduce((s, _, i) => s + grid[`${regime}-${i + 1}`].entradas, 0))}</TableCell>
                    </TableRow>
                    <TableRow key={`${regime}-s`}>
                      <TableCell className="text-destructive">Saídas</TableCell>
                      {meses.map((_, i) => <TableCell key={i} className="text-right tabular-nums">{fmt(grid[`${regime}-${i + 1}`].saidas)}</TableCell>)}
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(meses.reduce((s, _, i) => s + grid[`${regime}-${i + 1}`].saidas, 0))}</TableCell>
                    </TableRow>
                    <TableRow key={`${regime}-sal`} className="border-b-2">
                      <TableCell className="font-semibold">Saldo</TableCell>
                      {meses.map((_, i) => {
                        const v = grid[`${regime}-${i + 1}`].saldo;
                        return <TableCell key={i} className={`text-right tabular-nums font-semibold ${v < 0 ? "text-destructive" : ""}`}>{fmt(v)}</TableCell>;
                      })}
                      <TableCell className={`text-right tabular-nums font-bold ${(regime === "real" ? totalReal.saldo : totalProj.saldo) < 0 ? "text-destructive" : ""}`}>
                        {fmt(regime === "real" ? totalReal.saldo : totalProj.saldo)}
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
