import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fmt = (n: number) => Number(n||0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ORIGENS = ["nota_fiscal","titulo_receber","titulo_pagar","titulo_receber_baixa","estoque_movimento","folha_periodo"] as const;

export default function ConciliacaoEventos() {
  const { data: empresaId } = useEmpresaId();
  const [filtro, setFiltro] = useState<"todos"|"orfaos"|"contabilizados">("orfaos");
  const [origem, setOrigem] = useState<string>("todas");

  const q = useQuery({
    queryKey: ["conciliacao-eventos", empresaId, filtro, origem],
    enabled: !!empresaId,
    queryFn: async () => {
      let qb = (supabase as any).from("vw_conciliacao_eventos").select("*").eq("empresa_id", empresaId).order("data", { ascending: false }).limit(500);
      if (filtro === "orfaos") qb = qb.is("lancamento_id", null);
      if (filtro === "contabilizados") qb = qb.not("lancamento_id", "is", null);
      if (origem !== "todas") qb = qb.eq("origem_tipo", origem);
      const { data, error } = await qb;
      if (error) throw error;
      return data as any[];
    }
  });

  const counts = (q.data ?? []).reduce((acc: any, r: any) => {
    acc.total++; if (r.contabilizado) acc.ok++; else acc.orfao++;
    return acc;
  }, { total: 0, ok: 0, orfao: 0 });

  if (!empresaId) return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1">
          {(["todos","orfaos","contabilizados"] as const).map(f => (
            <Button key={f} size="sm" variant={filtro===f ? "default" : "outline"} onClick={() => setFiltro(f)}>{f}</Button>
          ))}
        </div>
        <select className="border rounded h-9 px-2 bg-background text-sm" value={origem} onChange={e => setOrigem(e.target.value)}>
          <option value="todas">Todas as origens</option>
          {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="ml-auto text-xs text-muted-foreground">
          Total: <strong className="text-foreground">{counts.total}</strong> · 
          Contabilizados: <strong className="text-emerald-500">{counts.ok}</strong> · 
          Órfãos: <strong className="text-red-500">{counts.orfao}</strong>
        </div>
      </div>

      <div className="card-elevated overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Doc</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Status origem</th>
              <th className="px-3 py-2 text-left">Lançamento</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {(q.data ?? []).map((r: any) => (
              <tr key={`${r.origem_tipo}-${r.origem_id}`} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-xs">{r.origem_tipo}</td>
                <td className="px-3 py-2">{r.doc}</td>
                <td className="px-3 py-2 text-xs">{r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 text-right">{fmt(r.valor)}</td>
                <td className="px-3 py-2 text-xs"><Badge variant="outline">{r.status_origem}</Badge></td>
                <td className="px-3 py-2 text-xs font-mono">{r.lancamento_numero ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  {r.contabilizado
                    ? <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">OK</Badge>
                    : <Badge variant="destructive">órfão</Badge>}
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && !q.isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem registros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
