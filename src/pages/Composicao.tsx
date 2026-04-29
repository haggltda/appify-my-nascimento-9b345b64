import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { licitacoes as licitacoesBase } from "@/data/licitacoes";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  PieChart,
  Briefcase,
  Calculator,
  Package,
  TrendingUp,
  Save,
  Send,
  Check,
  Building2,
  MapPin,
  Plus,
  Trash2,
  BarChart3,
  Wallet,
  LineChart as LineChartIcon,
} from "lucide-react";
import { formatBRL } from "@/data/contratos";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Posto {
  id: string;
  cargo: string;
  qtd: number;
  local: string;
  salario: number;
  va: number;
  vt: number;
  uniformes: number;
  epis: number;
  insalubridade: number;
}

const postosIniciais: Posto[] = [
  { id: "p1", cargo: "Agente de limpeza I", qtd: 84, local: "Zona Sul", salario: 1850, va: 480, vt: 240, uniformes: 95, epis: 145, insalubridade: 20 },
  { id: "p2", cargo: "Encarregado operacional", qtd: 12, local: "Zona Sul — Base SLU", salario: 4200, va: 480, vt: 240, uniformes: 95, epis: 145, insalubridade: 20 },
];

const verbasFolhaIniciais = [
  { rubrica: "INSS patronal", percentual: 20.0 },
  { rubrica: "FGTS", percentual: 8.0 },
  { rubrica: "RAT/SAT", percentual: 3.0 },
  { rubrica: "Sistema S", percentual: 5.8 },
  { rubrica: "13º + provisão férias + 1/3", percentual: 11.11 },
  { rubrica: "Provisão multa rescisória", percentual: 4.0 },
];

type AbaId = "postos" | "encargos" | "insumos" | "impostos" | "dre" | "caixa" | "grafico";

interface AbaDef {
  id: AbaId;
  label: string;
  icon: any;
  isAnalytic?: boolean;
}

