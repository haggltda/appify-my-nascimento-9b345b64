import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import {
  cicloStatusLabel,
  useCiclos,
  useCreateCiclo,
  useGerarOrcamento,
  useOrcamentosDoCiclo,
} from "@/hooks/useOrcamento";
import { useContratos, formatBRL, statusLabel } from "@/hooks/useContratos";

export default function Orcamento() {
  const { data: ciclos = [], isLoading } = useCiclos();
  const [cicloAtivoId, setCicloAtivoId] = useState<string | undefined>();
  const cicloSel = ciclos.find((c) => c.id === cicloAtivoId) ?? ciclos[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamento contratual"
        module="Controladoria"
        breadcrumb={["Orçamento"]}
        subtitle="Ciclos orçamentários, geração automática a partir dos contratos e workflow de aprovação."
        actions={<NovoCicloDialog />}
      />

      <div className="card-elevated overflow-hidden">
        <header className="border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-bold">Ciclos orçamentários</h3>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Ano</th>
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Período</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && ciclos.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum ciclo. Crie o primeiro acima.</td></tr>
              )}
              {ciclos.map((c) => (
                <tr key={c.id} className={`border-t border-border ${cicloSel?.id === c.id ? "bg-accent/30" : ""}`}>
                  <td className="px-4 py-2.5 font-mono">{c.ano}</td>
                  <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline">{cicloStatusLabel[c.status] ?? c.status}</Badge></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "-"} → {c.data_fim ? new Date(c.data_fim).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => setCicloAtivoId(c.id)}>Selecionar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cicloSel && <ContratosNoCiclo ciclo={cicloSel} />}
    </div>
  );
}

function NovoCicloDialog() {
  const [open, setOpen] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const create = useCreateCiclo();
  const { toast } = useToast();
  const [form, setForm] = useState({
    ano: new Date().getFullYear() + 1,
    nome: `Orçamento ${new Date().getFullYear() + 1}`,
    data_inicio: `${new Date().getFullYear() + 1}-01-01`,
    data_fim: `${new Date().getFullYear() + 1}-12-31`,
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("empresa_id").eq("id", u.user.id).maybeSingle();
      if (p?.empresa_id) setEmpresaId(p.empresa_id);
    })();
  }, []);

  async function submit() {
    if (!empresaId) {
      toast({ title: "Seu usuário não tem empresa associada", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        empresa_id: empresaId,
        ano: Number(form.ano),
        nome: form.nome,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        status: "aberto",
      });
      toast({ title: "Ciclo criado" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Novo ciclo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo ciclo orçamentário</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Ano</Label><Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: +e.target.value })} /></div>
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
          <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContratosNoCiclo({ ciclo }: { ciclo: any }) {
  const { data: contratos = [] } = useContratos();
  const { data: orcamentos = [] } = useOrcamentosDoCiclo(ciclo.id);
  const gerar = useGerarOrcamento();
  const { toast } = useToast();

  const orcMap = new Map(orcamentos.map((o: any) => [o.contrato_id, o]));
  const ativos = contratos.filter((c: any) => c.status === "ativo" || c.status === "implantacao");

  async function handleGerar(contratoId: string) {
    try {
      const r = await gerar.mutateAsync({ contrato_id: contratoId, ciclo_id: ciclo.id });
      toast({
        title: "Orçamento gerado",
        description: `${r.meses_gerados} meses · Receita ${formatBRL(Number(r.receita_total))} · Margem ${formatBRL(Number(r.margem))}`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="card-elevated overflow-hidden">
      <header className="border-b border-border px-5 py-3">
        <h3 className="font-display text-sm font-bold">Contratos do ciclo · {ciclo.nome}</h3>
        <p className="text-xs text-muted-foreground">Gere orçamento automático com base nos postos, dissídios e parâmetros da empresa.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Contrato</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Faturamento/mês</th>
              <th className="px-4 py-2.5 text-right">Receita orçada</th>
              <th className="px-4 py-2.5 text-right">Margem</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {ativos.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum contrato ativo.</td></tr>}
            {ativos.map((c: any) => {
              const orc = orcMap.get(c.id) as any;
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <Link to={`/app/contratos/${c.id}`} className="font-semibold text-primary hover:underline">{c.numero}</Link>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{c.objeto}</p>
                  </td>
                  <td className="px-4 py-2.5"><Badge variant="outline">{statusLabel[c.status] ?? c.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatBRL(Number(c.faturamento_mensal))}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{orc ? formatBRL(Number(orc.valor_receita_total)) : "-"}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {orc ? <span className={Number(orc.margem_estimada) >= 0 ? "text-success" : "text-destructive"}>{formatBRL(Number(orc.margem_estimada))}</span> : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant={orc ? "outline" : "default"} onClick={() => handleGerar(c.id)} disabled={gerar.isPending}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> {orc ? "Regerar" : "Gerar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
