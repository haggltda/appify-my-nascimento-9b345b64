import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Banknote, Wallet, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Briefcase, Crown, ArrowUpRight, FileSignature, Users, Building2,
  Activity, Flame, ListChecks, Target,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";

const PALETTE = ["hsl(var(--primary))", "hsl(var(--accent))", "#16a34a", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4", "#a855f7"];

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRLcompact = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmtBRL(v);
};
const fmtDate = (d?: string) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";
const isoAdd = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};

export default function Presidencia() {
  const navigate = useNavigate();

  // Caixa consolidado: soma de saldo_inicial das contas de Disponibilidades em todas empresas
  const caixaQ = useQuery({
    queryKey: ["pres-caixa"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conta_contabil")
        .select("empresa_id, saldo_inicial, classificacao")
        .like("classificacao", "01.1.1%")
        .eq("tipo", "analitica");
      const rows = (data ?? []) as Array<{ empresa_id: string; saldo_inicial: number; classificacao: string }>;
      const porEmpresa: Record<string, number> = {};
      let total = 0;
      rows.forEach((r) => {
        const v = Number(r.saldo_inicial || 0);
        porEmpresa[r.empresa_id] = (porEmpresa[r.empresa_id] ?? 0) + v;
        total += v;
      });
      return { total, porEmpresa };
    },
  });

  const empresasQ = useQuery({
    queryKey: ["pres-empresas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("empresas")
        .select("id, codigo, razao_social, nome_fantasia")
        .eq("ativa", true)
        .order("codigo");
      return (data ?? []) as Array<{ id: string; codigo: string; razao_social: string; nome_fantasia: string }>;
    },
  });

  const malotesQ = useQuery({
    queryKey: ["pres-malotes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("malote_pagamento")
        .select("id, descricao, data_pagamento, valor_total, status, empresa_id")
        .in("status", ["rascunho", "enviado"])
        .order("data_pagamento", { ascending: true })
        .limit(20);
      return (data ?? []) as Array<{
        id: string; descricao: string; data_pagamento: string; valor_total: number; status: string; empresa_id: string;
      }>;
    },
  });

  const titulosPagarQ = useQuery({
    queryKey: ["pres-tit-pagar"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("titulo_pagar")
        .select("id, valor, data_vencimento, status")
        .neq("status", "pago")
        .neq("status", "cancelado");
      return (data ?? []) as Array<{ id: string; valor: number; data_vencimento: string; status: string }>;
    },
  });

  const titulosReceberQ = useQuery({
    queryKey: ["pres-tit-receber"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("titulo_receber")
        .select("id, valor, data_vencimento, status")
        .neq("status", "recebido")
        .neq("status", "cancelado");
      return (data ?? []) as Array<{ id: string; valor: number; data_vencimento: string; status: string }>;
    },
  });

  const aprovacoesQ = useQuery({
    queryKey: ["pres-aprovacoes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pre_titulo_pagar")
        .select("id, descricao, valor_total, status, created_at, empresa_id")
        .eq("status", "submetido")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []).map((a: any) => ({
        id: a.id as string,
        tipo: "Pré-título",
        descricao: (a.descricao ?? "Pré-título sem descrição") as string,
        valor: Number(a.valor_total ?? 0),
        status: a.status as string,
        criado_em: a.created_at as string,
      }));
    },
  });

  const totalAPagar = useMemo(
    () => (titulosPagarQ.data ?? []).reduce((s, t) => s + Number(t.valor || 0), 0),
    [titulosPagarQ.data]
  );
  const totalAReceber = useMemo(
    () => (titulosReceberQ.data ?? []).reduce((s, t) => s + Number(t.valor || 0), 0),
    [titulosReceberQ.data]
  );
  const totalMalotes = useMemo(
    () => (malotesQ.data ?? []).reduce((s, m) => s + Number(m.valor_total || 0), 0),
    [malotesQ.data]
  );
  const empresaNome = (id: string) =>
    empresasQ.data?.find((e) => e.id === id)?.codigo ?? "—";

  const hoje = new Date();
  const vencidasPagar = (titulosPagarQ.data ?? []).filter(
    (t) => new Date(t.data_vencimento) < hoje
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        module="Presidência"
        breadcrumb={["Presidência", "Dashboard Executivo"]}
        title="Painel da Presidência"
        subtitle="Visão consolidada do grupo: caixa, aprovações estratégicas, malotes e indicadores executivos."
        actions={
          <Button
            onClick={() => navigate("/app/financeiro/contas-pagar")}
            className="gap-2"
          >
            <FileSignature className="h-4 w-4" /> Aprovar pagamentos
          </Button>
        }
      />

      {/* HERO de caixa consolidado */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/70 p-8 text-primary-foreground shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_white_0%,_transparent_60%)] opacity-10" />
        <div className="relative grid gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
              <Crown className="h-3.5 w-3.5" /> Caixa Consolidado do Grupo
            </div>
            <p className="mt-3 font-display text-5xl font-black tabular-nums">
              {fmtBRL(caixaQ.data?.total ?? 0)}
            </p>
            <p className="mt-2 text-sm opacity-90">
              Disponibilidades em {empresasQ.data?.length ?? 0} empresas controladas
            </p>
          </div>
          <div className="flex flex-col justify-center gap-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="opacity-80">A Receber</span>
              <strong className="tabular-nums">{fmtBRL(totalAReceber)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">A Pagar</span>
              <strong className="tabular-nums">{fmtBRL(totalAPagar)}</strong>
            </div>
            <div className="my-1 h-px bg-white/20" />
            <div className="flex items-center justify-between text-base">
              <span className="opacity-90">Resultado projetado</span>
              <strong className="tabular-nums">{fmtBRL(totalAReceber - totalAPagar)}</strong>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-2">
            <KpiHero icon={<Wallet className="h-4 w-4" />} label="Malotes pendentes" valor={`${malotesQ.data?.length ?? 0}`} sub={fmtBRL(totalMalotes)} />
            <KpiHero icon={<AlertTriangle className="h-4 w-4" />} label="Títulos vencidos" valor={`${vencidasPagar}`} sub="Atenção imediata" tone="warn" />
            <KpiHero icon={<CheckCircle2 className="h-4 w-4" />} label="Aprovações pendentes" valor={`${aprovacoesQ.data?.length ?? 0}`} sub="Sua decisão" />
          </div>
        </div>
      </Card>

      {/* Caixa por empresa */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Building2 className="h-4 w-4 text-primary" /> Caixa por Empresa
        </h2>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {(empresasQ.data ?? []).map((e) => {
            const v = caixaQ.data?.porEmpresa?.[e.id] ?? 0;
            return (
              <Card key={e.id} className="p-4 transition hover:border-primary/40 hover:shadow-md">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{e.codigo}</p>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{e.razao_social}</p>
                <p className="mt-3 font-display text-xl font-bold tabular-nums">{fmtBRL(v)}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Malotes para liberação */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <h3 className="font-display font-bold">Malotes aguardando liberação</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate("/app/financeiro/contas-pagar")}>
              Ver todos <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-left">Empresa</th>
                <th className="px-4 py-2 text-left">Pagamento</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(malotesQ.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum malote pendente</td></tr>
              )}
              {(malotesQ.data ?? []).map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{m.descricao}</td>
                  <td className="px-4 py-2"><Badge variant="outline" className="font-mono">{empresaNome(m.empresa_id)}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(m.data_pagamento)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(m.valor_total)}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={m.status === "enviado" ? "default" : "secondary"} className="capitalize">{m.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Aprovações */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h3 className="font-display font-bold">Aprovações estratégicas</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate("/app/aprovacoes")}>
              Ver todas <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="divide-y divide-border">
            {(aprovacoesQ.data ?? []).length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma aprovação pendente</div>
            )}
            {(aprovacoesQ.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.descricao}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.tipo} · {fmtDate(a.criado_em)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold">{fmtBRL(a.valor)}</p>
                  <Badge variant="outline" className="text-[9px]">{a.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Atalhos executivos */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <TrendingUp className="h-4 w-4 text-primary" /> Atalhos executivos
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <ShortcutCard icon={<Wallet />} title="Fluxo de Caixa" desc="Posição diária consolidada" onClick={() => navigate("/app/financeiro/fluxo-caixa")} />
          <ShortcutCard icon={<TrendingDown />} title="DRE Gerencial" desc="Resultado por empresa" onClick={() => navigate("/app/controladoria/dre-gerencial")} />
          <ShortcutCard icon={<Users />} title="Plano de Ações" desc="Iniciativas em curso" onClick={() => navigate("/app/plano-acoes/dashboard")} />
          <ShortcutCard icon={<Clock />} title="Pipeline Comercial" desc="Oportunidades ativas" onClick={() => navigate("/app/pipeline")} />
        </div>
      </div>
    </div>
  );
}

function KpiHero({
  icon, label, valor, sub, tone,
}: { icon: React.ReactNode; label: string; valor: string; sub: string; tone?: "warn" }) {
  return (
    <div className={`rounded-lg border border-white/15 bg-white/5 p-3 backdrop-blur ${tone === "warn" ? "ring-1 ring-amber-300/40" : ""}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-90">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
      </div>
      <p className="mt-1 font-display text-xl font-bold tabular-nums">{valor}</p>
      <p className="text-[11px] opacity-80">{sub}</p>
    </div>
  );
}

function ShortcutCard({
  icon, title, desc, onClick,
}: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-lg"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
        {icon}
      </div>
      <p className="mt-3 font-display font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
