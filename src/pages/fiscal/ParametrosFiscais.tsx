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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Info } from "lucide-react";

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

// ===== Defaults estruturados =====
const defaults = {
  iss: { aliquota: 5, retido_na_fonte: false, codigo_servico: "", local_recolhimento: "prestador" as "prestador" | "tomador" },
  pis: { aliquota: 0.65, regime: "cumulativo" as "cumulativo" | "nao_cumulativo", base_reducao: 0 },
  cofins: { aliquota: 3.0, regime: "cumulativo" as "cumulativo" | "nao_cumulativo", base_reducao: 0 },
  irpj_csll: { presuncao_irpj: 32, presuncao_csll: 32, aliquota_irpj: 15, aliquota_csll: 9, adicional_irpj: 10, limite_adicional: 20000 },
  inss: { aliquota: 11, base: "mao_obra" as "mao_obra" | "valor_total" | "percentual_nf", percentual_base: 0, reter: true },
  irrf_csrf: { irrf: 1.5, csrf: 4.65, pis_retido: 0.65, cofins_retido: 3, csll_retido: 1, valor_minimo_retencao: 215.05 },
  folha: { cpp: 20, rat: 3, terceiros: 5.8, fap: 1.0, desoneracao: false, aliquota_desoneracao: 0 },
};

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

// ============ Subcomponentes auxiliares ============
function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberInput({ value, onChange, suffix, step = 0.01, min }: {
  value: number; onChange: (n: number) => void; suffix?: string; step?: number; min?: number;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={suffix ? "pr-10" : ""}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
      <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </div>
  );
}

