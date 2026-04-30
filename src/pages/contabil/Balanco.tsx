import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BalancoPatrimonial() {
  const { data: empresaId } = useEmpresaId();
  const [dataCorte, setDataCorte] = useState(new Date().toISOString().slice(0, 10));
  const [trigger, setTrigger] = useState(0);

  const q = useQuery({
    queryKey: ["balanco", empresaId, dataCorte, trigger],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("balanco_patrimonial", {
        _empresa_id: empresaId!, _data_corte: dataCorte,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ grupo: string; conta_id: string; classificacao: string; descricao: string; saldo: number }>;
    },
  });

  const grupos = useMemo(() => {
    const g: Record<string, typeof q.data> = { ATIVO: [], PASSIVO: [], PATRIMONIO: [] } as any;
    (q.data ?? []).forEach(r => { (g[r.grupo] ??= [] as any).push(r); });
    return g;
  }, [q.data]);

  const totalGrupo = (lista: any[]) => (lista ?? []).reduce((s, r) => s + Number(r.saldo || 0), 0);

  if (!empresaId) return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;

  const totalA = totalGrupo(grupos.ATIVO as any);
  const totalP = totalGrupo(grupos.PASSIVO as any) + totalGrupo(grupos.PATRIMONIO as any);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Data de corte</Label><Input type="date" value={dataCorte} onChange={(e) => setDataCorte(e.target.value)} /></div>
        <Button onClick={() => setTrigger(t => t + 1)} className="gap-2"><Search className="h-4 w-4" />Gerar</Button>
        <div className="ml-auto text-sm text-muted-foreground">
          Ativo: <strong className="text-foreground">{fmt(totalA)}</strong> · Passivo+PL: <strong className="text-foreground">{fmt(totalP)}</strong>
          <span className={Math.abs(totalA - totalP) < 0.01 ? " text-emerald-500" : " text-red-500"}> · Δ {fmt(totalA - totalP)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GrupoCard titulo="ATIVO" linhas={(grupos.ATIVO as any) ?? []} total={totalA} />
        <div className="space-y-4">
          <GrupoCard titulo="PASSIVO" linhas={(grupos.PASSIVO as any) ?? []} total={totalGrupo(grupos.PASSIVO as any)} />
          <GrupoCard titulo="PATRIMÔNIO LÍQUIDO" linhas={(grupos.PATRIMONIO as any) ?? []} total={totalGrupo(grupos.PATRIMONIO as any)} />
        </div>
      </div>
    </div>
  );
}

function GrupoCard({ titulo, linhas, total }: { titulo: string; linhas: any[]; total: number }) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="bg-muted/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground flex justify-between">
        <span>{titulo}</span><span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {linhas.length === 0 && (<tr><td className="px-3 py-3 text-center text-muted-foreground text-xs">Sem contas</td></tr>)}
          {linhas.map((r: any) => (
            <tr key={r.conta_id} className="border-t border-border/60">
              <td className="px-3 py-1.5 font-mono text-xs text-primary w-32">{r.classificacao}</td>
              <td className="px-3 py-1.5">{r.descricao}</td>
              <td className={`px-3 py-1.5 text-right text-sm ${Number(r.saldo) < 0 ? "text-red-500" : ""}`}>
                {Number(r.saldo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
