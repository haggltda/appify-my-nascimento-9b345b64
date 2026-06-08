import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Banknote, Wallet, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Briefcase, Crown, ArrowUpRight, FileSignature, Users, Building2,
  Activity, Flame, ListChecks, Target, ShieldAlert, Info,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
  "hsl(var(--primary-glow))",
  "hsl(var(--accent-hover))",
];

type CaixaRow = {
  empresa_id: string;
  empresa_codigo: string;
  saldo_inicial: number;
  total_entradas: number;
  total_saidas: number;
  saldo_liquido: number;
  qtd_movimentos_com_alias: number;
  qtd_movimentos_sem_match: number;
  qtd_valores_invalidos: number;
  qtd_pendencias_alias: number;
  pendencias_por_categoria?: Record<string, number>;
  status_confiabilidade: "VALIDADO" | "INFERIDO" | "PENDENTE" | "BLOQUEADO";
};

const statusMeta: Record<CaixaRow["status_confiabilidade"], { label: string; cls: string }> = {
  VALIDADO:  { label: "Validado",  cls: "bg-success-soft text-success border-success/30" },
  INFERIDO:  { label: "Inferido",  cls: "bg-info-soft text-info border-info/30" },
  PENDENTE:  { label: "Pendente",  cls: "bg-warning-soft text-warning border-warning/30" },
  BLOQUEADO: { label: "Bloqueado", cls: "bg-destructive-soft text-destructive border-destructive/30" },
};

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
  const [periodo, setPeriodo] = useState<7 | 15 | 30 | 60 | 90>(30);
  const limiteData = isoAdd(periodo);

  // Caixa via RPC pres_caixa_status (SECURITY INVOKER, com chip de confiabilidade)
  const caixaQ = useQuery({
    queryKey: ["pres-caixa-rpc"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pres_caixa_status");
      if (error) throw error;
      return (data ?? []) as CaixaRow[];
    },
    retry: false,
  });

  const caixaRows: CaixaRow[] = caixaQ.data ?? [];
  const caixaErr = caixaQ.error as { code?: string; message?: string } | null;
  const isUnauthorized =
    !!caixaErr && (caixaErr.code === "42501" || /SEM_PERMISSAO|NAO_AUTENTICADO/i.test(caixaErr.message ?? ""));

  const caixaTotal = useMemo(
    () => caixaRows.reduce((s, r) => s + Number(r.saldo_liquido || 0), 0),
    [caixaRows]
  );
  const totalPendencias = useMemo(
    () => caixaRows.reduce((s, r) => s + (r.qtd_pendencias_alias || 0), 0),
    [caixaRows]
  );
  const totalSemMatch = useMemo(
    () => caixaRows.reduce((s, r) => s + (r.qtd_movimentos_sem_match || 0), 0),
    [caixaRows]
  );
  const totalInvalidos = useMemo(
    () => caixaRows.reduce((s, r) => s + (r.qtd_valores_invalidos || 0), 0),
    [caixaRows]
  );
  const haggRow = caixaRows.find((r) => r.empresa_codigo === "HAGG");

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

  const planoQ = useQuery({
    queryKey: ["pres-plano-acoes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plano_acao")
        .select("id, titulo, area, comite, prioridade_normalizada, status_normalizado, responsavel_nome_origem, data_fim_planejado, data_fim_planejado_original")
        .is("deleted_at", null)
        .limit(2000);
      return (data ?? []) as Array<any>;
    },
  });

  const limite = new Date(limiteData + "T23:59:59");
  const titulosPagarPeriodo = (titulosPagarQ.data ?? []).filter(
    (t) => t.data_vencimento && new Date(t.data_vencimento) <= limite
  );
  const titulosReceberPeriodo = (titulosReceberQ.data ?? []).filter(
    (t) => t.data_vencimento && new Date(t.data_vencimento) <= limite
  );
  const totalAPagar = useMemo(
    () => titulosPagarPeriodo.reduce((s, t) => s + Number(t.valor || 0), 0),
    [titulosPagarPeriodo]
  );
  const totalAReceber = useMemo(
    () => titulosReceberPeriodo.reduce((s, t) => s + Number(t.valor || 0), 0),
    [titulosReceberPeriodo]
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

  const planoStats = useMemo(() => {
    const rows = planoQ.data ?? [];
    const byStatus: Record<string, number> = {};
    const byPrio: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    rows.forEach((r: any) => {
      const s = r.status_normalizado ?? "a_definir";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      const p = r.prioridade_normalizada ?? "nao_informada";
      byPrio[p] = (byPrio[p] ?? 0) + 1;
      if (r.area) byArea[r.area] = (byArea[r.area] ?? 0) + 1;
    });
    return {
      statusData: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      prioData:   Object.entries(byPrio).map(([name, value]) => ({ name, value })),
      areaData:   Object.entries(byArea).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      total: rows.length,
    };
  }, [planoQ.data]);

  const acoesCriticas = useMemo(() => {
    const rows = planoQ.data ?? [];
    return rows
      .filter((r: any) => r.status_normalizado === "atrasada" || r.prioridade_normalizada === "emergencial" || r.prioridade_normalizada === "alta")
      .sort((a: any, b: any) => {
        const order = ["emergencial", "alta", "media", "baixa"];
        return order.indexOf(a.prioridade_normalizada ?? "z") - order.indexOf(b.prioridade_normalizada ?? "z");
      })
      .slice(0, 12);
  }, [planoQ.data]);

  const fluxoChart = useMemo(() => {
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2 + i); return d;
    });
    return meses.map((d, i) => {
      const ini = new Date(d.getFullYear(), d.getMonth(), 1);
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const isProj = i >= 3;
      const ent = (titulosReceberQ.data ?? []).filter((t) => {
        const dv = t.data_vencimento ? new Date(t.data_vencimento) : null;
        return dv && dv >= ini && dv <= fim;
      }).reduce((s, t) => s + Number(t.valor || 0), 0);
      const sai = (titulosPagarQ.data ?? []).filter((t) => {
        const dv = t.data_vencimento ? new Date(t.data_vencimento) : null;
        return dv && dv >= ini && dv <= fim;
      }).reduce((s, t) => s + Number(t.valor || 0), 0);
      const mes = d.toLocaleDateString("pt-BR", { month: "short" });
      return {
        mes: mes.charAt(0).toUpperCase() + mes.slice(1, 3),
        realizadoEntrada: isProj ? 0 : ent,
        realizadoSaida:   isProj ? 0 : -sai,
        projetadoLiquido: ent - sai,
      };
    });
  }, [titulosPagarQ.data, titulosReceberQ.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        module="Presidência"
        breadcrumb={["Presidência", "Dashboard Executivo"]}
        title="Painel da Presidência"
        subtitle="Visão consolidada do grupo: caixa, aprovações estratégicas, malotes e indicadores executivos."
        actions={
          <Button onClick={() => navigate("/app/financeiro/contas-pagar")} className="gap-2">
            <FileSignature className="h-4 w-4" /> Aprovar pagamentos
          </Button>
        }
      />

      {/* Alerta de autorização */}
      {isUnauthorized && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso ao caixa restrito</AlertTitle>
          <AlertDescription>
            Você não tem permissão para visualizar o caixa consolidado pela RPC pres_caixa_status (42501).
            Solicite acesso ao perfil de Presidência ou Administração.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!caixaQ.isLoading && !isUnauthorized && caixaRows.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sem dados de caixa no escopo atual</AlertTitle>
          <AlertDescription>
            Nenhuma empresa retornada por pres_caixa_status. Verifique vínculos de empresa do usuário.
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de pendências */}
      {!isUnauthorized && (totalPendencias > 0 || totalSemMatch > 0 || totalInvalidos > 0) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Confiabilidade do caixa</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-4 text-xs">
            <span>{totalPendencias} aliases pendentes</span>
            <span>{totalSemMatch} movimentos sem match</span>
            <span>{totalInvalidos} valores inválidos</span>
          </AlertDescription>
        </Alert>
      )}

      {/* HERO de caixa consolidado */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/70 p-8 text-primary-foreground shadow-2xl">
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at top right, hsl(var(--primary-foreground) / 0.28) 0%, transparent 60%)" }} />
        <div className="relative grid gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
              <Crown className="h-3.5 w-3.5" /> Caixa Consolidado do Grupo
            </div>
            <p className="mt-3 font-display text-5xl font-black tabular-nums">
              {fmtBRL(caixaTotal)}
            </p>
            <p className="mt-2 text-sm opacity-90">
              Disponibilidades em {caixaRows.length} empresas controladas
            </p>
            {haggRow && (
              <p className="mt-2 inline-flex items-center gap-2 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                HAGG: {statusMeta[haggRow.status_confiabilidade].label}
              </p>
            )}
          </div>
          <div className="flex flex-col justify-center gap-1.5 text-sm">
            <div className="mb-1 flex items-center gap-1">
              <span className="mr-1 text-[10px] uppercase tracking-wider opacity-70">Período</span>
              {[7, 15, 30, 60, 90].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p as 7 | 15 | 30 | 60 | 90)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${periodo === p ? "bg-primary-foreground text-primary" : "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20"}`}
                >
                  {p}d
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">A Receber ({periodo}d)</span>
              <strong className="tabular-nums">{fmtBRL(totalAReceber)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">A Pagar ({periodo}d)</span>
              <strong className="tabular-nums">{fmtBRL(totalAPagar)}</strong>
            </div>
            <div className="my-1 h-px bg-primary-foreground/20" />
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
          {caixaRows.map((r) => {
            const m = statusMeta[r.status_confiabilidade];
            return (
              <Card key={r.empresa_id} className="p-4 transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{r.empresa_codigo}</p>
                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${m.cls}`}>{m.label}</span>
                </div>
                <p className="mt-3 font-display text-xl font-bold tabular-nums">{fmtBRL(r.saldo_liquido)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {r.qtd_movimentos_com_alias} ok · {r.qtd_movimentos_sem_match} s/match
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Malotes */}
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
                  <p className="text-[11px] text-muted-foreground">{a.tipo} · {fmtDate(a.criado_em)}</p>
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Activity className="h-4 w-4 text-primary" /> Resumo executivo — Plano de Ações & Fluxo de Caixa
          </h2>
          <Badge variant="outline" className="font-mono text-[10px]">{planoStats.total} ações</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-lg backdrop-blur-sm">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5 text-primary" /> Status das Ações
              </div>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planoStats.statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {planoStats.statusData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-card via-card to-accent/10 p-4 shadow-lg">
            <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-accent" /> Distribuição por Prioridade
              </div>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planoStats.prioData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {planoStats.prioData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-lg">
            <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" /> Top Áreas (volume)
              </div>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planoStats.areaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {planoStats.areaData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>

        <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-lg">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Fluxo de Caixa — Realizado x Projetado (6 meses)
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" /> Entradas</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive" /> Saídas</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> Líquido projetado</span>
              </div>
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fluxoChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLcompact(Number(v))} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: any) => fmtBRL(Number(v))}
                  />
                  <Bar dataKey="realizadoEntrada" name="Entradas (realizado)" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="realizadoSaida"  name="Saídas (realizado)"   fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="projetadoLiquido" name="Líquido projetado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-destructive/20 shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-destructive/10 via-warning/5 to-transparent px-4 py-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-destructive" />
              <h3 className="font-display font-bold">Ações mais críticas — atenção da Presidência</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate("/app/plano-acoes/dashboard")}>
              Ver plano completo <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Ação</th>
                  <th className="px-4 py-2 text-left">Área</th>
                  <th className="px-4 py-2 text-left">Responsável</th>
                  <th className="px-4 py-2 text-center">Prioridade</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-left">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {acoesCriticas.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhuma ação crítica no momento</td></tr>
                )}
                {acoesCriticas.map((a: any) => {
                  const prio = a.prioridade_normalizada ?? "—";
                  const prioColor =
                    prio === "emergencial" ? "bg-destructive-soft text-destructive border-destructive/30" :
                    prio === "alta"        ? "bg-warning-soft text-warning border-warning/30" :
                    "bg-muted text-muted-foreground";
                  const status = a.status_normalizado ?? "—";
                  const stColor =
                    status === "atrasada"  ? "bg-destructive-soft text-destructive border-destructive/30" :
                    status === "concluida" ? "bg-success-soft text-success border-success/30" :
                    "bg-muted text-muted-foreground";
                  return (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="max-w-[320px] truncate px-4 py-2 font-medium">{a.titulo}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.area ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.responsavel_nome_origem ?? "—"}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold capitalize ${prioColor}`}>{prio}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold capitalize ${stColor}`}>{status.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{fmtDate(a.data_fim_planejado ?? a.data_fim_planejado_original)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <TrendingUp className="h-4 w-4 text-primary" /> Atalhos executivos
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <ShortcutCard icon={<Wallet />}        title="Fluxo de Caixa"     desc="Posição diária consolidada" onClick={() => navigate("/app/financeiro/fluxo-caixa")} />
          <ShortcutCard icon={<TrendingDown />}  title="DRE Gerencial"      desc="Resultado por empresa"      onClick={() => navigate("/app/controladoria/dre-gerencial")} />
          <ShortcutCard icon={<Users />}         title="Plano de Ações"     desc="Iniciativas em curso"       onClick={() => navigate("/app/plano-acoes/dashboard")} />
          <ShortcutCard icon={<Clock />}         title="Pipeline Comercial" desc="Oportunidades ativas"       onClick={() => navigate("/app/pipeline")} />
        </div>
      </div>
    </div>
  );
}

function KpiHero({
  icon, label, valor, sub, tone,
}: { icon: React.ReactNode; label: string; valor: string; sub: string; tone?: "warn" }) {
  return (
    <div className={`rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-3 backdrop-blur ${tone === "warn" ? "ring-1 ring-warning/40" : ""}`}>

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
