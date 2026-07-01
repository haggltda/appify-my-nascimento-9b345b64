import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePainelLicitacao } from "@/hooks/usePainelLicitacao";
import {
  AlertTriangle, Clock, FileText, Gavel, Trophy, TrendingUp, Sparkles,
  ChevronRight, Users, Target, BarChart3, Wallet, Tv, Construction,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LabelList, LineChart, Line, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

const fmtCompact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : `${v}`;

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Trunca (não arredonda) para 1 casa decimal — ex: 39.99 → "39,9" nunca "40,0"
function truncate1(n: number): string {
  return (Math.floor(n * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Formato compacto para KPI card — ex: "R$ 39,9 bi"
function fmtBRLKPI(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${truncate1(v / 1_000_000_000)} bi`;
  if (v >= 1_000_000)     return `R$ ${truncate1(v / 1_000_000)} mi`;
  if (v >= 1_000)         return `R$ ${Math.floor(v / 1_000).toLocaleString("pt-BR")} mil`;
  return formatBRL(v);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function aberturaUrgencia(d: string | null): "critica" | "proxima" | "normal" | null {
  if (!d) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const abertura = new Date(d + "T00:00:00");
  const dias = Math.ceil((abertura.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return null;
  if (dias <= 3) return "critica";
  if (dias <= 7) return "proxima";
  return "normal";
}

export default function PainelExecutivo() {
  const navigate = useNavigate();
  const { stats, isLoading } = usePainelLicitacao();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground text-sm">
        Carregando painel…
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-screen rounded-xl bg-slate-50 p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
      <div className="space-y-5 text-slate-900">
        <PageHeader
          title="Painel Executivo — Licitações"
          subtitle="Visão consolidada da empresa ativa. Indicadores em tempo real com base na Grade de Licitações."
          actions={
            <button
              onClick={() => navigate("/app/painel-executivo/tv")}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-md transition hover:bg-slate-700"
            >
              <Tv className="h-3.5 w-3.5" /> Modo TV
            </button>
          }
        />

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Pipeline ativo" value={fmtBRLKPI(stats.valorPipeline)} title={formatBRL(stats.valorPipeline)}
            delta={`${stats.ativas} editais em andamento`}
            icon={<TrendingUp className="h-5 w-5" />} tone="primary"
          />
          <KpiCard
            label="Total de editais" value={String(stats.total)}
            delta={`${stats.finalizadas} finalizados`}
            icon={<FileText className="h-5 w-5" />} tone="info"
          />
          <KpiCard
            label="Taxa de vitória" value={`${stats.taxaVitoria.toFixed(0)}%`}
            delta={`${stats.ganhas} ganhos · ${stats.perdidas} perdidos`}
            icon={<Trophy className="h-5 w-5" />} tone="success"
          />
          <KpiCard
            label="Alertas de abertura" value={String(stats.alertas.length)}
            delta="Editais com abertura nos próximos 7 dias"
            icon={<Clock className="h-5 w-5" />} tone="warning"
          />
        </div>

        {/* Linha 2: por responsável */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Valor de pipeline por responsável" subtitle="Soma do valor estimado por analista" icon={<Users className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.porResponsavel} layout="vertical" margin={{ left: 10, right: 60, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(220 15% 35%)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <YAxis type="category" dataKey="responsavel" stroke="hsl(220 15% 25%)" fontSize={11} width={130} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Bar dataKey="valor" name="Valor" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtCompact(v)} fill="hsl(220 15% 20%)" fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Quantidade de processos por responsável" subtitle="Carga de trabalho atual por analista" icon={<BarChart3 className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.porResponsavel} margin={{ left: 0, right: 8, top: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="responsavel" stroke="hsl(220 15% 25%)" fontSize={11} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="qtd" name="Processos" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="qtd" position="top" fill="hsl(220 15% 20%)" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Linha 3: taxa de sucesso + funil */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Taxa de sucesso por responsável" subtitle="Vitórias / (vitórias + perdidas) — processos finalizados" icon={<Target className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.porResponsavel} margin={{ left: 0, right: 8, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="responsavel" stroke="hsl(220 15% 25%)" fontSize={11} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Bar dataKey="taxa" name="Taxa de sucesso" fill="hsl(var(--success))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="taxa" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} fill="hsl(220 15% 20%)" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Funil por fase" subtitle="Volume de editais em cada fase do fluxo" icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.porFase} margin={{ left: 0, right: 8, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="etapa" stroke="hsl(220 15% 25%)" fontSize={10} angle={-20} textAnchor="end" height={70} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="qtd" name="Editais" fill="hsl(var(--info))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="qtd" position="top" fill="hsl(220 15% 20%)" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Evolução mensal */}
        <section>
          <ChartCard title="Evolução do pipeline (6 meses)" subtitle="Valor agregado e número de processos cadastrados por mês" icon={<Sparkles className="h-3.5 w-3.5" />}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.evolucaoMensal} margin={{ left: 0, right: 16, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="mes" stroke="hsl(220 15% 25%)" fontSize={12} />
                <YAxis yAxisId="l" stroke="hsl(var(--primary))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <YAxis yAxisId="r" orientation="right" stroke="hsl(var(--accent))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="l" type="monotone" dataKey="valor" name="Valor (R$)" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }}>
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => fmtCompact(v)} fill="hsl(220 15% 20%)" fontSize={11} fontWeight={600} />
                </Line>
                <Line yAxisId="r" type="monotone" dataKey="processos" name="Processos" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 4 }}>
                  <LabelList dataKey="processos" position="bottom" fill="hsl(220 15% 20%)" fontSize={11} fontWeight={600} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Placeholders financeiros */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PlaceholderCard title="Caixa / Recebimento Diário" subtitle="Integração financeira em breve" icon={<Wallet className="h-3.5 w-3.5" />} />
          <PlaceholderCard title="Faturamento Diário" subtitle="Integração financeira em breve" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        </section>

        {/* Alertas de abertura */}
        {stats.alertas.length > 0 && (
          <section className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-bold">Alertas de abertura</h2>
                <p className="text-xs text-slate-500">Editais com data de abertura nos próximos dias</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Edital</th>
                    <th className="px-3 py-3 text-left">Objeto</th>
                    <th className="px-3 py-3 text-left">Responsável</th>
                    <th className="px-3 py-3 text-left">Fase</th>
                    <th className="px-5 py-3 text-right">Abertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stats.alertas.map((item) => {
                    const urg = aberturaUrgencia(item.data);
                    const badgeClass = urg === "critica"
                      ? "bg-destructive/15 text-destructive"
                      : urg === "proxima"
                      ? "bg-warning/15 text-warning"
                      : "bg-success/15 text-success";
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.edital || "—"}</td>
                        <td className="px-3 py-3 max-w-xs">
                          <p className="line-clamp-1 text-sm font-medium">{item.objeto || "—"}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{item.responsavel || "—"}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{item.fase}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
                            {fmtDate(item.data)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, title, delta, icon, tone }: {
  label: string; value: string; title?: string; delta: string; icon: React.ReactNode;
  tone: "primary" | "info" | "warning" | "success";
}) {
  const map = {
    primary: "from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.7)]",
    info: "from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)]",
    warning: "from-[hsl(var(--warning))] to-[hsl(var(--warning)/0.7)]",
    success: "from-[hsl(var(--success))] to-[hsl(var(--success)/0.7)]",
  } as const;
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-5 text-slate-900 shadow-md ring-1 ring-slate-200 transition-transform hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${map[tone]} text-white shadow-md`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl" title={title}>{value}</p>
      <p className="mt-1.5 text-xs text-slate-500">{delta}</p>
      <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${map[tone]} opacity-80`} />
    </div>
  );
}

function ChartCard({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-slate-200">
      <header className="flex items-start gap-2.5 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-3.5">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary shadow-[0_2px_6px_-2px_hsl(var(--primary)/0.4)]">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-bold leading-tight text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PlaceholderCard({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-slate-200">
      <header className="flex items-start gap-2.5 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-3.5">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-bold leading-tight text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </header>
      <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-muted-foreground">
        <Construction className="h-8 w-8 opacity-30" />
        <p className="text-xs opacity-50">Dados financeiros disponíveis em breve</p>
      </div>
    </div>
  );
}
