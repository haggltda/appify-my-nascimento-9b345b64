import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

const REGIMES = [
  { value: "lucro_real", label: "Lucro Real" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "mei", label: "MEI" },
  { value: "imune", label: "Imune" },
  { value: "isento", label: "Isento" },
];

interface ParamFiscal {
  id: string;
  empresa_id: string;
  regime_tributario: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  municipio_prestacao: string | null;
  municipio_tomador: string | null;
  regra_iss: any;
  regra_pis: any;
  regra_cofins: any;
  regra_irpj_csll: any;
  regra_retencao_inss: any;
  regra_retencao_irrf_csrf: any;
  regra_folha_cpp_rat_terceiros: any;
  creditavel_pis_cofins: boolean;
  conta_contabil_padrao_imposto_id: string | null;
  centro_custo_padrao_id: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export default function ParametrosFiscais() {
  const { data: empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ParamFiscal | null>(null);

  const paramsQ = useQuery({
    queryKey: ["parametro_fiscal", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametro_fiscal" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("vigencia_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ParamFiscal[];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parametro_fiscal" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Parâmetro removido" });
      qc.invalidateQueries({ queryKey: ["parametro_fiscal"] });
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
          <h2 className="text-lg font-semibold">Parâmetros Fiscais por Vigência</h2>
          <p className="text-sm text-muted-foreground">
            Regime tributário, retenções, créditos e regras de imposto da empresa por período de vigência.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" />Novo parâmetro
            </Button>
          </DialogTrigger>
          <ParamForm
            empresaId={empresaId}
            initial={editing}
            onClose={() => {
              setOpen(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["parametro_fiscal"] });
            }}
          />
        </Dialog>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Regime</th>
              <th className="px-3 py-2 text-left">Vigência</th>
              <th className="px-3 py-2 text-left">Município prestação</th>
              <th className="px-3 py-2 text-left">Município tomador</th>
              <th className="px-3 py-2 text-center">PIS/COFINS Cred.</th>
              <th className="px-3 py-2 text-center">Ativo</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paramsQ.isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {(paramsQ.data ?? []).length === 0 && !paramsQ.isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                Nenhum parâmetro fiscal cadastrado.
              </td></tr>
            )}
            {(paramsQ.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="px-3 py-2">
                  <Badge variant="outline" className="capitalize">
                    {REGIMES.find(r => r.value === p.regime_tributario)?.label ?? p.regime_tributario}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.vigencia_inicio} → {p.vigencia_fim ?? "vigente"}
                </td>
                <td className="px-3 py-2 text-xs">{p.municipio_prestacao ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{p.municipio_tomador ?? "—"}</td>
                <td className="px-3 py-2 text-center">{p.creditavel_pis_cofins ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center">{p.ativo ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remover.mutate(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParamForm({ empresaId, initial, onClose }:
  { empresaId: string; initial: ParamFiscal | null; onClose: () => void }) {
  const [form, setForm] = useState(() => ({
    regime_tributario: initial?.regime_tributario ?? "lucro_presumido",
    vigencia_inicio: initial?.vigencia_inicio ?? new Date().toISOString().slice(0, 10),
    vigencia_fim: initial?.vigencia_fim ?? "",
    municipio_prestacao: initial?.municipio_prestacao ?? "",
    municipio_tomador: initial?.municipio_tomador ?? "",
    creditavel_pis_cofins: initial?.creditavel_pis_cofins ?? false,
    ativo: initial?.ativo ?? true,
    observacoes: initial?.observacoes ?? "",
    regra_iss: JSON.stringify(initial?.regra_iss ?? { aliquota: 0, retido_na_fonte: false }, null, 2),
    regra_pis: JSON.stringify(initial?.regra_pis ?? { aliquota: 0.65 }, null, 2),
    regra_cofins: JSON.stringify(initial?.regra_cofins ?? { aliquota: 3.0 }, null, 2),
    regra_irpj_csll: JSON.stringify(initial?.regra_irpj_csll ?? { presuncao_irpj: 32, presuncao_csll: 32 }, null, 2),
    regra_retencao_inss: JSON.stringify(initial?.regra_retencao_inss ?? { aliquota: 11, base: "mao_obra" }, null, 2),
    regra_retencao_irrf_csrf: JSON.stringify(initial?.regra_retencao_irrf_csrf ?? { irrf: 1.5, csrf: 4.65 }, null, 2),
    regra_folha_cpp_rat_terceiros: JSON.stringify(initial?.regra_folha_cpp_rat_terceiros ?? { cpp: 20, rat: 3, terceiros: 5.8 }, null, 2),
  }));

  const parseJson = (s: string, name: string) => {
    try { return JSON.parse(s); } catch { throw new Error(`JSON inválido em ${name}`); }
  };

  const salvar = async () => {
    try {
      const payload: any = {
        empresa_id: empresaId,
        regime_tributario: form.regime_tributario,
        vigencia_inicio: form.vigencia_inicio,
        vigencia_fim: form.vigencia_fim || null,
        municipio_prestacao: form.municipio_prestacao || null,
        municipio_tomador: form.municipio_tomador || null,
        creditavel_pis_cofins: form.creditavel_pis_cofins,
        ativo: form.ativo,
        observacoes: form.observacoes || null,
        regra_iss: parseJson(form.regra_iss, "regra_iss"),
        regra_pis: parseJson(form.regra_pis, "regra_pis"),
        regra_cofins: parseJson(form.regra_cofins, "regra_cofins"),
        regra_irpj_csll: parseJson(form.regra_irpj_csll, "regra_irpj_csll"),
        regra_retencao_inss: parseJson(form.regra_retencao_inss, "regra_retencao_inss"),
        regra_retencao_irrf_csrf: parseJson(form.regra_retencao_irrf_csrf, "regra_retencao_irrf_csrf"),
        regra_folha_cpp_rat_terceiros: parseJson(form.regra_folha_cpp_rat_terceiros, "regra_folha_cpp_rat_terceiros"),
      };
      const { error } = initial
        ? await supabase.from("parametro_fiscal" as any).update(payload).eq("id", initial.id)
        : await supabase.from("parametro_fiscal" as any).insert(payload);
      if (error) throw error;
      toast({ title: initial ? "Parâmetro atualizado" : "Parâmetro criado" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar parâmetro fiscal" : "Novo parâmetro fiscal"}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Regime tributário</Label>
          <Select value={form.regime_tributario} onValueChange={(v) => setForm({ ...form, regime_tributario: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.creditavel_pis_cofins} onCheckedChange={(v) => setForm({ ...form, creditavel_pis_cofins: v })} />
            <Label>PIS/COFINS creditável</Label>
          </div>
        </div>
        <div>
          <Label>Vigência início</Label>
          <Input type="date" value={form.vigencia_inicio} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })} />
        </div>
        <div>
          <Label>Vigência fim (opcional)</Label>
          <Input type="date" value={form.vigencia_fim} onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })} />
        </div>
        <div>
          <Label>Município de prestação</Label>
          <Input value={form.municipio_prestacao} onChange={(e) => setForm({ ...form, municipio_prestacao: e.target.value })} placeholder="Ex.: Porto Alegre/RS" />
        </div>
        <div>
          <Label>Município do tomador</Label>
          <Input value={form.municipio_tomador} onChange={(e) => setForm({ ...form, municipio_tomador: e.target.value })} placeholder="Ex.: Brasília/DF" />
        </div>

        {[
          ["regra_iss", "Regra ISS"],
          ["regra_pis", "Regra PIS"],
          ["regra_cofins", "Regra COFINS"],
          ["regra_irpj_csll", "Regra IRPJ/CSLL"],
          ["regra_retencao_inss", "Retenção INSS"],
          ["regra_retencao_irrf_csrf", "Retenção IRRF/CSRF"],
          ["regra_folha_cpp_rat_terceiros", "Folha (CPP/RAT/Terceiros)"],
        ].map(([k, label]) => (
          <div key={k} className="col-span-2">
            <Label>{label} (JSON)</Label>
            <Textarea
              className="font-mono text-xs"
              rows={3}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value } as any)}
            />
          </div>
        ))}

        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
        </div>
      </div>
      <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
