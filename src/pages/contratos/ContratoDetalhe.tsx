import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, FileText, TrendingUp, Wallet, Briefcase, Receipt, Sparkles, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGerarOrcamento, useOrcamentoContratoByContrato, useLinhasOrcamento, useFluxoContrato, useCiclos } from "@/hooks/useOrcamento";
import {
  formatBRL,
  statusLabel,
  useContrato,
  useContratoPostos,
  useContratoDissidios,
  useContratoComprovacoes,
  useBaseDissidioCategorias,
  useAddPosto,
  useAddDissidio,
  useAddComprovacao,
} from "@/hooks/useContratos";

export default function ContratoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: contrato, isLoading } = useContrato(id);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando contrato…</div>;
  }
  if (!contrato) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/contratos/ativos"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={contrato.numero}
        module="Contratos"
        breadcrumb={["Contratos", "Detalhe"]}
        subtitle={contrato.objeto}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/contratos/ativos"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Status" v={statusLabel[contrato.status] ?? contrato.status} />
        <Kpi label="Valor total" v={formatBRL(Number(contrato.valor_total))} />
        <Kpi label="Faturamento mensal" v={formatBRL(Number(contrato.faturamento_mensal))} />
        <Kpi
          label="Vigência"
          v={`${new Date(contrato.vigencia_inicio).toLocaleDateString("pt-BR")} → ${new Date(
            contrato.vigencia_fim
          ).toLocaleDateString("pt-BR")}`}
        />
      </div>

      <Tabs defaultValue="orcamento" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="orcamento"><Briefcase className="mr-1.5 h-3.5 w-3.5" /> Orçamento</TabsTrigger>
          <TabsTrigger value="dre"><TrendingUp className="mr-1.5 h-3.5 w-3.5" /> DRE</TabsTrigger>
          <TabsTrigger value="fluxo"><Wallet className="mr-1.5 h-3.5 w-3.5" /> Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="dissidio"><FileText className="mr-1.5 h-3.5 w-3.5" /> Dissídio</TabsTrigger>
          <TabsTrigger value="comprovantes"><Receipt className="mr-1.5 h-3.5 w-3.5" /> Comprovantes</TabsTrigger>
        </TabsList>

        <TabsContent value="orcamento" className="mt-4 space-y-4">
          <OrcamentoTab contratoId={contrato.id} />
          <PostosTab contratoId={contrato.id} />
        </TabsContent>

        <TabsContent value="dre" className="mt-4">
          <DRETab contratoId={contrato.id} />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4">
          <FluxoTab contratoId={contrato.id} />
        </TabsContent>

        <TabsContent value="dissidio" className="mt-4">
          <DissidioTab contratoId={contrato.id} />
        </TabsContent>

        <TabsContent value="comprovantes" className="mt-4">
          <ComprovantesTab contratoId={contrato.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="card-elevated p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-base font-bold text-foreground">{v}</p>
    </div>
  );
}

function Placeholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="card-elevated mb-4 p-6">
      <h3 className="font-display text-sm font-bold">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}

