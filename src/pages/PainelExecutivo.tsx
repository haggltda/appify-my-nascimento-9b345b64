import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusChip, CriticidadeChip } from "@/components/StatusChip";
import { licitacoes, formatBRL, formatDate, statusLabel, statusOrdem } from "@/data/licitacoes";
import {
  ArrowUpRight, AlertTriangle, Clock, FileText, Gavel, Trophy, XCircle,
  TrendingUp, Sparkles, Filter, Download, Plus, ChevronRight, Users, Target, BarChart3, Wallet,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, LabelList,
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

export default function PainelExecutivo() {
  const total = licitacoes.length;
  const vencidas = licitacoes.filter((l) => l.status === "vencida").length;
  const pregao = licitacoes.filter((l) => l.status === "pregao").length;
  const aguardando = licitacoes.filter((l) =>
    ["controladoria", "aprovacao_diretoria", "aprovacao_presidencia"].includes(l.status),
  ).length;
  const valorPipeline = licitacoes
    .filter((l) => !["perdida", "vencida"].includes(l.status))
    .reduce((acc, l) => acc + l.valorEstimado, 0);

  // === Agregações analíticas ===
  const porAnalista = useMemo(() => {
    const map = new Map<string, { responsavel: string; qtd: number; valor: number; vitorias: number; perdidas: number }>();
    licitacoes.forEach((l) => {
      const cur = map.get(l.responsavel) || { responsavel: l.responsavel, qtd: 0, valor: 0, vitorias: 0, perdidas: 0 };
      cur.qtd++;
      cur.valor += l.valorEstimado;
      if (l.status === "vencida") cur.vitorias++;
      if (l.status === "perdida") cur.perdidas++;
      map.set(l.responsavel, cur);
    });
    return Array.from(map.values())
      .map((a) => ({ ...a, taxa: a.vitorias + a.perdidas > 0 ? (a.vitorias / (a.vitorias + a.perdidas)) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, []);

  const porModalidade = useMemo(() => {
    const map = new Map<string, number>();
    licitacoes.forEach((l) => map.set(l.modalidade, (map.get(l.modalidade) || 0) + l.valorEstimado));
    return Array.from(map, ([modalidade, valor]) => ({ modalidade, valor }));
  }, []);

  const totalModalidade = porModalidade.reduce((a, b) => a + b.valor, 0);

  const funilEtapas = useMemo(
    () => statusOrdem.map((s) => ({
      etapa: statusLabel[s].length > 14 ? statusLabel[s].slice(0, 12) + "…" : statusLabel[s],
      qtd: licitacoes.filter((l) => l.status === s).length,
    })).filter(e => e.qtd > 0),
    []
  );

  const evolucaoMensal = useMemo(() => {
    const base = valorPipeline / 6;
    return ["Nov", "Dez", "Jan", "Fev", "Mar", "Abr"].map((mes, i) => {
      const fator = 0.7 + (i * 0.08) + Math.sin(i) * 0.05;
      return { mes, valor: Math.round(base * fator), processos: 8 + i * 2 };
    });
  }, [valorPipeline]);

  // === Caixa / Recebimento Diário (mock visual) ===
  const recebimentoDiario = useMemo(() => {
    const dias = Array.from({ length: 14 }, (_, i) => i + 1);
    const baseDia = Math.max(80_000, valorPipeline / 600);
    return dias.map((d) => {
      const fator = 0.6 + Math.sin(d / 1.7) * 0.35 + (d % 5 === 0 ? 0.4 : 0);
      return { dia: `${String(d).padStart(2, "0")}/04`, valor: Math.round(baseDia * (1 + fator)) };
    });
  }, [valorPipeline]);

  // === Faturamento Diário (mock visual) ===
  const faturamentoDiario = useMemo(() => {
    const dias = Array.from({ length: 14 }, (_, i) => i + 1);
    const baseDia = Math.max(120_000, valorPipeline / 450);
    return dias.map((d) => {
      const fator = 0.55 + Math.cos(d / 2.1) * 0.3 + (d % 7 === 0 ? 0.5 : 0);
      return { dia: `${String(d).padStart(2, "0")}/04`, valor: Math.round(baseDia * (1 + fator)) };
    });
  }, [valorPipeline]);

  return (
    <div className="-m-4 min-h-screen rounded-xl bg-slate-50 p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
      <div className="space-y-5 text-slate-900">
        <PageHeader
          title="Painel Executivo"
          subtitle="Visão consolidada multi-CNPJ. Indicadores em tempo real, alertas críticos e pendências por etapa do fluxo."
          actions={
            <>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                <Filter className="h-3.5 w-3.5" /> Filtros
              </button>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                <Download className="h-3.5 w-3.5" /> Exportar
              </button>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--accent)/0.85)] px-3.5 text-xs font-semibold text-accent-foreground shadow-md transition hover:brightness-110">
                <Plus className="h-3.5 w-3.5" /> Nova Oportunidade
              </button>
            </>
          }
        />

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Pipeline ativo" value={formatBRL(valorPipeline)} delta="+12,4% vs. mês anterior"
            icon={<TrendingUp className="h-5 w-5" />} tone="primary"
          />
          <KpiCard
            label="Editais em andamento" value={String(total)} delta={`${pregao} em pregão · ${aguardando} aguardando aprovação`}
            icon={<FileText className="h-5 w-5" />} tone="info"
          />
          <KpiCard
            label="Aguardando aprovação" value={String(aguardando)} delta="Alçadas: controladoria, diretoria, presidência"
            icon={<Clock className="h-5 w-5" />} tone="warning"
          />
          <KpiCard
            label="Vencidas no período" value={String(vencidas)} delta="Prontas para handoff ao módulo de contratos"
            icon={<Trophy className="h-5 w-5" />} tone="success"
          />
        </div>

        {/* Linha 2: pipeline por analista + qtd por analista */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Valor de pipeline por analista"
            subtitle="Soma do valor estimado por responsável"
            icon={<Users className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porAnalista} layout="vertical" margin={{ left: 10, right: 60, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(220 15% 35%)" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <YAxis type="category" dataKey="responsavel" stroke="hsl(220 15% 25%)" fontSize={12} width={120} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v as number)}
                />
                <Bar dataKey="valor" name="Valor" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={(v: number) => fmtCompact(v)} fill="hsl(220 15% 20%)" fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Quantidade de processos por analista"
            subtitle="Carga de trabalho atual por responsável"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porAnalista} margin={{ left: 0, right: 8, top: 20, bottom: 0 }}>
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

        {/* Linha 3: Caixa diário + Modalidade */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Caixa / Recebimento Diário"
            subtitle="Recebimentos previstos nos próximos 14 dias (visualização)"
            icon={<Wallet className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={recebimentoDiario} margin={{ left: 0, right: 12, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="dia" stroke="hsl(220 15% 25%)" fontSize={10} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={10} tickFormatter={(v) => `R$ ${fmtCompact(v)}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v as number)}
                />
                <Bar dataKey="valor" name="Recebimento" fill="hsl(var(--success))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => fmtCompact(v)} fill="hsl(220 15% 20%)" fontSize={10} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Valor por modalidade"
            subtitle="Distribuição do pipeline por tipo de processo licitatório"
            icon={<Gavel className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <RPieChart>
                <Pie
                  data={porModalidade}
                  dataKey="valor"
                  nameKey="modalidade"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={55}
                  paddingAngle={2}
                  label={({ value }) => `${((value as number / totalModalidade) * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={11}
                >
                  {porModalidade.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v as number)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RPieChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Linha 4: Taxa de sucesso + Funil + Evolução */}
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Taxa de sucesso por analista"
            subtitle="Vitórias / (vitórias + perdidas) — apenas processos finalizados"
            icon={<Target className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porAnalista} margin={{ left: 0, right: 8, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="responsavel" stroke="hsl(220 15% 25%)" fontSize={11} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => `${(v as number).toFixed(1)}%`}
                />
                <Bar dataKey="taxa" name="Taxa de sucesso" fill="hsl(var(--success))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="taxa" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} fill="hsl(220 15% 20%)" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Funil de conversão por etapa"
            subtitle="Volume de processos em cada fase do fluxo"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funilEtapas} margin={{ left: 0, right: 8, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="etapa" stroke="hsl(220 15% 25%)" fontSize={10} angle={-25} textAnchor="end" height={70} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="qtd" name="Processos" fill="hsl(var(--info))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="qtd" position="top" fill="hsl(220 15% 20%)" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4">
          <ChartCard
            title="Evolução do pipeline (6 meses)"
            subtitle="Valor agregado e número de processos por mês"
            icon={<Sparkles className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucaoMensal} margin={{ left: 0, right: 16, top: 22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 85%)" />
                <XAxis dataKey="mes" stroke="hsl(220 15% 25%)" fontSize={12} />
                <YAxis yAxisId="l" stroke="hsl(var(--primary))" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
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

        {/* Faturamento Diário */}
        <section className="grid gap-4">
          <ChartCard
            title="Faturamento Diário"
            subtitle="Total faturado dia a dia (notas emitidas) — visualização dos últimos 14 dias"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={faturamentoDiario} margin={{ left: 0, right: 12, top: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 88%)" />
                <XAxis dataKey="dia" stroke="hsl(220 15% 25%)" fontSize={10} />
                <YAxis stroke="hsl(220 15% 35%)" fontSize={10} tickFormatter={(v) => `R$ ${fmtCompact(v)}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v as number)}
                />
                <Bar dataKey="valor" name="Faturamento" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => fmtCompact(v)} fill="hsl(220 15% 20%)" fontSize={10} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Status grid — Distribuição por etapa (visual moderno) */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[hsl(220_45%_14%)] to-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white shadow-lg">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-white">Distribuição por etapa</h2>
                <p className="text-xs text-slate-300">Volume de processos em cada estado do fluxo de licitação</p>
              </div>
            </div>
            <button className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/10">
              Ver pipeline completo <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {(() => {
            const items = [
              { key: "oportunidade", icon: Sparkles, color: "from-sky-400 to-sky-600" },
              { key: "em_analise", icon: FileText, color: "from-indigo-400 to-indigo-600" },
              { key: "controladoria", icon: AlertTriangle, color: "from-amber-400 to-amber-600" },
              { key: "aprovacao_diretoria", icon: Clock, color: "from-orange-400 to-orange-600" },
              { key: "pregao", icon: Gavel, color: "from-violet-400 to-violet-600" },
              { key: "vencida", icon: Trophy, color: "from-emerald-400 to-emerald-600" },
              { key: "perdida", icon: XCircle, color: "from-rose-400 to-rose-600" },
              { key: "suspensa", icon: AlertTriangle, color: "from-slate-400 to-slate-600" },
            ] as const;
            const max = Math.max(...items.map(({ key }) => licitacoes.filter((l) => l.status === key).length), 1);
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                {items.map(({ key, icon: Icon, color }) => {
                  const count = licitacoes.filter((l) => l.status === key).length;
                  const pct = (count / max) * 100;
                  return (
                    <div
                      key={key}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${color} text-white shadow-md`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-white">{count}</p>
                      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">{statusLabel[key]}</p>
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* Alertas + Pendências */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h2 className="font-display text-sm font-bold">Pendências críticas</h2>
                <p className="text-xs text-slate-500">Processos com prazo próximo ou ações bloqueando aprovação</p>
              </div>
              <button className="text-xs font-medium text-primary hover:underline">Ver todas</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Processo</th>
                    <th className="px-3 py-3 text-left">Empresa</th>
                    <th className="px-3 py-3 text-left">Etapa</th>
                    <th className="px-3 py-3 text-left">Criticidade</th>
                    <th className="px-3 py-3 text-right">Valor</th>
                    <th className="px-5 py-3 text-right">Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {licitacoes.slice(0, 6).map((l) => (
                    <tr key={l.id} className="group hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-mono text-[11px] text-slate-500">{l.numero}</p>
                        <p className="line-clamp-1 max-w-md text-sm font-medium">{l.objeto}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{l.empresa}</span>
                      </td>
                      <td className="px-3 py-3"><StatusChip status={l.status} /></td>
                      <td className="px-3 py-3"><CriticidadeChip value={l.criticidade} /></td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{formatBRL(l.valorEstimado)}</td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500">{formatDate(l.prazo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="font-display text-sm font-bold">Alertas operacionais</h2>
              <p className="text-xs text-slate-500">Eventos que demandam atenção</p>
            </div>
            <ul className="divide-y divide-slate-200">
              {[
                { tone: "destructive", title: "Prazo expira em 24h", desc: "PE 077/2025 — Curitiba aguarda aprovação da diretoria.", icon: AlertTriangle },
                { tone: "warning", title: "Documentação incompleta", desc: "RDC 012/2025 sem ART e atestado técnico.", icon: FileText },
                { tone: "info", title: "Triagem por IA disponível", desc: "3 novos editais aptos para análise automática.", icon: Sparkles },
                { tone: "success", title: "Pronta para contrato", desc: "PE 044/2025 vencida — handoff disponível.", icon: Trophy },
              ].map((a, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                  <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-${a.tone}-soft text-${a.tone}`}>
                    <a.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, delta, icon, tone,
}: { label: string; value: string; delta: string; icon: React.ReactNode; tone: "primary" | "info" | "warning" | "success" }) {
  const map = {
    primary: "from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.7)]",
    info: "from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)]",
    warning: "from-[hsl(var(--warning))] to-[hsl(var(--warning)/0.7)]",
    success: "from-[hsl(var(--success))] to-[hsl(var(--success)/0.7)]",
  } as const;
  const iconText = {
    primary: "text-primary-foreground",
    info: "text-info-foreground",
    warning: "text-warning-foreground",
    success: "text-success-foreground",
  } as const;
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-5 text-slate-900 shadow-md ring-1 ring-slate-200 transition-transform hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${map[tone]} ${iconText[tone]} shadow-md`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">{value}</p>
      <p className="mt-1.5 text-xs text-slate-500">{delta}</p>
      <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${map[tone]} opacity-80`} />
    </div>
  );
}

function ChartCard({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-slate-200">
      <header className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary shadow-[0_2px_6px_-2px_hsl(var(--primary)/0.4)]">
            {icon}
          </span>
          <div>
            <h3 className="font-display text-sm font-bold leading-tight text-slate-900">{title}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}
