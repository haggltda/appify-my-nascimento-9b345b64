import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Play } from "lucide-react";

const fmt = (n: number) => Number(n||0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Periodo = {
  id: string; competencia: string; status: string;
  data_provisao: string|null; data_pagamento: string|null; data_encargos: string|null;
  conta_banco_id: string|null;
  total_provisao?: number; total_pagamento?: number; total_encargos?: number;
};

export default function Folha() {
  const { data: empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [novaComp, setNovaComp] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
  });
  const [selPer, setSelPer] = useState<string|null>(null);
  const [novoEvt, setNovoEvt] = useState({ tipo: "provisao", descricao: "", valor: "" });

  const periodosQ = useQuery({
    queryKey: ["folha-periodos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("folha_periodo").select("*")
        .eq("empresa_id", empresaId).order("competencia", { ascending: false });
      if (error) throw error;
      return data as Periodo[];
    }
  });

  const eventosQ = useQuery({
    queryKey: ["folha-eventos", selPer],
    enabled: !!selPer,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("folha_evento").select("*").eq("folha_periodo_id", selPer)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    }
  });

  const contasBQ = useQuery({
    queryKey: ["contas-banco", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("conta_bancaria").select("id,banco_nome,agencia,conta").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data ?? [];
    }
  });

  const criarPer = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("folha_periodo").insert({
        empresa_id: empresaId, competencia: novaComp, status: "aberto",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Período criado"); qc.invalidateQueries({ queryKey: ["folha-periodos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addEvento = useMutation({
    mutationFn: async () => {
      if (!selPer) return;
      const { error } = await (supabase as any).from("folha_evento").insert({
        folha_periodo_id: selPer, empresa_id: empresaId,
        tipo: novoEvt.tipo, descricao: novoEvt.descricao, valor: Number(novoEvt.valor || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evento adicionado"); setNovoEvt({ tipo: "provisao", descricao: "", valor: "" }); qc.invalidateQueries({ queryKey: ["folha-eventos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const contabilizar = useMutation({
    mutationFn: async (evento: string) => {
      const { data, error } = await (supabase as any).rpc("contabilizar_folha", { _periodo_id: selPer, _evento: evento });
      if (error) throw error;
      return data;
    },
    onSuccess: (id, evento) => {
      toast.success(`Folha ${evento} contabilizada (lanc ${String(id).slice(0,8)})`);
      qc.invalidateQueries({ queryKey: ["folha-periodos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarPer = useMutation({
    mutationFn: async (patch: Partial<Periodo>) => {
      const { error } = await (supabase as any).from("folha_periodo").update(patch).eq("id", selPer);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folha-periodos"] }),
  });

  const periodo = (periodosQ.data ?? []).find(p => p.id === selPer);

  if (!empresaId) return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4 card-elevated p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1"><Label>Nova competência</Label><Input type="date" value={novaComp} onChange={e => setNovaComp(e.target.value)} /></div>
          <Button onClick={() => criarPer.mutate()} className="gap-1"><Plus className="h-4 w-4" />Criar</Button>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Períodos</div>
        <div className="space-y-1 max-h-[60vh] overflow-auto">
          {(periodosQ.data ?? []).map(p => (
            <button key={p.id} onClick={() => setSelPer(p.id)} className={`w-full text-left px-3 py-2 rounded border ${selPer===p.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{new Date(p.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
              </div>
            </button>
          ))}
          {(periodosQ.data ?? []).length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum período.</div>}
        </div>
      </div>

      <div className="col-span-8 space-y-4">
        {!periodo ? (
          <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione um período.</div>
        ) : (
          <>
            <div className="card-elevated p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>Data provisão</Label><Input type="date" value={periodo.data_provisao ?? ""} onChange={e => atualizarPer.mutate({ data_provisao: e.target.value })} /></div>
              <div><Label>Data pagamento</Label><Input type="date" value={periodo.data_pagamento ?? ""} onChange={e => atualizarPer.mutate({ data_pagamento: e.target.value })} /></div>
              <div><Label>Data encargos</Label><Input type="date" value={periodo.data_encargos ?? ""} onChange={e => atualizarPer.mutate({ data_encargos: e.target.value })} /></div>
              <div>
                <Label>Conta bancária</Label>
                <select className="w-full border rounded h-10 px-2 bg-background" value={periodo.conta_banco_id ?? ""} onChange={e => atualizarPer.mutate({ conta_banco_id: e.target.value || null })}>
                  <option value="">-</option>
                  {(contasBQ.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.banco_nome} {c.agencia}/{c.conta}</option>)}
                </select>
              </div>
              <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => contabilizar.mutate("provisao")}><Play className="h-3 w-3" />EVT-008 Provisão</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => contabilizar.mutate("pagamento")}><Play className="h-3 w-3" />EVT-009 Pagamento</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => contabilizar.mutate("encargos")}><Play className="h-3 w-3" />EVT-010 Encargos</Button>
              </div>
            </div>

            <div className="card-elevated p-4 space-y-3">
              <div className="text-sm font-medium">Adicionar evento</div>
              <div className="grid grid-cols-12 gap-2">
                <select className="col-span-3 border rounded h-10 px-2 bg-background" value={novoEvt.tipo} onChange={e => setNovoEvt({ ...novoEvt, tipo: e.target.value })}>
                  <option value="provisao">Provisão</option>
                  <option value="pagamento">Pagamento</option>
                  <option value="encargos">Encargos</option>
                </select>
                <Input className="col-span-6" placeholder="Descrição" value={novoEvt.descricao} onChange={e => setNovoEvt({ ...novoEvt, descricao: e.target.value })} />
                <Input className="col-span-2" type="number" step="0.01" placeholder="Valor" value={novoEvt.valor} onChange={e => setNovoEvt({ ...novoEvt, valor: e.target.value })} />
                <Button className="col-span-1" onClick={() => addEvento.mutate()}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Valor</th></tr>
                </thead>
                <tbody>
                  {(eventosQ.data ?? []).map((e: any) => (
                    <tr key={e.id} className="border-t border-border/60">
                      <td className="px-3 py-2"><Badge variant="outline">{e.tipo}</Badge></td>
                      <td className="px-3 py-2">{e.descricao}</td>
                      <td className="px-3 py-2 text-right">{fmt(e.valor)}</td>
                    </tr>
                  ))}
                  {(eventosQ.data ?? []).length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Sem eventos.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