const abas: AbaDef[] = [
  { id: "postos", label: "Postos e Salários", icon: Briefcase },
  { id: "encargos", label: "Encargos e Benefícios", icon: Calculator },
  { id: "insumos", label: "Insumos e Operação", icon: Package },
  { id: "impostos", label: "Impostos e Margem", icon: TrendingUp },
  { id: "dre", label: "DRE da Licitação", icon: BarChart3, isAnalytic: true },
  { id: "caixa", label: "Caixa Mensal", icon: Wallet, isAnalytic: true },
  { id: "grafico", label: "Orçado x Realizado", icon: LineChartIcon, isAnalytic: true },
];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Composicao() {
  const [searchParams] = useSearchParams();
  const licitacaoIdParam = searchParams.get("licitacao");
  const contratoIdParam = searchParams.get("contrato");
  const [postos, setPostos] = useState<Posto[]>(postosIniciais);
  const [verbas, setVerbas] = useState(verbasFolhaIniciais);
  const [empresa, setEmpresa] = useState("NSV — Nascimento Serviços Ltda.");
  const [licitacao, setLicitacao] = useState("PE 044/2025 · Limpeza urbana e coleta seletiva");
  const [origem, setOrigem] = useState<"manual" | "pipeline">("manual");

  useEffect(() => {
    if (!licitacaoIdParam && !contratoIdParam) return;
    const l = licitacoesBase.find((x) => x.id === licitacaoIdParam);
    if (l) {
      setLicitacao(`${l.numero} · ${l.objeto}`);
      setEmpresa(l.empresa);
      setOrigem("pipeline");
    } else if (contratoIdParam) {
      setLicitacao(`Contrato ${contratoIdParam}`);
      setOrigem("pipeline");
    }
  }, [licitacaoIdParam, contratoIdParam]);

  const [margem, setMargem] = useState(12);
  const [tributos, setTributos] = useState(14.25);
  const [custoIndireto, setCustoIndireto] = useState(8.5);

  const [abaAtiva, setAbaAtiva] = useState<AbaId>("postos");
  const [validas, setValidas] = useState<Record<AbaId, boolean>>({
    postos: false,
    encargos: false,
    insumos: false,
    impostos: false,
    dre: true,
    caixa: true,
    grafico: true,
  });

  const marcarValida = (id: AbaId) => setValidas((v) => (v[id] ? v : { ...v, [id]: true }));

  const todasValidas = validas.postos && validas.encargos && validas.insumos && validas.impostos;

  const totais = useMemo(() => {
    const totalEncargosPct = verbas.reduce((a, v) => a + v.percentual, 0);
    const beneficiosMes = postos.reduce((s, p) => s + (p.va + p.vt + p.uniformes + p.epis) * p.qtd, 0);
    const folhaMes = postos.reduce((s, p) => {
      const folha = p.salario * (1 + totalEncargosPct / 100);
      const insalub = (p.salario * p.insalubridade) / 100;
      return s + (folha + insalub) * p.qtd;
    }, 0);
    const custoDiretoMes = folhaMes + beneficiosMes;
    const indiretos = (custoDiretoMes * custoIndireto) / 100;
    const subtotal = custoDiretoMes + indiretos;
    const trib = (subtotal * tributos) / 100;
    const lucro = (subtotal * margem) / 100;
    const total = subtotal + trib + lucro;
    const bdi = custoDiretoMes > 0 ? ((total - custoDiretoMes) / custoDiretoMes) * 100 : 0;
    return { custoDiretoMes, folhaMes, beneficiosMes, indiretos, subtotal, trib, lucro, total, bdi, totalEncargosPct };
  }, [postos, margem, tributos, custoIndireto, verbas]);

  // Projeção 12 meses — DRE e Caixa (orçado x realizado mock derivado)
  const projecao = useMemo(() => {
    const seed = postos.length + Math.round(margem * 10);
    const rand = (i: number) => {
      const x = Math.sin((seed + i) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return MESES.map((mes, i) => {
      const receita = totais.total;
      const folha = totais.folhaMes;
      const beneficios = totais.beneficiosMes;
      const indiretos = totais.indiretos;
      const tributos = totais.trib;
      const custoTotal = folha + beneficios + indiretos;
      const lucroOrcado = receita - custoTotal - tributos;
      // Realizado: meses passados (i<6) com variação ±10%
      const realizado = i < 6;
      const fatorRec = 1 + (rand(i) - 0.5) * 0.18;
      const fatorCusto = 1 + (rand(i + 50) - 0.5) * 0.12;
      const recReal = realizado ? receita * fatorRec : 0;
      const custoReal = realizado ? custoTotal * fatorCusto : 0;
      const tribReal = realizado ? tributos * fatorRec : 0;
      const lucroReal = realizado ? recReal - custoReal - tribReal : 0;
      return {
        mes,
        receitaOrc: receita,
        custoOrc: custoTotal,
        tribOrc: tributos,
        lucroOrc: lucroOrcado,
        receitaReal: recReal,
        custoReal,
        tribReal,
        lucroReal,
        caixaOrc: receita - custoTotal - tributos,
        caixaReal: realizado ? recReal - custoReal - tribReal : 0,
        realizado,
      };
    });
  }, [totais, postos.length, margem]);

  const dreTotais = useMemo(() => {
    const sum = (k: keyof typeof projecao[number]) => projecao.reduce((s, p) => s + (p[k] as number), 0);
    return {
      receitaOrc: sum("receitaOrc"),
      custoOrc: sum("custoOrc"),
      tribOrc: sum("tribOrc"),
      lucroOrc: sum("lucroOrc"),
      receitaReal: sum("receitaReal"),
      custoReal: sum("custoReal"),
      tribReal: sum("tribReal"),
      lucroReal: sum("lucroReal"),
    };
  }, [projecao]);

  const addPosto = () => {
    setPostos((p) => [
      ...p,
      { id: `p${Date.now()}`, cargo: "Novo cargo", qtd: 1, local: "", salario: 0, va: 0, vt: 0, uniformes: 0, epis: 0, insalubridade: 0 },
    ]);
    marcarValida("postos");
  };
  const removePosto = (id: string) => {
    setPostos((p) => p.filter((x) => x.id !== id));
    marcarValida("postos");
  };
  const updatePosto = (id: string, k: keyof Posto, v: any) => {
    setPostos((p) => p.map((x) => (x.id === id ? { ...x, [k]: typeof x[k] === "number" ? Number(v) || 0 : v } : x)));
    marcarValida("postos");
  };

  const updateVerba = (idx: number, valor: number) => {
    setVerbas((vs) => vs.map((v, i) => (i === idx ? { ...v, percentual: valor } : v)));
    marcarValida("encargos");
  };

  const enviarControladoria = () => {
    if (!todasValidas) return;
    toast.success("Composição enviada à Controladoria", {
      description: `${licitacao} · BDI ${totais.bdi.toFixed(2)}% · ${formatBRL(totais.total)}/mês`,
    });
    // Reset (volta para grid inicial = aba postos)
    setValidas({ postos: false, encargos: false, insumos: false, impostos: false, dre: true, caixa: true, grafico: true });
    setAbaAtiva("postos");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Composição de Custos & BDI"
        breadcrumb={["Operação", "Composição & BDI"]}
        subtitle="Detalhamento por posto, verbas da folha, tributos e definição da margem de lucro — fase de licitação."
        actions={
          <>
            <button
              onClick={() => toast("Rascunho salvo", { description: "Você pode continuar mais tarde." })}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              <Save className="h-3.5 w-3.5" /> Salvar rascunho
            </button>
            <button
              disabled={!todasValidas}
              onClick={enviarControladoria}
              className={`btn-relief inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-all ${
                todasValidas
                  ? "bg-gradient-accent text-accent-foreground"
                  : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
              }`}
            >
              <Send className="h-3.5 w-3.5" /> Enviar à Controladoria
            </button>
          </>
        }
      />

      {origem === "pipeline" && (
        <div className="card-elevated flex items-center gap-3 border-l-4 border-l-primary bg-primary/5 px-4 py-3 text-sm">
          <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Vindo do Pipeline</span>
          <span className="font-medium">{licitacao}</span>
          <span className="ml-auto text-xs text-muted-foreground">Empresa: <strong className="text-foreground">{empresa}</strong></span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Área central com abas */}
        <div className="space-y-4">
          {/* Identificação fixa */}
          <section className="card-elevated p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
              <Building2 className="h-4 w-4 text-primary" /> Identificação
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Empresa responsável" value={empresa} />
              <Field label="Licitação vinculada" value={licitacao} />
            </div>
          </section>

          {/* Tabs — Composição (entrada) + Análise */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-sunken p-1">
              {abas.filter(a => !a.isAnalytic).map((a) => {
                const ativa = abaAtiva === a.id;
                const ok = validas[a.id];
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAbaAtiva(a.id)}
                    className={`relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                      ativa ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{a.label}</span>
                    {ok && (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-success-foreground">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dossiê analítico</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-1 shadow-[0_4px_14px_-6px_hsl(var(--primary)/0.25)]">
              {abas.filter(a => a.isAnalytic).map((a) => {
                const ativa = abaAtiva === a.id;
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAbaAtiva(a.id)}
                    className={`relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                      ativa
                        ? "bg-card text-primary shadow-md ring-1 ring-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo da aba */}
          {abaAtiva === "postos" && (
            <section className="card-elevated p-5">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <Briefcase className="h-4 w-4 text-primary" /> Postos de trabalho
                </h2>
                <button onClick={addPosto} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
                  <Plus className="h-3.5 w-3.5" /> Adicionar posto
                </button>
              </header>

              <div className="space-y-4">
                {postos.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-surface-sunken p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <input
                          value={p.cargo}
                          onChange={(e) => updatePosto(p.id, "cargo", e.target.value)}
                          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
                        />
                        <div className="w-20">
                          <input
                            type="number"
                            value={p.qtd}
                            onChange={(e) => updatePosto(p.id, "qtd", e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-center text-sm font-semibold outline-none focus:border-primary"
                          />
                          <p className="mt-1 text-center text-[10px] uppercase text-muted-foreground">Qtd</p>
                        </div>
                      </div>
                      <button onClick={() => removePosto(p.id)} className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive-soft">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mb-3 flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={p.local}
                        onChange={(e) => updatePosto(p.id, "local", e.target.value)}
                        placeholder="Local de prestação"
                        className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
                      <Money label="Salário base" v={p.salario} onChange={(v) => updatePosto(p.id, "salario", v)} />
                      <Money label="Insalub. (%)" v={p.insalubridade} onChange={(v) => updatePosto(p.id, "insalubridade", v)} />
                      <Money label="VT (R$)" v={p.vt} onChange={(v) => updatePosto(p.id, "vt", v)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {abaAtiva === "encargos" && (
            <section className="card-elevated p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
                <Calculator className="h-4 w-4 text-primary" /> Encargos sobre a folha & benefícios
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Rubrica</th>
                    <th className="px-3 py-2 text-right">Percentual</th>
                  </tr>
                </thead>
                <tbody>
                  {verbas.map((v, i) => (
                    <tr key={v.rubrica} className="border-b border-border/60">
                      <td className="px-3 py-2.5 font-medium">{v.rubrica}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          step={0.01}
                          value={v.percentual}
                          onChange={(e) => updateVerba(i, Number(e.target.value) || 0)}
                          className="ml-auto block h-8 w-24 rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary-soft/60">
                    <td className="px-3 py-2.5 font-bold">Total de encargos</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                      {totais.totalEncargosPct.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>

              <h3 className="mb-3 mt-6 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Benefícios por posto
              </h3>
              <div className="space-y-2">
                {postos.map((p) => (
                  <div key={p.id} className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface-sunken p-3">
                    <div className="col-span-3 text-xs font-semibold">{p.cargo}</div>
                    <Money label="VA" v={p.va} onChange={(v) => updatePosto(p.id, "va", v)} />
                    <Money label="VT" v={p.vt} onChange={(v) => updatePosto(p.id, "vt", v)} />
                    <Money label="Insalub %" v={p.insalubridade} onChange={(v) => updatePosto(p.id, "insalubridade", v)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {abaAtiva === "insumos" && (
            <section className="card-elevated p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
                <Package className="h-4 w-4 text-primary" /> Insumos e operação
              </h2>
              <div className="space-y-3">
                {postos.map((p) => (
                  <div key={p.id} className="rounded-md border border-border bg-surface-sunken p-3">
                    <p className="mb-2 text-xs font-semibold">{p.cargo} · {p.qtd} posto(s)</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Money label="Uniformes (R$/mês)" v={p.uniformes} onChange={(v) => updatePosto(p.id, "uniformes", v)} />
                      <Money label="EPIs (R$/mês)" v={p.epis} onChange={(v) => updatePosto(p.id, "epis", v)} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-info/30 bg-info-soft px-3 py-2.5 text-[12px] text-info">
                Os valores de insumos compõem o custo direto e impactam diretamente o BDI consolidado.
              </div>
            </section>
          )}

          {abaAtiva === "impostos" && (
            <section className="card-elevated p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
                <TrendingUp className="h-4 w-4 text-accent" /> Tributos, indiretos e margem
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Slider label="Custos indiretos (% s/ direto)" v={custoIndireto} onChange={(v: number) => { setCustoIndireto(v); marcarValida("impostos"); }} max={30} />
                <Slider label="Carga tributária estimada" v={tributos} onChange={(v: number) => { setTributos(v); marcarValida("impostos"); }} max={30} />
                <Slider label="Margem de lucro desejada" v={margem} onChange={(v: number) => { setMargem(v); marcarValida("impostos"); }} max={40} highlight />
              </div>
              <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12px] text-warning">
                A margem definida aqui é decisão da licitação — ela será revisada pela Controladoria antes da aprovação final
                e comporá o BDI do contrato após assinatura.
              </div>
            </section>
          )}

          {/* === DRE da Licitação === */}
          {abaAtiva === "dre" && (
            <section className="card-elevated overflow-hidden">
              <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-card to-card px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <BarChart3 className="h-4 w-4 text-primary" /> DRE projetada da licitação · 12 meses
                </h2>
                <span className="chip border bg-info-soft text-info border-info/30">Projeção derivada da composição</span>
              </header>
              <div className="grid gap-3 p-5 sm:grid-cols-4">
                <KpiMini label="Receita prevista (12m)" value={formatBRL(dreTotais.receitaOrc)} tone="primary" />
                <KpiMini label="Custo total (12m)" value={formatBRL(dreTotais.custoOrc)} tone="warning" />
                <KpiMini label="Tributos (12m)" value={formatBRL(dreTotais.tribOrc)} tone="muted" />
                <KpiMini label="Lucro previsto (12m)" value={formatBRL(dreTotais.lucroOrc)} tone="success" />
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-2 text-left">Linha</th>
                      {projecao.map(p => <th key={p.mes} className="px-2 py-2 text-right">{p.mes}</th>)}
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <DreRow label="(+) Receita bruta" data={projecao.map(p => p.receitaOrc)} total={dreTotais.receitaOrc} tone="text-success" />
                    <DreRow label="(−) Tributos s/ receita" data={projecao.map(p => -p.tribOrc)} total={-dreTotais.tribOrc} tone="text-muted-foreground" />
                    <DreRow label="(−) Custo direto + indireto" data={projecao.map(p => -p.custoOrc)} total={-dreTotais.custoOrc} tone="text-destructive" />
                    <tr className="bg-primary-soft/40 font-bold">
                      <td className="px-2 py-2 text-left">(=) Lucro líquido</td>
                      {projecao.map((p, i) => <td key={i} className="px-2 py-2 text-right text-primary">{formatBRL(p.lucroOrc)}</td>)}
                      <td className="px-2 py-2 text-right text-primary">{formatBRL(dreTotais.lucroOrc)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* === Caixa Mensal === */}
          {abaAtiva === "caixa" && (
            <section className="card-elevated overflow-hidden">
              <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/10 via-card to-card px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <Wallet className="h-4 w-4 text-accent" /> Caixa mensal · Orçado x Realizado
                </h2>
                <span className="chip border bg-warning-soft text-warning border-warning/30">Realizado: meses 1–6 (mock)</span>
              </header>
              <div className="overflow-x-auto p-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-2 text-left">Mês</th>
                      <th className="px-2 py-2 text-right">Receita orçada</th>
                      <th className="px-2 py-2 text-right">Receita real</th>
                      <th className="px-2 py-2 text-right">Custo orçado</th>
                      <th className="px-2 py-2 text-right">Custo real</th>
                      <th className="px-2 py-2 text-right">Caixa orçado</th>
                      <th className="px-2 py-2 text-right">Caixa real</th>
                      <th className="px-2 py-2 text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {projecao.map((p) => {
                      const delta = p.realizado ? p.caixaReal - p.caixaOrc : 0;
                      return (
                        <tr key={p.mes} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="px-2 py-2 text-left font-sans font-semibold">{p.mes}</td>
                          <td className="px-2 py-2 text-right">{formatBRL(p.receitaOrc)}</td>
                          <td className={`px-2 py-2 text-right ${p.realizado ? "" : "text-muted-foreground/40"}`}>{p.realizado ? formatBRL(p.receitaReal) : "—"}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">{formatBRL(p.custoOrc)}</td>
                          <td className={`px-2 py-2 text-right ${p.realizado ? "text-muted-foreground" : "text-muted-foreground/40"}`}>{p.realizado ? formatBRL(p.custoReal) : "—"}</td>
                          <td className="px-2 py-2 text-right font-semibold text-primary">{formatBRL(p.caixaOrc)}</td>
                          <td className={`px-2 py-2 text-right font-semibold ${p.realizado ? "text-accent" : "text-muted-foreground/40"}`}>{p.realizado ? formatBRL(p.caixaReal) : "—"}</td>
                          <td className={`px-2 py-2 text-right font-bold ${!p.realizado ? "text-muted-foreground/40" : delta >= 0 ? "text-success" : "text-destructive"}`}>
                            {p.realizado ? `${delta >= 0 ? "+" : ""}${formatBRL(delta)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* === Gráfico Orçado x Realizado === */}
          {abaAtiva === "grafico" && (
            <section className="card-elevated overflow-hidden">
              <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/10 via-card to-card px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <LineChartIcon className="h-4 w-4 text-accent" /> Caixa da licitação — Orçado x Realizado
                </h2>
              </header>
              <div className="p-5" style={{ height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projecao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => formatBRL(v as number)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="caixaOrc" name="Caixa orçado" fill="hsl(var(--primary))" opacity={0.85} radius={[4,4,0,0]} />
                    <Area dataKey="caixaReal" name="Caixa realizado" fill="hsl(var(--accent))" stroke="hsl(var(--accent))" fillOpacity={0.25} />
                    <Line type="monotone" dataKey="receitaOrc" name="Receita orçada" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Status do workflow */}
          <div className="card-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workflow de validação
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              {abas.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                    validas[a.id]
                      ? "border-success/40 bg-success-soft text-success"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {validas[a.id] ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                  <span className="font-semibold">{a.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {todasValidas
                ? "Todas as abas validadas. Você pode enviar à Controladoria."
                : "Interaja com cada aba para liberar o envio à Controladoria."}
            </p>
          </div>
        </div>

        {/* Painel lateral STICKY: BDI consolidado */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card-elevated overflow-hidden">
            <header className="border-b border-border bg-gradient-primary px-5 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                <h3 className="font-display text-sm font-bold">BDI consolidado</h3>
              </div>
            </header>
            <div className="space-y-3 p-5">
              <Row label="Custo direto / mês" v={formatBRL(totais.custoDiretoMes)} />
              <Row label="Custos indiretos" v={formatBRL(totais.indiretos)} />
              <Row label="Subtotal" v={formatBRL(totais.subtotal)} bold />
              <Row label="Tributos" v={formatBRL(totais.trib)} muted />
              <Row label="Margem de lucro" v={formatBRL(totais.lucro)} accent />
              <div className="border-t border-border pt-3">
                <Row label="Preço de venda / mês" v={formatBRL(totais.total)} highlight />
              </div>
              <div className="rounded-lg bg-primary-soft p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">BDI calculado</p>
                <p className="font-display text-3xl font-bold text-primary">{totais.bdi.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Próximos passos</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Validar postos com analista técnico</li>
              <li>2. Definir margem de lucro</li>
              <li>3. Enviar à Controladoria</li>
              <li>4. Aprovação Diretoria</li>
              <li>5. Compor BDI oficial do contrato</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input readOnly value={value} className="h-9 w-full rounded-md border border-input bg-muted px-3 text-sm font-semibold" />
    </div>
  );
}

function Money({ label, v, onChange }: { label: string; v: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type="number"
        value={v}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary"
      />
    </div>
  );
}

function Slider({ label, v, onChange, max, highlight }: any) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className={`font-mono text-sm font-bold ${highlight ? "text-accent" : "text-primary"}`}>{Number(v).toFixed(2)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function Row({ label, v, bold, muted, accent, highlight }: any) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""} ${accent ? "text-accent font-semibold" : ""} ${highlight ? "text-primary font-display text-lg font-bold" : ""}`}>{v}</span>
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: string; tone: "primary" | "warning" | "success" | "muted" }) {
  const map = {
    primary: "from-primary/15 to-primary/5 text-primary border-primary/20",
    warning: "from-warning/15 to-warning/5 text-warning border-warning/20",
    success: "from-success/15 to-success/5 text-success border-success/20",
    muted: "from-muted to-muted/40 text-foreground border-border",
  } as const;
  return (
    <div className={`rounded-lg border bg-gradient-to-br p-3 shadow-[0_2px_8px_-3px_hsl(var(--foreground)/0.08)] ${map[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function DreRow({ label, data, total, tone }: { label: string; data: number[]; total: number; tone: string }) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return (
    <tr className="border-b border-border/60 hover:bg-muted/30">
      <td className="px-2 py-1.5 text-left font-sans">{label}</td>
      {data.map((v, i) => <td key={i} className={`px-2 py-1.5 text-right ${tone}`}>{fmt(v)}</td>)}
      <td className={`px-2 py-1.5 text-right font-bold ${tone}`}>{fmt(total)}</td>
    </tr>
  );
}
