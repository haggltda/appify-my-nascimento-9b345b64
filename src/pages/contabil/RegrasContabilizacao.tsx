import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const EVENTOS = [
  { value: "nf_servico_autorizada", label: "EVT-005 NF de Serviço autorizada" },
  { value: "nf_produto_autorizada", label: "NF de Produto autorizada" },
  { value: "nf_entrada_estoque", label: "EVT-001 NF entrada material p/ estoque" },
  { value: "nf_entrada_consumo_contrato", label: "EVT-002 NF entrada consumo contrato" },
  { value: "nf_entrada_servico_admin", label: "EVT-003 NF entrada serviço admin" },
  { value: "baixa_pagar", label: "EVT-004 Pagamento fornecedor" },
  { value: "impostos_faturamento", label: "EVT-006 Tributos sobre faturamento" },
  { value: "baixa_receber", label: "EVT-007 Recebimento cliente" },
  { value: "provisao_folha", label: "EVT-008 Provisão folha operacional" },
  { value: "pagamento_folha", label: "EVT-009 Pagamento folha" },
  { value: "recolhimento_encargos_folha", label: "EVT-010 Recolhimento FGTS/INSS/Tributos folha" },
  { value: "mutuo_intercompany_saida", label: "EVT-011 Mútuo intercompany saída" },
  { value: "mutuo_intercompany_entrada", label: "EVT-012 Mútuo intercompany entrada" },
  { value: "rateio_admin_intercompany", label: "EVT-013 Rateio admin intercompany" },
  { value: "manual", label: "EVT-014 Ajuste contábil manual" },
  { value: "baixa_estoque_contrato", label: "EVT-015 Baixa de estoque para contrato" },
  { value: "provisao_irpj_csll", label: "Provisão IRPJ/CSLL" },
  { value: "provisao_ferias_13", label: "Provisão férias / 13°" },
  { value: "retencao_faturamento", label: "Retenções em faturamento" },
  { value: "imposto_recuperavel", label: "Imposto recuperável" },
  { value: "imposto_nao_recuperavel", label: "Imposto não recuperável" },
];

interface Conta { id: string; classificacao: string; descricao: string; tipo: string; }

