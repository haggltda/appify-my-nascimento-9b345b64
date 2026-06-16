import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DRERealizado() {
  const { data: empresaId } = useEmpresaId();
  const today = new Date();
  const ini = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const fim = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [dataIni, setDataIni] = useState(ini);
  const [dataFim, setDataFim] = useState(fim);
  const [trigger, setTrigger] = useState(0);

  const q = useQuery({
    queryKey: ["dre_realizado", empresaId, dataIni, dataFim, trigger],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dre_realizado", {
        _empresa_id: empresaId!, _data_ini: dataIni, _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ grupo: string; conta_id: string; classificacao: string; descricao: string; valor: number }>;
    },
  });

  const total = (q.data ?? []).reduce((s, r) => s + Number(r.valor || 0), 0);

  if (!empresaId) return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Início</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></div>
        <div><Label>Fim</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
        <Button onClick={() => setTrigger(t => t + 1)} className="gap-2"><Search className="h-4 w-4" />Gerar</Button>
        <div className="ml-auto text-sm">
          Resultado do período: <strong className={total >= 0 ? "text-emerald-500" : "text-red-500"}>{fmt(total)}</strong>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Classificação</th>
              <th className="px-3 py-2 text-left">Conta</th>
              <th className="px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nenhum lançamento DRE no período.</td></tr>
            )}
            {(q.data ?? []).map(r => (
              <tr key={r.conta_id} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-xs text-primary">{r.classificacao}</td>
                <td className="px-3 py-2">{r.descricao}</td>
                <td className={`px-3 py-2 text-right font-semibold ${Number(r.valor) < 0 ? "text-red-500" : ""}`}>{fmt(Number(r.valor))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