// ============ Formulário Principal ============
function ParamForm({ empresaId, initial, onClose }:
  { empresaId: string; initial: ParamFiscal | null; onClose: () => void }) {
  const merge = <T,>(def: T, val: any): T => ({ ...def, ...(val ?? {}) });

  const [form, setForm] = useState(() => ({
    regime_tributario: initial?.regime_tributario ?? "lucro_presumido",
    vigencia_inicio: initial?.vigencia_inicio ?? new Date().toISOString().slice(0, 10),
    vigencia_fim: initial?.vigencia_fim ?? "",
    municipio_prestacao: initial?.municipio_prestacao ?? "",
    municipio_tomador: initial?.municipio_tomador ?? "",
    creditavel_pis_cofins: initial?.creditavel_pis_cofins ?? false,
    ativo: initial?.ativo ?? true,
    observacoes: initial?.observacoes ?? "",
    iss: merge(defaults.iss, initial?.regra_iss),
    pis: merge(defaults.pis, initial?.regra_pis),
    cofins: merge(defaults.cofins, initial?.regra_cofins),
    irpj_csll: merge(defaults.irpj_csll, initial?.regra_irpj_csll),
    inss: merge(defaults.inss, initial?.regra_retencao_inss),
    irrf_csrf: merge(defaults.irrf_csrf, initial?.regra_retencao_irrf_csrf),
    folha: merge(defaults.folha, initial?.regra_folha_cpp_rat_terceiros),
  }));

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const updateGroup = <K extends "iss" | "pis" | "cofins" | "irpj_csll" | "inss" | "irrf_csrf" | "folha">(
    key: K, patch: Partial<typeof form[K]>
  ) => setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

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
        regra_iss: form.iss,
        regra_pis: form.pis,
        regra_cofins: form.cofins,
        regra_irpj_csll: form.irpj_csll,
        regra_retencao_inss: form.inss,
        regra_retencao_irrf_csrf: form.irrf_csrf,
        regra_folha_cpp_rat_terceiros: form.folha,
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
    <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar parâmetro fiscal" : "Novo parâmetro fiscal"}</DialogTitle>
      </DialogHeader>

      {/* ===== Bloco geral ===== */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Regime tributário">
          <Select value={form.regime_tributario} onValueChange={(v) => update({ regime_tributario: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="flex items-end gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => update({ ativo: v })} />
            <Label className="text-xs">Ativo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.creditavel_pis_cofins} onCheckedChange={(v) => update({ creditavel_pis_cofins: v })} />
            <Label className="text-xs">PIS/COFINS creditável</Label>
          </div>
        </div>
        <Field label="Vigência início">
          <Input type="date" value={form.vigencia_inicio} onChange={(e) => update({ vigencia_inicio: e.target.value })} />
        </Field>
        <Field label="Vigência fim (opcional)" hint="Deixe em branco para vigência indeterminada.">
          <Input type="date" value={form.vigencia_fim} onChange={(e) => update({ vigencia_fim: e.target.value })} />
        </Field>
        <Field label="Município de prestação">
          <Input value={form.municipio_prestacao} onChange={(e) => update({ municipio_prestacao: e.target.value })} placeholder="Ex.: Porto Alegre/RS" />
        </Field>
        <Field label="Município do tomador">
          <Input value={form.municipio_tomador} onChange={(e) => update({ municipio_tomador: e.target.value })} placeholder="Ex.: Brasília/DF" />
        </Field>
      </div>

      {/* ===== Abas de impostos ===== */}
      <Tabs defaultValue="iss" className="mt-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="iss">ISS</TabsTrigger>
          <TabsTrigger value="pis">PIS</TabsTrigger>
          <TabsTrigger value="cofins">COFINS</TabsTrigger>
          <TabsTrigger value="irpj">IRPJ/CSLL</TabsTrigger>
          <TabsTrigger value="inss">INSS</TabsTrigger>
          <TabsTrigger value="irrf">IRRF/CSRF</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
        </TabsList>

        {/* ISS */}
        <TabsContent value="iss" className="mt-3">
          <SectionHeader title="ISS — Imposto Sobre Serviços" description="Configuração da alíquota municipal e regra de retenção." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alíquota">
              <NumberInput value={form.iss.aliquota} onChange={(n) => updateGroup("iss", { aliquota: n })} suffix="%" />
            </Field>
            <Field label="Código de serviço (LC 116)">
              <Input value={form.iss.codigo_servico} onChange={(e) => updateGroup("iss", { codigo_servico: e.target.value })} placeholder="Ex.: 7.02" />
            </Field>
            <Field label="Local de recolhimento" hint="Define o município onde o ISS é devido.">
              <Select value={form.iss.local_recolhimento} onValueChange={(v: any) => updateGroup("iss", { local_recolhimento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prestador">Município do prestador</SelectItem>
                  <SelectItem value="tomador">Município do tomador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.iss.retido_na_fonte} onCheckedChange={(v) => updateGroup("iss", { retido_na_fonte: v })} />
              <Label className="text-xs">Retido na fonte pelo tomador</Label>
            </div>
          </div>
        </TabsContent>

        {/* PIS */}
        <TabsContent value="pis" className="mt-3">
          <SectionHeader title="PIS" description="Cumulativo: 0,65% • Não-cumulativo: 1,65% (com direito a crédito)." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Regime">
              <Select value={form.pis.regime} onValueChange={(v: any) => updateGroup("pis", { regime: v, aliquota: v === "cumulativo" ? 0.65 : 1.65 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cumulativo">Cumulativo (0,65%)</SelectItem>
                  <SelectItem value="nao_cumulativo">Não-cumulativo (1,65%)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Alíquota">
              <NumberInput value={form.pis.aliquota} onChange={(n) => updateGroup("pis", { aliquota: n })} suffix="%" />
            </Field>
            <Field label="Redução de base de cálculo">
              <NumberInput value={form.pis.base_reducao} onChange={(n) => updateGroup("pis", { base_reducao: n })} suffix="%" />
            </Field>
          </div>
        </TabsContent>

        {/* COFINS */}
        <TabsContent value="cofins" className="mt-3">
          <SectionHeader title="COFINS" description="Cumulativo: 3% • Não-cumulativo: 7,6% (com direito a crédito)." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Regime">
              <Select value={form.cofins.regime} onValueChange={(v: any) => updateGroup("cofins", { regime: v, aliquota: v === "cumulativo" ? 3.0 : 7.6 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cumulativo">Cumulativo (3%)</SelectItem>
                  <SelectItem value="nao_cumulativo">Não-cumulativo (7,6%)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Alíquota">
              <NumberInput value={form.cofins.aliquota} onChange={(n) => updateGroup("cofins", { aliquota: n })} suffix="%" />
            </Field>
            <Field label="Redução de base de cálculo">
              <NumberInput value={form.cofins.base_reducao} onChange={(n) => updateGroup("cofins", { base_reducao: n })} suffix="%" />
            </Field>
          </div>
        </TabsContent>

        {/* IRPJ / CSLL */}
        <TabsContent value="irpj" className="mt-3">
          <SectionHeader title="IRPJ e CSLL" description="Percentuais de presunção (Lucro Presumido) e alíquotas." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Presunção IRPJ" hint="Serviços: 32% • Comércio: 8%">
              <NumberInput value={form.irpj_csll.presuncao_irpj} onChange={(n) => updateGroup("irpj_csll", { presuncao_irpj: n })} suffix="%" />
            </Field>
            <Field label="Presunção CSLL" hint="Serviços: 32% • Comércio: 12%">
              <NumberInput value={form.irpj_csll.presuncao_csll} onChange={(n) => updateGroup("irpj_csll", { presuncao_csll: n })} suffix="%" />
            </Field>
            <Field label="Alíquota IRPJ">
              <NumberInput value={form.irpj_csll.aliquota_irpj} onChange={(n) => updateGroup("irpj_csll", { aliquota_irpj: n })} suffix="%" />
            </Field>
            <Field label="Alíquota CSLL">
              <NumberInput value={form.irpj_csll.aliquota_csll} onChange={(n) => updateGroup("irpj_csll", { aliquota_csll: n })} suffix="%" />
            </Field>
            <Field label="Adicional IRPJ">
              <NumberInput value={form.irpj_csll.adicional_irpj} onChange={(n) => updateGroup("irpj_csll", { adicional_irpj: n })} suffix="%" />
            </Field>
            <Field label="Limite mensal p/ adicional" hint="Valor isento da alíquota adicional (mensal).">
              <NumberInput value={form.irpj_csll.limite_adicional} onChange={(n) => updateGroup("irpj_csll", { limite_adicional: n })} suffix="R$" step={1} />
            </Field>
          </div>
        </TabsContent>

        {/* INSS */}
        <TabsContent value="inss" className="mt-3">
          <SectionHeader title="Retenção de INSS" description="Aplicado na cessão de mão de obra e empreitada (Lei 8.212/91)." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alíquota">
              <NumberInput value={form.inss.aliquota} onChange={(n) => updateGroup("inss", { aliquota: n })} suffix="%" />
            </Field>
            <Field label="Base de cálculo">
              <Select value={form.inss.base} onValueChange={(v: any) => updateGroup("inss", { base: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mao_obra">Mão de obra destacada</SelectItem>
                  <SelectItem value="valor_total">Valor total da NF</SelectItem>
                  <SelectItem value="percentual_nf">Percentual fixo da NF</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.inss.base === "percentual_nf" && (
              <Field label="Percentual da NF">
                <NumberInput value={form.inss.percentual_base} onChange={(n) => updateGroup("inss", { percentual_base: n })} suffix="%" />
              </Field>
            )}
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.inss.reter} onCheckedChange={(v) => updateGroup("inss", { reter: v })} />
              <Label className="text-xs">Aplicar retenção</Label>
            </div>
          </div>
        </TabsContent>

        {/* IRRF / CSRF */}
        <TabsContent value="irrf" className="mt-3">
          <SectionHeader title="Retenções IRRF e CSRF (PIS/COFINS/CSLL)" description="Conforme Lei 10.833/03 (CSRF) e IN RFB 1.234." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="IRRF">
              <NumberInput value={form.irrf_csrf.irrf} onChange={(n) => updateGroup("irrf_csrf", { irrf: n })} suffix="%" />
            </Field>
            <Field label="CSRF total (PIS+COFINS+CSLL)">
              <NumberInput value={form.irrf_csrf.csrf} onChange={(n) => updateGroup("irrf_csrf", { csrf: n })} suffix="%" />
            </Field>
            <Field label="PIS retido">
              <NumberInput value={form.irrf_csrf.pis_retido} onChange={(n) => updateGroup("irrf_csrf", { pis_retido: n })} suffix="%" />
            </Field>
            <Field label="COFINS retido">
              <NumberInput value={form.irrf_csrf.cofins_retido} onChange={(n) => updateGroup("irrf_csrf", { cofins_retido: n })} suffix="%" />
            </Field>
            <Field label="CSLL retido">
              <NumberInput value={form.irrf_csrf.csll_retido} onChange={(n) => updateGroup("irrf_csrf", { csll_retido: n })} suffix="%" />
            </Field>
            <Field label="Valor mínimo p/ retenção" hint="Abaixo desse valor, dispensa retenção.">
              <NumberInput value={form.irrf_csrf.valor_minimo_retencao} onChange={(n) => updateGroup("irrf_csrf", { valor_minimo_retencao: n })} suffix="R$" />
            </Field>
          </div>
        </TabsContent>

        {/* Folha */}
        <TabsContent value="folha" className="mt-3">
          <SectionHeader title="Encargos sobre folha (CPP / RAT / Terceiros)" description="Contribuições patronais. RAT × FAP define o RAT ajustado." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPP — Contribuição Patronal Previdenciária">
              <NumberInput value={form.folha.cpp} onChange={(n) => updateGroup("folha", { cpp: n })} suffix="%" />
            </Field>
            <Field label="RAT (1, 2 ou 3%)">
              <NumberInput value={form.folha.rat} onChange={(n) => updateGroup("folha", { rat: n })} suffix="%" />
            </Field>
            <Field label="Terceiros (Sistema S, INCRA etc.)">
              <NumberInput value={form.folha.terceiros} onChange={(n) => updateGroup("folha", { terceiros: n })} suffix="%" />
            </Field>
            <Field label="FAP (multiplicador do RAT)" hint="Entre 0,5 e 2,0.">
              <NumberInput value={form.folha.fap} onChange={(n) => updateGroup("folha", { fap: n })} step={0.0001} />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.folha.desoneracao} onCheckedChange={(v) => updateGroup("folha", { desoneracao: v })} />
              <Label className="text-xs">Desoneração da folha (CPRB)</Label>
            </div>
            {form.folha.desoneracao && (
              <Field label="Alíquota CPRB sobre receita">
                <NumberInput value={form.folha.aliquota_desoneracao} onChange={(n) => updateGroup("folha", { aliquota_desoneracao: n })} suffix="%" />
              </Field>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4">
        <Field label="Observações">
          <Textarea value={form.observacoes} onChange={(e) => update({ observacoes: e.target.value })} rows={2} />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
