import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown } from "lucide-react";

type Linha = {
  dre_linha_id: string;
  codigo: string;
  descricao: string;
  natureza: string;
  ordem: number;
  mes: number;
  realizado: number;
  orcado: number;
  variacao: number;
};

type Visao = "realizado" | "orcado" | "variacao";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function DREGerencial() {
  const { data: empresaIdProfile } = useEmpresaId();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const [empresaId, setEmpresaId] = useState<string | undefined>(undefined);
  const [versaoId, setVersaoId] = useState<string | "auto">("auto");
  const [visao, setVisao] = useState<Visao>("realizado");

  const empresasQ = useQuery({
    queryKey: ["empresas-dre"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("empresas").select("id, codigo, razao_social").eq("ativa", true).order("codigo");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; codigo: string; razao_social: string }>;
    },
  });

  // Inicializa empresa: usa profile, ou primeira empresa com lançamentos no ano
  useEffect(() => {
    if (!empresaId && (empresasQ.data?.length ?? 0) > 0) {
      setEmpresaId(empresaIdProfile ?? empresasQ.data![0].id);
    }
  }, [empresasQ.data, empresaIdProfile, empresaId]);

  const versoesQ = useQuery({
    queryKey: ["obz_versoes_para_dre", empresaId, ano],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obz_versoes")
        .select("id, nome, versao, revisao, status")
        .eq("empresa_id", empresaId)
        .eq("ano", ano)
        .order("revisao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string; versao: number; revisao: number; status: string }>;
    },
  });

  const dadosQ = useQuery({
    queryKey: ["dre_gerencial_mensal", empresaId, ano, versaoId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("dre_gerencial_mensal", {
        _empresa_id: empresaId,
        _ano: ano,
        _versao_obz: versaoId === "auto" ? null : versaoId,
      });
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const linhas = useMemo(() => {
    const map = new Map<string, { codigo: string; descricao: string; natureza: string; ordem: number; meses: number[]; realMeses: number[]; orcMeses: number[] }>();
    (dadosQ.data ?? []).forEach((r) => {
      let agg = map.get(r.dre_linha_id);
      if (!agg) {
        agg = {
          codigo: r.codigo,
          descricao: r.descricao,
          natureza: r.natureza,
          ordem: r.ordem,
          meses: Array(12).fill(0),
          realMeses: Array(12).fill(0),
          orcMeses: Array(12).fill(0),
        };
        map.set(r.dre_linha_id, agg);
      }
      const i = r.mes - 1;
      agg.realMeses[i] = Number(r.realizado || 0);
      agg.orcMeses[i] = Number(r.orcado || 0);
      agg.meses[i] =
        visao === "realizado" ? Number(r.realizado || 0) :
        visao === "orcado" ? Number(r.orcado || 0) :
        Number(r.variacao || 0);
    });
    return [...map.values()].sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
  }, [dadosQ.data, visao]);

  // Resultado Líquido = última linha de natureza 'resultado' (evita duplicar subtotais)
  const linhaResultado = useMemo(() => {
    const resultados = linhas.filter((l) => l.natureza === "resultado");
    if (resultados.length === 0) return null;
    return resultados[resultados.length - 1];
  }, [linhas]);
  const totalReal = linhaResultado ? linhaResultado.realMeses.reduce((a, b) => a + b, 0) : 0;
  const totalOrc = linhaResultado ? linhaResultado.orcMeses.reduce((a, b) => a + b, 0) : 0;

  const exportCsv = () => {
    const header = ["Descrição", "Natureza", ...MESES, "Total"];
    const rows = linhas.map((l) => {
      const total = l.meses.reduce((a, b) => a + b, 0);
      return [l.descricao, l.natureza, ...l.meses.map((v) => v.toFixed(2)), total.toFixed(2)];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-gerencial-${ano}-${visao}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!empresaId) {
    return <div className="card-elevated p-6 text-sm text-muted-foreground">Carregando empresas…</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Controladoria", "DRE Gerencial"]}
        title="DRE Gerencial Mensal"
        subtitle="Realizado vs Orçado (OBZ) por linha gerencial, mês a mês."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={linhas.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <div className="card-elevated flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px]">
          <Label>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(empresasQ.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ano</Label>
          <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value) || anoAtual)} className="w-28" />
        </div>
        <div className="min-w-[260px]">
          <Label>Versão OBZ</Label>
          <Select value={versaoId} onValueChange={(v) => setVersaoId(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Última aprovada (automático)</SelectItem>
              {(versoesQ.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  v{v.versao}.{v.revisao} — {v.nome} [{v.status}]
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="realizado">Realizado</TabsTrigger>
            <TabsTrigger value="orcado">Orçado</TabsTrigger>
            <TabsTrigger value="variacao">Variação</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resultado Líquido Realizado {ano}
          </p>
          <p className={`mt-2 font-display text-3xl font-bold ${totalReal >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totalReal)}</p>
          {linhaResultado && <p className="mt-1 text-xs text-muted-foreground">{linhaResultado.descricao}</p>}
        </div>
        <div className="card-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resultado Líquido Orçado {ano}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-info">{fmt(totalOrc)}</p>
        </div>
        <div className="card-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variação</p>
          <p className={`mt-2 font-display text-3xl font-bold ${totalReal - totalOrc >= 0 ? "text-success" : "text-destructive"} flex items-center gap-2`}>
            {totalReal - totalOrc >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            {fmt(totalReal - totalOrc)}
          </p>
          {totalOrc !== 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{fmtPct((totalReal - totalOrc) / Math.abs(totalOrc))} do orçado</p>
          )}
        </div>
      </div>

      <div className="card-elevated overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-20">Código</th>
              <th className="px-3 py-2 text-left">Linha</th>
              {MESES.map((m) => (
                <th key={m} className="px-2 py-2 text-right tabular-nums w-[80px]">{m}</th>
              ))}
              <th className="px-3 py-2 text-right tabular-nums w-[110px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {dadosQ.isLoading && (
              <tr><td colSpan={15} className="py-10 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!dadosQ.isLoading && linhas.length === 0 && (
              <tr><td colSpan={15} className="py-10 text-center text-muted-foreground">Sem dados para o período.</td></tr>
            )}
            {linhas.map((l) => {
              const total = l.meses.reduce((a, b) => a + b, 0);
              const isResultado = ["resultado"].includes(l.natureza);
              return (
                <tr key={l.codigo} className={`border-t border-border/60 ${isResultado ? "bg-primary-soft/30 font-semibold" : ""}`}>
                  <td className="px-3 py-2 font-mono text-xs text-primary">{l.codigo}</td>
                  <td className="px-3 py-2">
                    {l.descricao}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{l.natureza}</Badge>
                  </td>
                  {l.meses.map((v, i) => (
                    <td
                      key={i}
                      className={`px-2 py-2 text-right tabular-nums ${
                        v < 0 ? "text-destructive" : visao === "variacao" && v > 0 ? "text-success" : ""
                      }`}
                    >
                      {v === 0 ? "—" : fmt(v)}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${
                    total < 0 ? "text-destructive" : visao === "variacao" && total > 0 ? "text-success" : ""
                  }`}>
                    {fmt(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Realizado vem da contabilização efetivada (lançamentos contábeis × conta_contabil.dre_linha_id). Orçado vem da versão OBZ aprovada (ou selecionada).
      </p>
    </div>
  );
}
