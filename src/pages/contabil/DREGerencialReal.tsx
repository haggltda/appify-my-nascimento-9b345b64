import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type Row = {
  dre_linha_id: string; codigo: string; descricao: string; natureza: string; ordem: number;
  mes: number; realizado: number; orcado: number; variacao: number;
};

export default function DREGerencialReal() {
  const { data: empresaId } = useEmpresaId();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [trigger, setTrigger] = useState(0);

  const q = useQuery({
    queryKey: ["dre-gerencial-comp", empresaId, ano, trigger],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("dre_gerencial_competencia", {
        _empresa_id: empresaId!, _ano: ano,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Pivota por linha
  const linhas = new Map<string, { codigo: string; descricao: string; natureza: string; ordem: number; meses: number[] }>();
  (q.data ?? []).forEach(r => {
    const k = r.dre_linha_id;
    if (!linhas.has(k)) linhas.set(k, { codigo: r.codigo, descricao: r.descricao, natureza: r.natureza, ordem: r.ordem, meses: Array(12).fill(0) });
    linhas.get(k)!.meses[r.mes - 1] = Number(r.realizado);
  });
  const rows = Array.from(linhas.entries()).sort((a,b) => a[1].ordem - b[1].ordem || a[1].codigo.localeCompare(b[1].codigo));

  if (!empresaId) return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Ano</Label><Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28" /></div>
        <Button onClick={() => setTrigger(t => t + 1)} className="gap-2"><Search className="h-4 w-4" />Gerar</Button>
        <div className="ml-auto text-xs text-muted-foreground">Realizado por competência (lancamento_partida × dre_linhas)</div>
      </div>

      <div className="card-elevated overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Cód</th>
              <th className="px-2 py-2 text-left">Linha DRE</th>
              {MESES.map(m => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={14} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {rows.map(([id, l]) => {
              const total = l.meses.reduce((s,v) => s+v, 0);
              return (
                <tr key={id} className="border-t border-border/60">
                  <td className="px-2 py-1.5 font-mono text-primary">{l.codigo}</td>
                  <td className="px-2 py-1.5">{l.descricao}</td>
                  {l.meses.map((v,i) => <td key={i} className={`px-2 py-1.5 text-right ${v<0 ? "text-red-500" : ""}`}>{v ? fmt(v) : "-"}</td>)}
                  <td className={`px-2 py-1.5 text-right font-semibold ${total<0 ? "text-red-500" : ""}`}>{fmt(total)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !q.isLoading && <tr><td colSpan={14} className="px-3 py-6 text-center text-muted-foreground">Sem dados para o ano.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
