import { PageHeader } from "@/components/layout/PageHeader";
import { CheckCircle2, Clock, XCircle, AlertTriangle, RotateCcw, Crown, ShieldCheck, Briefcase } from "lucide-react";

const steps = [
  { label: "Analista", who: "Marcos Pinto", state: "done", date: "14/04 17:32" },
  { label: "Gerente de Licitação", who: "Renata Lima", state: "done", date: "15/04 11:08" },
  { label: "Controladoria", who: "Eduardo Vargas", state: "done", date: "16/04 09:45" },
  { label: "Diretoria Administrativa", who: "Sandra Müller", state: "current", date: "—" },
  { label: "Presidência (exceção)", who: "Aguardando alçada", state: "pending", date: "—" },
] as const;

export default function Aprovacoes() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow de Aprovações"
        breadcrumb={["Aprovações"]}
        subtitle="Acompanhe alçadas, decisões e exceções de risco. Histórico completo e rastreável."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Pendentes", v: "7", t: "warning", i: Clock },
          { l: "Aprovadas (mês)", v: "23", t: "success", i: CheckCircle2 },
          { l: "Devoluções", v: "4", t: "info", i: RotateCcw },
          { l: "Rejeitadas", v: "1", t: "destructive", i: XCircle },
        ].map((s) => (
          <div key={s.l} className="card-elevated flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</p>
              <p className={`mt-2 font-display text-3xl font-bold text-${s.t}`}>{s.v}</p>
            </div>
            <div className={`grid h-10 w-10 place-items-center rounded-lg bg-${s.t}-soft text-${s.t}`}><s.i className="h-5 w-5" /></div>
          </div>
        ))}
      </div>

      {/* Stepper */}
      <section className="card-elevated p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processo em curso</p>
            <h2 className="mt-1 font-display text-lg font-bold">PE 077/2025 — Construção de via marginal · Curitiba</h2>
          </div>
          <span className="chip border border-warning/30 bg-warning-soft text-warning"><AlertTriangle className="h-3 w-3" /> Exceção de risco — alçada presidência</span>
        </div>

        <div className="relative mt-8 flex items-start justify-between">
          {steps.map((s, i) => {
            const Icon = s.label === "Diretoria Administrativa" ? Briefcase : s.label.includes("Presidência") ? Crown : ShieldCheck;
            const stateClass =
              s.state === "done" ? "bg-success text-success-foreground border-success" :
              s.state === "current" ? "bg-accent text-accent-foreground border-accent shadow-accent-glow animate-pulse-soft" :
              "bg-card text-muted-foreground border-border";
            return (
              <div key={s.label} className="relative flex flex-1 flex-col items-center">
                {i < steps.length - 1 && (
                  <div className={`absolute left-1/2 top-5 h-0.5 w-full ${s.state === "done" ? "bg-success" : "bg-border"}`} />
                )}
                <div className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 ${stateClass}`}>
                  {s.state === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="mt-3 max-w-[140px] text-center">
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.who}</p>
                  <p className="text-[10px] text-muted-foreground">{s.date}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progresso */}
        <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-to-r from-success via-success to-accent" style={{ width: "60%" }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>3 de 5 etapas concluídas</span>
          <span>Decisão atual: <strong className="text-foreground">Diretoria Administrativa</strong></span>
        </div>
      </section>

      {/* Decisões */}
      <section className="card-elevated">
        <header className="border-b border-border px-5 py-3.5">
          <h2 className="font-display text-sm font-bold">Histórico de decisões</h2>
        </header>
        <ul className="divide-y divide-border">
          {[
            { who: "Eduardo Vargas", role: "Controladoria", action: "Aprovou com ressalvas", just: "Margem abaixo do alvo, mas mitigada por reajuste anual.", date: "16/04 09:45", tone: "success" },
            { who: "Renata Lima", role: "Gerente de Licitação", action: "Aprovou", just: "Endosso ao parecer técnico.", date: "15/04 11:08", tone: "success" },
            { who: "Marcos Pinto", role: "Analista", action: "Encaminhou parecer técnico", just: "Recomendação: prosseguir com ressalvas.", date: "14/04 17:32", tone: "info" },
          ].map((d, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-4">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-${d.tone}-soft text-${d.tone}`}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm"><strong>{d.who}</strong> <span className="text-muted-foreground">· {d.role}</span></p>
                  <p className="text-xs text-muted-foreground">{d.date}</p>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{d.action}</p>
                <p className="mt-0.5 text-xs italic text-muted-foreground">"{d.just}"</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