/* ============================== POSTOS ============================== */
function PostosTab({ contratoId }: { contratoId: string }) {
  const { data: postos = [], isLoading } = useContratoPostos(contratoId);
  const { data: bases = [] } = useBaseDissidioCategorias();
  const add = useAddPosto();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    cargo: "",
    quantidade: 1,
    local: "",
    jornada: "12x36" as const,
    salario_base: 0,
    va: 0,
    vt: 0,
    uniformes: 0,
    epis: 0,
    insalubridade_pct: 0,
    periculosidade_pct: 0,
    base_dissidio_id: "",
  });

  async function submit() {
    try {
      await add.mutateAsync({
        contrato_id: contratoId,
        cargo: form.cargo,
        quantidade: Number(form.quantidade),
        local: form.local || null,
        jornada: form.jornada,
        salario_base: Number(form.salario_base),
        va: Number(form.va),
        vt: Number(form.vt),
        uniformes: Number(form.uniformes),
        epis: Number(form.epis),
        insalubridade_pct: Number(form.insalubridade_pct),
        periculosidade_pct: Number(form.periculosidade_pct),
        base_dissidio_id: form.base_dissidio_id || null,
      });
      toast({ title: "Posto adicionado" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="card-elevated overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-display text-sm font-bold">Postos do contrato ({postos.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Novo posto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Novo posto / cargo</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cargo *">
                <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </Field>
              <Field label="Quantidade">
                <Input type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: +e.target.value })} />
              </Field>
              <Field label="Local">
                <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
              </Field>
              <Field label="Jornada">
                <Select value={form.jornada} onValueChange={(v: any) => setForm({ ...form, jornada: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["12x36", "8h", "6h", "4h", "escala_5x2", "escala_6x1", "outra"].map((j) => (
                      <SelectItem key={j} value={j}>{j}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria sindical (dissídio base)">
                <Select value={form.base_dissidio_id} onValueChange={(v) => setForm({ ...form, base_dissidio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {bases.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.codigo} — {b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Salário base (R$)"><Input type="number" step="0.01" value={form.salario_base} onChange={(e) => setForm({ ...form, salario_base: +e.target.value })} /></Field>
              <Field label="VA (R$)"><Input type="number" step="0.01" value={form.va} onChange={(e) => setForm({ ...form, va: +e.target.value })} /></Field>
              <Field label="VT (R$)"><Input type="number" step="0.01" value={form.vt} onChange={(e) => setForm({ ...form, vt: +e.target.value })} /></Field>
              <Field label="Uniformes (R$)"><Input type="number" step="0.01" value={form.uniformes} onChange={(e) => setForm({ ...form, uniformes: +e.target.value })} /></Field>
              <Field label="EPIs (R$)"><Input type="number" step="0.01" value={form.epis} onChange={(e) => setForm({ ...form, epis: +e.target.value })} /></Field>
              <Field label="Insalubridade (%)"><Input type="number" step="0.01" value={form.insalubridade_pct} onChange={(e) => setForm({ ...form, insalubridade_pct: +e.target.value })} /></Field>
              <Field label="Periculosidade (%)"><Input type="number" step="0.01" value={form.periculosidade_pct} onChange={(e) => setForm({ ...form, periculosidade_pct: +e.target.value })} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={!form.cargo || add.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Cargo</th>
              <th className="px-4 py-2.5 text-right">Qtd</th>
              <th className="px-4 py-2.5">Jornada</th>
              <th className="px-4 py-2.5">Categoria sindical</th>
              <th className="px-4 py-2.5 text-right">Salário base</th>
              <th className="px-4 py-2.5 text-right">Insal/Peric</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && postos.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhum posto cadastrado.</td></tr>}
            {postos.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium">{p.cargo}</td>
                <td className="px-4 py-2.5 text-right">{p.quantidade}</td>
                <td className="px-4 py-2.5">{p.jornada}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {p.base_dissidio_categoria ? `${p.base_dissidio_categoria.codigo} — ${p.base_dissidio_categoria.nome}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{formatBRL(Number(p.salario_base))}</td>
                <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                  {Number(p.insalubridade_pct) || 0}% / {Number(p.periculosidade_pct) || 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== DISSIDIO ============================== */
function DissidioTab({ contratoId }: { contratoId: string }) {
  const { data: dissidios = [], isLoading } = useContratoDissidios(contratoId);
  const { data: postos = [] } = useContratoPostos(contratoId);
  const { data: bases = [] } = useBaseDissidioCategorias();
  const add = useAddDissidio();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    competencia: new Date().toISOString().slice(0, 10),
    criterio: "cct" as const,
    base_calculo: "salario_base" as const,
    percentual: 0,
    valor_fixo: 0,
    indice_referencia: "",
    documento_referencia: "",
    contrato_posto_id: "",
    base_dissidio_id: "",
    observacoes: "",
  });

  async function submit() {
    try {
      await add.mutateAsync({
        contrato_id: contratoId,
        competencia: form.competencia,
        criterio: form.criterio,
        base_calculo: form.base_calculo,
        percentual: Number(form.percentual),
        valor_fixo: Number(form.valor_fixo),
        indice_referencia: form.indice_referencia || null,
        documento_referencia: form.documento_referencia || null,
        contrato_posto_id: form.contrato_posto_id || null,
        base_dissidio_id: form.base_dissidio_id || null,
        observacoes: form.observacoes || null,
      });
      toast({ title: "Dissídio registrado" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="card-elevated overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h3 className="font-display text-sm font-bold">Dissídios e reajustes ({dissidios.length})</h3>
          <p className="text-xs text-muted-foreground">Aplique reajustes globais ou por posto específico.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Novo dissídio</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Registrar dissídio / reajuste</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Competência (mês de aplicação) *">
                <Input type="date" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
              </Field>
              <Field label="Critério">
                <Select value={form.criterio} onValueChange={(v: any) => setForm({ ...form, criterio: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["indice", "percentual_fixo", "cct", "acordo_coletivo", "judicial"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Base de cálculo">
                <Select value={form.base_calculo} onValueChange={(v: any) => setForm({ ...form, base_calculo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salario_base">Salário base</SelectItem>
                    <SelectItem value="total_remuneracao">Total da remuneração</SelectItem>
                    <SelectItem value="posto">Custo do posto</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Percentual (%)">
                <Input type="number" step="0.0001" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: +e.target.value })} />
              </Field>
              <Field label="Valor fixo (R$)">
                <Input type="number" step="0.01" value={form.valor_fixo} onChange={(e) => setForm({ ...form, valor_fixo: +e.target.value })} />
              </Field>
              <Field label="Índice (ex: INPC, IPCA)">
                <Input value={form.indice_referencia} onChange={(e) => setForm({ ...form, indice_referencia: e.target.value })} />
              </Field>
              <Field label="Posto específico (opcional)">
                <Select value={form.contrato_posto_id} onValueChange={(v) => setForm({ ...form, contrato_posto_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Todos os postos" /></SelectTrigger>
                  <SelectContent>
                    {postos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.cargo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria base (opcional)">
                <Select value={form.base_dissidio_id} onValueChange={(v) => setForm({ ...form, base_dissidio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.codigo} — {b.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Documento de referência (CCT/sentença)" full>
                <Input value={form.documento_referencia} onChange={(e) => setForm({ ...form, documento_referencia: e.target.value })} />
              </Field>
              <Field label="Observações" full>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={add.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Competência</th>
              <th className="px-4 py-2.5">Critério</th>
              <th className="px-4 py-2.5">Posto</th>
              <th className="px-4 py-2.5">Categoria</th>
              <th className="px-4 py-2.5 text-right">% / Valor</th>
              <th className="px-4 py-2.5">Documento</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && dissidios.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhum dissídio registrado.</td></tr>}
            {dissidios.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-2.5">{new Date(d.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</td>
                <td className="px-4 py-2.5">{d.criterio}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.contrato_posto?.cargo ?? "Todos"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.base_dissidio_categoria?.codigo ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {Number(d.percentual) > 0 ? `${Number(d.percentual)}%` : formatBRL(Number(d.valor_fixo))}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.documento_referencia ?? d.indice_referencia ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== COMPROVANTES ============================== */
const TIPO_COMPROVACAO = [
  { v: "empenho", l: "Empenho" },
  { v: "ordem_servico", l: "Ordem de Serviço" },
  { v: "aditivo", l: "Aditivo" },
  { v: "apostilamento", l: "Apostilamento" },
  { v: "nota_fiscal", l: "Nota Fiscal" },
  { v: "contrato_assinado", l: "Contrato assinado" },
  { v: "publicacao_doe", l: "Publicação DOE" },
  { v: "outro", l: "Outro" },
];

function ComprovantesTab({ contratoId }: { contratoId: string }) {
  const { data: items = [], isLoading } = useContratoComprovacoes(contratoId);
  const add = useAddComprovacao();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "empenho" as const,
    numero: "",
    data_documento: new Date().toISOString().slice(0, 10),
    valor: 0,
    descricao: "",
    observacoes: "",
  });

  const totalPorTipo = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i: any) => { m[i.tipo] = (m[i.tipo] ?? 0) + Number(i.valor); });
    return m;
  }, [items]);

  async function submit() {
    try {
      await add.mutateAsync({
        contrato_id: contratoId,
        tipo: form.tipo,
        numero: form.numero,
        data_documento: form.data_documento,
        valor: Number(form.valor),
        descricao: form.descricao || null,
        observacoes: form.observacoes || null,
      });
      toast({ title: "Comprovante registrado" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {TIPO_COMPROVACAO.slice(0, 4).map((t) => (
          <div key={t.v} className="card-elevated p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.l}</p>
            <p className="mt-1 font-display text-lg font-bold">{formatBRL(totalPorTipo[t.v] ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="card-elevated overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-bold">Comprovantes ({items.length})</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Novo comprovante</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Registrar comprovante</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo *">
                  <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_COMPROVACAO.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Número *"><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field>
                <Field label="Data"><Input type="date" value={form.data_documento} onChange={(e) => setForm({ ...form, data_documento: e.target.value })} /></Field>
                <Field label="Valor (R$)"><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: +e.target.value })} /></Field>
                <Field label="Descrição" full><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
                <Field label="Observações" full><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={!form.numero || add.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Número</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="px-4 py-2.5">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum comprovante.</td></tr>}
              {items.map((i: any) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-2.5"><span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{TIPO_COMPROVACAO.find(t => t.v === i.tipo)?.l ?? i.tipo}</span></td>
                  <td className="px-4 py-2.5 font-mono">{i.numero}</td>
                  <td className="px-4 py-2.5">{new Date(i.data_documento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatBRL(Number(i.valor))}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{i.descricao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ============================== ORÇAMENTO ============================== */
function OrcamentoTab({ contratoId }: { contratoId: string }) {
  const { data: ciclos = [] } = useCiclos();
  const [cicloId, setCicloId] = useState<string>("");
  const cicloAtivo = cicloId || ciclos[0]?.id;
  const { data: orc } = useOrcamentoContratoByContrato(contratoId, cicloAtivo);
  const { data: linhas = [] } = useLinhasOrcamento(orc?.id);
  const gerar = useGerarOrcamento();
  const { toast } = useToast();

  const matriz = useMemo(() => {
    const map = new Map<string, { dre: any; valores: Record<string, { v: number; locked: boolean }> }>();
    const competencias = new Set<string>();
    linhas.forEach((l: any) => {
      const key = l.dre_linha_id;
      const c = l.competencia.slice(0, 7);
      competencias.add(c);
      if (!map.has(key)) map.set(key, { dre: l.dre, valores: {} });
      const cur = map.get(key)!.valores[c] ?? { v: 0, locked: false };
      cur.v += Number(l.valor_previsto);
      cur.locked = cur.locked || l.locked;
      map.get(key)!.valores[c] = cur;
    });
    const compsArr = Array.from(competencias).sort();
    const rows = Array.from(map.values()).sort((a, b) => (a.dre?.ordem ?? 0) - (b.dre?.ordem ?? 0));
    return { rows, comps: compsArr };
  }, [linhas]);

  async function handleGerar() {
    if (!cicloAtivo) {
      toast({ title: "Crie um ciclo orçamentário primeiro", variant: "destructive" });
      return;
    }
    try {
      const r = await gerar.mutateAsync({ contrato_id: contratoId, ciclo_id: cicloAtivo });
      toast({ title: "Orçamento gerado", description: `${r.meses_gerados} meses · margem ${formatBRL(Number(r.margem))}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="card-elevated overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-5 py-3 gap-3">
        <div>
          <h3 className="font-display text-sm font-bold">Orçamento contratual</h3>
          <p className="text-xs text-muted-foreground">Linhas DRE × competência. 🔒 indica linha gerada e travada.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cicloAtivo ?? ""} onValueChange={setCicloId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Selecione o ciclo" /></SelectTrigger>
            <SelectContent>
              {ciclos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleGerar} disabled={gerar.isPending || !cicloAtivo}>
            <Sparkles className="mr-1 h-3.5 w-3.5" /> {orc ? "Regerar" : "Gerar"}
          </Button>
        </div>
      </header>
      {orc && (
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Receita orçada</p><p className="font-mono text-sm">{formatBRL(Number(orc.valor_receita_total))}</p></div>
          <div className="bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Custo orçado</p><p className="font-mono text-sm">{formatBRL(Number(orc.valor_custo_total))}</p></div>
          <div className="bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">Margem</p><p className={`font-mono text-sm ${Number(orc.margem_estimada) >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(Number(orc.margem_estimada))}</p></div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="sticky left-0 bg-muted/50 px-4 py-2.5">Linha DRE</th>
              {matriz.comps.map((c) => <th key={c} className="px-2 py-2.5 text-right whitespace-nowrap">{c.slice(5)}/{c.slice(2, 4)}</th>)}
            </tr>
          </thead>
          <tbody>
            {matriz.rows.length === 0 && <tr><td colSpan={matriz.comps.length + 1} className="px-4 py-8 text-center text-muted-foreground">Nenhuma linha — clique em Gerar.</td></tr>}
            {matriz.rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="sticky left-0 bg-card px-4 py-2 text-xs font-medium">
                  <span className="text-muted-foreground mr-1">{r.dre?.codigo}</span>{r.dre?.descricao}
                </td>
                {matriz.comps.map((c) => {
                  const cell = r.valores[c];
                  return (
                    <td key={c} className="px-2 py-2 text-right font-mono text-xs">
                      {cell ? (
                        <span className="inline-flex items-center gap-1">
                          {cell.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                          {formatBRL(cell.v)}
                        </span>
                      ) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== DRE ============================== */
function DRETab({ contratoId }: { contratoId: string }) {
  const { data: orc } = useOrcamentoContratoByContrato(contratoId);
  const { data: linhas = [] } = useLinhasOrcamento(orc?.id);

  // Agrupa por natureza × competência
  const byNature = new Map<string, Record<string, number>>();
  const comps = new Set<string>();
  linhas.forEach((l: any) => {
    const c = l.competencia.slice(0, 7);
    comps.add(c);
    const nat = l.dre?.natureza ?? "outros";
    if (!byNature.has(nat)) byNature.set(nat, {});
    byNature.get(nat)![c] = (byNature.get(nat)![c] ?? 0) + Number(l.valor_previsto);
  });
  const compsArr = Array.from(comps).sort();
  const naturezas = ["receita", "deducao", "custo", "despesa"];
  const sinal: Record<string, number> = { receita: 1, deducao: -1, custo: -1, despesa: -1 };

  if (!orc) return <div className="card-elevated p-6 text-sm text-muted-foreground">Gere o orçamento na aba Orçamento.</div>;

  return (
    <div className="card-elevated overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-muted/50 px-4 py-2.5">Grupo</th>
            {compsArr.map((c) => <th key={c} className="px-2 py-2.5 text-right">{c.slice(5)}/{c.slice(2, 4)}</th>)}
          </tr>
        </thead>
        <tbody>
          {naturezas.map((nat) => {
            const row = byNature.get(nat);
            if (!row) return null;
            return (
              <tr key={nat} className="border-t border-border">
                <td className="sticky left-0 bg-card px-4 py-2 text-xs font-semibold capitalize">{nat}</td>
                {compsArr.map((c) => (
                  <td key={c} className="px-2 py-2 text-right font-mono text-xs">{formatBRL((row[c] ?? 0) * sinal[nat])}</td>
                ))}
              </tr>
            );
          })}
          <tr className="border-t-2 border-foreground/30 bg-muted/30">
            <td className="sticky left-0 bg-muted/30 px-4 py-2 text-xs font-bold">Resultado</td>
            {compsArr.map((c) => {
              const total = naturezas.reduce((acc, nat) => acc + (byNature.get(nat)?.[c] ?? 0) * sinal[nat], 0);
              return <td key={c} className={`px-2 py-2 text-right font-mono text-xs font-bold ${total >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(total)}</td>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ============================== FLUXO ============================== */
function FluxoTab({ contratoId }: { contratoId: string }) {
  const { data: fluxo = [], isLoading } = useFluxoContrato(contratoId);

  // Agrupa por mês
  const map = new Map<string, { entrada: number; saida: number }>();
  fluxo.forEach((f: any) => {
    const c = f.data_prevista.slice(0, 7);
    if (!map.has(c)) map.set(c, { entrada: 0, saida: 0 });
    const slot = map.get(c)!;
    if (f.tipo === "entrada") slot.entrada += Number(f.valor);
    else slot.saida += Number(f.valor);
  });
  const meses = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  if (isLoading) return <div className="card-elevated p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (fluxo.length === 0) return <div className="card-elevated p-6 text-sm text-muted-foreground">Sem fluxo projetado. Gere o orçamento.</div>;

  let saldo = 0;
  return (
    <div className="card-elevated overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Competência</th>
            <th className="px-4 py-2.5 text-right">Entradas</th>
            <th className="px-4 py-2.5 text-right">Saídas</th>
            <th className="px-4 py-2.5 text-right">Líquido</th>
            <th className="px-4 py-2.5 text-right">Saldo acumulado</th>
          </tr>
        </thead>
        <tbody>
          {meses.map(([c, v]) => {
            const liq = v.entrada - v.saida;
            saldo += liq;
            return (
              <tr key={c} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{c}</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-success">{formatBRL(v.entrada)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-destructive">{formatBRL(v.saida)}</td>
                <td className={`px-4 py-2 text-right font-mono text-xs ${liq >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(liq)}</td>
                <td className={`px-4 py-2 text-right font-mono text-xs font-semibold ${saldo >= 0 ? "text-foreground" : "text-destructive"}`}>{formatBRL(saldo)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
