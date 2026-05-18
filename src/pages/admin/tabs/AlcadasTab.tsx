import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { usePermissoes } from "@/context/PermissoesContext";
import { Plus, Trash2 } from "lucide-react";

interface Alcada {
  id: string; empresa_id: string; etapa: string;
  responsavel_user_id: string | null; responsavel_nome: string | null;
  valor_min: number; valor_max: number | null;
  excecao: string | null; ordem: number; ativo: boolean;
}

const fmt = (v: number | null) =>
  v === null ? "sem teto" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AlcadasTab() {
  const qc = useQueryClient();
  const { roles, empresaId } = usePermissoes();
  const isAdmin = roles.includes("admin");

  const empresasQ = useQuery({
    queryKey: ["empresas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id,codigo,razao_social").order("razao_social");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [empresaSel, setEmpresaSel] = useState<string>("");
  const eid = empresaSel || empresaId || (empresasQ.data?.[0]?.id ?? "");

  const alcadasQ = useQuery({
    enabled: !!eid,
    queryKey: ["alcada_aprovacao", eid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alcada_aprovacao")
        .select("*")
        .eq("empresa_id", eid)
        .order("ordem")
        .order("valor_min");
      if (error) throw error;
      return (data ?? []) as Alcada[];
    },
  });

  const remover = async (id: string) => {
    if (!confirm("Excluir esta alçada?")) return;
    const { error } = await supabase.from("alcada_aprovacao").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["alcada_aprovacao", eid] });
  };

  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-bold">Alçadas de aprovação</h2>
          <p className="text-xs text-muted-foreground">Configuração de etapas, responsáveis e faixas por empresa.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={eid}
            onChange={(e) => setEmpresaSel(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs"
          >
            {(empresasQ.data ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</option>
            ))}
          </select>
          {isAdmin && eid && <NovaAlcada empresaId={eid} onSaved={() => qc.invalidateQueries({ queryKey: ["alcada_aprovacao", eid] })} />}
        </div>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left">Etapa</th>
            <th className="px-3 py-3 text-left">Responsável</th>
            <th className="px-3 py-3 text-right">Valor mín.</th>
            <th className="px-3 py-3 text-right">Valor máx.</th>
            <th className="px-3 py-3 text-left">Exceção</th>
            <th className="px-5 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {alcadasQ.isLoading && <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
          {!alcadasQ.isLoading && (alcadasQ.data ?? []).length === 0 && (
            <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">Nenhuma alçada cadastrada.</td></tr>
          )}
          {(alcadasQ.data ?? []).map((a) => (
            <tr key={a.id} className="hover:bg-muted/40">
              <td className="px-5 py-3 font-medium">{a.etapa}</td>
              <td className="px-3 py-3 text-xs">{a.responsavel_nome ?? "—"}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{fmt(Number(a.valor_min))}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{fmt(a.valor_max === null ? null : Number(a.valor_max))}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{a.excecao ?? "—"}</td>
              <td className="px-5 py-3 text-right">
                {isAdmin && <Button size="sm" variant="ghost" onClick={() => remover(a.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function NovaAlcada({ empresaId, onSaved }: { empresaId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [vmin, setVmin] = useState("0");
  const [vmax, setVmax] = useState("");
  const [excecao, setExcecao] = useState("");
  const [saving, setSaving] = useState(false);

  const usuariosQ = useQuery({
    enabled: open,
    queryKey: ["profiles-aprovadores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("ativo", true)
        .order("display_name");
      return data ?? [];
    },
  });

  const salvar = async () => {
    if (!etapa.trim()) { toast({ title: "Etapa obrigatória", variant: "destructive" }); return; }
    if (!responsavelId) { toast({ title: "Responsável obrigatório", description: "Selecione um usuário cadastrado.", variant: "destructive" }); return; }
    setSaving(true);
    const u = (usuariosQ.data ?? []).find((x: any) => x.id === responsavelId);
    const { error } = await supabase.from("alcada_aprovacao").insert({
      empresa_id: empresaId, etapa: etapa.trim(),
      responsavel_user_id: responsavelId,
      responsavel_nome: u?.display_name ?? u?.email ?? null,
      valor_min: Number(vmin) || 0,
      valor_max: vmax ? Number(vmax) : null,
      excecao: excecao || null,
    });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Alçada criada" });
    setOpen(false);
    setEtapa(""); setResponsavelId(""); setVmin("0"); setVmax(""); setExcecao("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova alçada</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova alçada de aprovação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Etapa *</Label><Input value={etapa} onChange={(e) => setEtapa(e.target.value)} placeholder="Ex.: Gerente, Diretoria, Presidência" /></div>
          <div>
            <Label>Responsável * <span className="text-muted-foreground">(usuário cadastrado)</span></Label>
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              <option value="">— Selecione —</option>
              {(usuariosQ.data ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Esse usuário receberá a notificação para aprovar.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor mínimo (R$)</Label><Input type="number" value={vmin} onChange={(e) => setVmin(e.target.value)} /></div>
            <div><Label>Valor máximo (R$)</Label><Input type="number" value={vmax} onChange={(e) => setVmax(e.target.value)} placeholder="vazio = sem teto" /></div>
          </div>
          <div><Label>Exceção</Label><Input value={excecao} onChange={(e) => setExcecao(e.target.value)} placeholder="Ex.: Margem < 10%" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
