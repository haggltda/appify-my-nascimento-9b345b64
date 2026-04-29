import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusChip, CriticidadeChip } from "@/components/StatusChip";
import { licitacoes, formatBRL, formatDate, statusLabel, statusOrdem } from "@/data/licitacoes";
import {
  ArrowUpRight, AlertTriangle, Clock, FileText, Gavel, Trophy, XCircle,
  TrendingUp, Sparkles, Filter, Download, Plus, ChevronRight, Users, Target, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Executivo"
        subtitle="Visão consolidada multi-CNPJ. Indicadores em tempo real, alertas críticos e pendências por etapa do fluxo."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
              <Plus className="h-3.5 w-3.5" /> Nova Oportunidade
            </button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pipeline ativo" value={formatBRL(valorPipeline)} delta="+12,4% vs. mês anterior"
          icon={<TrendingUp className="h-4 w-4" />} tone="primary"
        />
        <KpiCard
          label="Editais em andamento" value={String(total)} delta={`${pregao} em pregão · ${aguardando} aguardando aprovação`}
          icon={<FileText className="h-4 w-4" />} tone="info"
        />
        <KpiCard
          label="Aguardando aprovação" value={String(aguardando)} delta="Alçadas: controladoria, diretoria, presidência"
          icon={<Clock className="h-4 w-4" />} tone="warning"
        />
        <KpiCard
          label="Vencidas no período" value={String(vencidas)} delta="Prontas para handoff ao módulo de contratos"
          icon={<Trophy className="h-4 w-4" />} tone="success"
        />
      </div>

      {/* Status grid */}
      <section className="card-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-display text-sm font-bold">Distribuição por etapa</h2>
            <p className="text-xs text-muted-foreground">Volume de processos em cada estado do fluxo de licitação</p>
          </div>
          <button className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
            Ver pipeline completo <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {(
            [
              { key: "oportunidade", icon: Sparkles },
              { key: "em_analise", icon: FileText },
              { key: "controladoria", icon: AlertTriangle },
              { key: "aprovacao_diretoria", icon: Clock },
              { key: "pregao", icon: Gavel },
              { key: "vencida", icon: Trophy },
              { key: "perdida", icon: XCircle },
              { key: "suspensa", icon: AlertTriangle },
            ] as const
          ).map(({ key, icon: Icon }) => {
            const count = licitacoes.filter((l) => l.status === key).length;
            return (
              <div key={key} className="bg-card p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-center justify-between text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity hover:opacity-100" />
                </div>
                <p className="mt-2 font-display text-2xl font-bold">{count}</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{statusLabel[key]}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Alertas + Pendências */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-elevated lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <h2 className="font-display text-sm font-bold">Pendências críticas</h2>
              <p className="text-xs text-muted-foreground">Processos com prazo próximo ou ações bloqueando aprovação</p>
            </div>
            <button className="text-xs font-medium text-primary hover:underline">Ver todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Processo</th>
                  <th className="px-3 py-3 text-left">Empresa</th>
                  <th className="px-3 py-3 text-left">Etapa</th>
                  <th className="px-3 py-3 text-left">Criticidade</th>
                  <th className="px-3 py-3 text-right">Valor</th>
                  <th className="px-5 py-3 text-right">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {licitacoes.slice(0, 6).map((l) => (
                  <tr key={l.id} className="group hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <p className="font-mono text-[11px] text-muted-foreground">{l.numero}</p>
                      <p className="line-clamp-1 max-w-md text-sm font-medium">{l.objeto}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{l.empresa}</span>
                    </td>
                    <td className="px-3 py-3"><StatusChip status={l.status} /></td>
                    <td className="px-3 py-3"><CriticidadeChip value={l.criticidade} /></td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{formatBRL(l.valorEstimado)}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{formatDate(l.prazo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-elevated">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-display text-sm font-bold">Alertas operacionais</h2>
            <p className="text-xs text-muted-foreground">Eventos que demandam atenção</p>
          </div>
          <ul className="divide-y divide-border">
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
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, delta, icon, tone,
}: { label: string; value: string; delta: string; icon: React.ReactNode; tone: "primary" | "info" | "warning" | "success" }) {
  const map = {
    primary: "bg-primary text-primary-foreground",
    info: "bg-info text-info-foreground",
    warning: "bg-warning text-warning-foreground",
    success: "bg-success text-success-foreground",
  } as const;
  return (
    <div className="card-floating p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${map[tone]} shadow-sm`}>{icon}</div>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
    </div>
  );
}