export default function RegrasContabilizacao() {
  const { data: empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const contasQ = useQuery({
    queryKey: ["conta_contabil_analitica", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_contabil")
        .select("id,classificacao,descricao,tipo")
        .eq("empresa_id", empresaId!)
        .eq("tipo", "analitica")
        .eq("ativo", true)
        .order("classificacao");
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const regrasQ = useQuery({
    queryKey: ["regra_contabilizacao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regra_contabilizacao")
        .select("*, conta_debito:conta_debito_id(classificacao,descricao), conta_credito:conta_credito_id(classificacao,descricao)")
        .eq("empresa_id", empresaId!)
        .order("evento")
        .order("prioridade");
      if (error) throw error;
      return data ?? [];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("regra_contabilizacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Regra removida" });
      qc.invalidateQueries({ queryKey: ["regra_contabilizacao"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!empresaId) {
    return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Regras de Contabilização Automática</h2>
          <p className="text-sm text-muted-foreground">
            Define a partida (D/C) gerada automaticamente para cada evento financeiro/fiscal.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Nova regra</Button>
          </DialogTrigger>
          <NovaRegraForm empresaId={empresaId} contas={contasQ.data ?? []} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["regra_contabilizacao"] }); }} />
        </Dialog>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Evento</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Débito</th>
              <th className="px-3 py-2 text-left">Crédito</th>
              <th className="px-3 py-2 text-center">Contrato</th>
              <th className="px-3 py-2 text-center">CC</th>
              <th className="px-3 py-2 text-center">DRE</th>
              <th className="px-3 py-2 text-center">3-way</th>
              <th className="px-3 py-2 text-center">Ativo</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {regrasQ.isLoading && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {(regrasQ.data ?? []).length === 0 && !regrasQ.isLoading && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">Nenhuma regra configurada.</td></tr>
            )}
            {(regrasQ.data ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-3 py-2 text-xs font-mono">{r.codigo_evento ?? "-"}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{String(r.evento).replace(/_/g, " ")}</Badge></td>
                <td className="px-3 py-2">
                  <div>{r.descricao}</div>
                  {r.observacao && <div className="text-[11px] text-muted-foreground">{r.observacao}</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.conta_debito ? <><span className="font-mono">{r.conta_debito.classificacao}</span> {r.conta_debito.descricao}</> : <span className="text-muted-foreground italic">não vinculada</span>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.conta_credito ? <><span className="font-mono">{r.conta_credito.classificacao}</span> {r.conta_credito.descricao}</> : <span className="text-muted-foreground italic">não vinculada</span>}
                </td>
                <td className="px-3 py-2 text-center">{r.exige_contrato ? "✓" : "-"}</td>
                <td className="px-3 py-2 text-center">{r.exige_centro_custo ? "✓" : "-"}</td>
                <td className="px-3 py-2 text-center">{r.entra_dre ? "✓" : "-"}</td>
                <td className="px-3 py-2 text-center">{r.requer_3way_match ? "✓" : "-"}</td>
                <td className="px-3 py-2 text-center">{r.ativo ? "✓" : "-"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => remover.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NovaRegraForm({ empresaId, contas, onClose }: { empresaId: string; contas: Conta[]; onClose: () => void }) {
  const [form, setForm] = useState({
    evento: "nf_servico_autorizada",
    descricao: "",
    codigo_evento: "",
    gatilho: "",
    observacao: "",
    conta_debito_id: "",
    conta_credito_id: "",
    prioridade: 100,
    ativo: true,
    exige_contrato: false,
    exige_centro_custo: false,
    entra_dre: true,
    requer_3way_match: false,
    requer_pedido: false,
  });

  const salvar = async () => {
    if (!form.descricao || !form.conta_debito_id || !form.conta_credito_id) {
      toast({ title: "Preencha descrição e ambas as contas", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("regra_contabilizacao").insert({
      empresa_id: empresaId,
      evento: form.evento as any,
      descricao: form.descricao,
      codigo_evento: form.codigo_evento || null,
      gatilho: form.gatilho || null,
      observacao: form.observacao || null,
      conta_debito_id: form.conta_debito_id,
      conta_credito_id: form.conta_credito_id,
      prioridade: form.prioridade,
      ativo: form.ativo,
      exige_contrato: form.exige_contrato,
      exige_centro_custo: form.exige_centro_custo,
      entra_dre: form.entra_dre,
      requer_3way_match: form.requer_3way_match,
      requer_pedido: form.requer_pedido,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Regra criada" });
    onClose();
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova regra de contabilização</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Evento</Label>
          <Select value={form.evento} onValueChange={(v) => setForm({ ...form, evento: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EVENTOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Código (ex.: EVT-005)</Label>
          <Input value={form.codigo_evento} onChange={(e) => setForm({ ...form, codigo_evento: e.target.value })} placeholder="EVT-XXX" />
        </div>
        <div>
          <Label>Prioridade</Label>
          <Input type="number" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) })} />
        </div>
        <div className="col-span-2">
          <Label>Descrição (histórico padrão)</Label>
          <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Receita de serviços prestados" />
        </div>
        <div className="col-span-2">
          <Label>Gatilho (quando esta regra dispara)</Label>
          <Input value={form.gatilho} onChange={(e) => setForm({ ...form, gatilho: e.target.value })} placeholder="Ex.: NF saída autorizada" />
        </div>
        <div className="col-span-2">
          <Label>Conta DÉBITO</Label>
          <Select value={form.conta_debito_id} onValueChange={(v) => setForm({ ...form, conta_debito_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.classificacao} - {c.descricao}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Conta CRÉDITO</Label>
          <Select value={form.conta_credito_id} onValueChange={(v) => setForm({ ...form, conta_credito_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.classificacao} - {c.descricao}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-2 rounded-md border border-border/60 p-3">
          <div className="col-span-2 text-xs font-medium text-muted-foreground">Regras de validação / segregação</div>
          <div className="flex items-center gap-2"><Switch checked={form.exige_contrato} onCheckedChange={(v) => setForm({ ...form, exige_contrato: v })} /><Label>Exige contrato</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.exige_centro_custo} onCheckedChange={(v) => setForm({ ...form, exige_centro_custo: v })} /><Label>Exige centro de custo</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.entra_dre} onCheckedChange={(v) => setForm({ ...form, entra_dre: v })} /><Label>Afeta DRE (não só balanço/caixa)</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.requer_pedido} onCheckedChange={(v) => setForm({ ...form, requer_pedido: v })} /><Label>Requer pedido vinculado</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.requer_3way_match} onCheckedChange={(v) => setForm({ ...form, requer_3way_match: v })} /><Label>Requer 3-way match</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
        </div>

        <div className="col-span-2">
          <Label>Observação</Label>
          <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Notas auxiliares" />
        </div>
      </div>
      <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
