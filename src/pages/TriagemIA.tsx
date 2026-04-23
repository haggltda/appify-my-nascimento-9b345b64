import { PageHeader } from "@/components/layout/PageHeader";
import { Sparkles, Play, ShieldAlert, CheckCircle2, AlertTriangle, Info, FileSearch, History } from "lucide-react";

export default function TriagemIA() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Triagem & Análise por IA"
        breadcrumb={["Triagem & IA"]}
        subtitle="Análise assistida de viabilidade e risco. A IA apoia a decisão — a aprovação humana é obrigatória."
        actions={
          <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
            <Play className="h-3.5 w-3.5" /> Executar análise
          </button>
        }
      />

      <div className="rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Ação assistida por IA.</strong> Toda execução é registrada com responsável, data, hora e parâmetros. A IA fornece sugestões — a decisão final cabe ao analista responsável.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card-elevated">
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="font-display text-sm font-bold">Resultado da análise — PE 142/2025</h2>
              </div>
              <span className="chip border border-success/30 bg-success-soft text-success">
                <CheckCircle2 className="h-3 w-3" /> Análise concluída
              </span>
            </header>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Score label="Viabilidade" value="Alta" tone="success" pct={82} />
              <Score label="Risco geral" value="Médio" tone="warning" pct={58} />
              <Score label="Aderência técnica" value="Alta" tone="success" pct={88} />
            </div>
            <div className="border-t border-border px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Critérios analisados</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { c: "Capacidade técnica exigida", r: "Atendida", t: "success" },
                  { c: "Atestados compatíveis", r: "Atendido", t: "success" },
                  { c: "Garantia financeira", r: "Atender com aval", t: "warning" },
                  { c: "Prazo de execução", r: "Apertado", t: "warning" },
                  { c: "Restrições de habilitação", r: "Sem restrições", t: "success" },
                  { c: "Histórico do órgão", r: "Pagamento regular", t: "success" },
                ].map((i) => (
                  <div key={i.c} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs">
                    <span>{i.c}</span>
                    <span className={`chip border bg-${i.t}-soft text-${i.t} border-${i.t}/30`}>{i.r}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card-elevated">
            <header className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <h2 className="font-display text-sm font-bold">Riscos e pontos de atenção</h2>
            </header>
            <ul className="divide-y divide-border">
              {[
                { tone: "warning", t: "Margem operacional projetada abaixo do alvo", d: "A planilha base sugere margem de 7,2%, abaixo do mínimo institucional. Reavaliar com controladoria." },
                { tone: "warning", t: "Cláusula de reajuste anual atípica", d: "Indexador combinado IPCA+INCC com revisão bienal — impacto em contratos longos." },
                { tone: "destructive", t: "Garantia exigida acima do habitual", d: "10% do valor do contrato em apólice — verificar disponibilidade junto à seguradora." },
              ].map((r, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 text-${r.tone}`} />
                  <div>
                    <p className="text-sm font-semibold">{r.t}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card-elevated p-4">
            <h3 className="font-display text-sm font-bold">Revisão humana</h3>
            <p className="mt-1 text-xs text-muted-foreground">Confirme que o resultado da IA foi revisado antes de seguir para parecer técnico.</p>
            <button className="btn-relief mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como revisada
            </button>
          </div>
          <div className="card-elevated p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold"><History className="h-3.5 w-3.5" /> Execuções anteriores</h3>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                { d: "16/04 14:32", a: "Ana Carvalho", v: "v3" },
                { d: "15/04 09:18", a: "Ana Carvalho", v: "v2" },
                { d: "12/04 17:55", a: "Marcos Pinto", v: "v1" },
              ].map((e, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
                  <div>
                    <p className="font-medium">{e.d}</p>
                    <p className="text-muted-foreground">{e.a}</p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{e.v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-elevated p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold"><FileSearch className="h-3.5 w-3.5" /> Trilha de auditoria</h3>
            <p className="mt-2 text-xs text-muted-foreground">Cada execução de IA é registrada na trilha de auditoria do processo.</p>
            <button className="mt-2 text-xs font-medium text-primary hover:underline">Ver trilha completa →</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Score({ label, value, tone, pct }: { label: string; value: string; tone: string; pct: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold text-${tone}`}>{value}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full bg-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{pct}/100</p>
    </div>
  );
}
