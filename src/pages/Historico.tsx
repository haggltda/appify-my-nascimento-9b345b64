import { PageHeader } from "@/components/layout/PageHeader";
import { Download, Filter, Search, Activity, FileText, CheckCircle2, Sparkles, RotateCcw, XCircle, Edit3 } from "lucide-react";

const eventos = [
  { d: "2025-04-22 14:30:12", u: "Eduardo Vargas", r: "Controladoria", a: "Aprovou com ressalvas", l: "PE 044/2025", o: "Manual", t: "approve" },
  { d: "2025-04-22 11:08:44", u: "Renata Lima", r: "Gerente de Licitação", a: "Endossou parecer técnico", l: "PE 044/2025", o: "Manual", t: "approve" },
  { d: "2025-04-21 17:32:09", u: "Marcos Pinto", r: "Analista", a: "Encaminhou parecer", l: "PE 044/2025", o: "Manual", t: "edit" },
  { d: "2025-04-21 09:18:55", u: "Sistema", r: "IA", a: "Triagem por IA executada", l: "PE 044/2025", o: "IA", t: "ai" },
  { d: "2025-04-20 16:50:21", u: "Ana Carvalho", r: "Analista", a: "Editou cadastro do edital", l: "PE 044/2025", o: "Manual", t: "edit" },
  { d: "2025-04-19 10:05:33", u: "Sandra Müller", r: "Diretoria", a: "Reabriu processo", l: "PE 058/2025", o: "Manual", t: "reopen" },
  { d: "2025-04-18 15:42:11", u: "Marcos Pinto", r: "Analista", a: "Cancelou rascunho", l: "PE 077/2025", o: "Manual", t: "cancel" },
];

const iconMap: any = { approve: CheckCircle2, edit: Edit3, ai: Sparkles, reopen: RotateCcw, cancel: XCircle };
const toneMap: any = { approve: "success", edit: "info", ai: "accent", reopen: "warning", cancel: "destructive" };

export default function Historico() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico & Auditoria"
        breadcrumb={["Histórico & Auditoria"]}
        subtitle="Linha do tempo completa de cada ação. Quem, o que, quando, origem e contexto - preservados."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Download className="h-3.5 w-3.5" /> Exportar histórico
            </button>
          </>
        }
      />

      <div className="card-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Buscar por usuário, ação, processo…"
              className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <select className="h-9 rounded-md border border-border bg-card px-3 text-xs"><option>Todas as ações</option></select>
          <select className="h-9 rounded-md border border-border bg-card px-3 text-xs"><option>Todos os usuários</option></select>
          <select className="h-9 rounded-md border border-border bg-card px-3 text-xs"><option>Últimos 30 dias</option></select>
        </div>

        <ul className="divide-y divide-border">
          {eventos.map((e, i) => {
            const Icon = iconMap[e.t] || Activity;
            const tone = toneMap[e.t] || "info";
            return (
              <li key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-${tone}-soft text-${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{e.a}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{e.l}</span>
                    {e.o === "IA" && <span className="chip border border-accent/30 bg-accent-soft text-accent"><Sparkles className="h-3 w-3" /> IA</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <strong className="text-foreground">{e.u}</strong> · {e.r} · {e.d} · origem {e.o}
                  </p>
                </div>
                <button className="text-xs font-medium text-primary hover:underline">Ver contexto</button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-xs text-info">
        <FileText className="mr-1.5 inline h-3.5 w-3.5" />
        Trilha imutável. Os registros não podem ser alterados ou removidos. Exportações são assinadas digitalmente.
      </div>
    </div>
  );
}
