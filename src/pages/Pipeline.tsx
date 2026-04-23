import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusChip, CriticidadeChip } from "@/components/StatusChip";
import { licitacoes, statusOrdem, statusLabel, formatBRL, formatDate, type StatusLicitacao } from "@/data/licitacoes";
import { LayoutGrid, List, Filter, Plus, Search, Calendar, Building, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Pipeline() {
  const [view, setView] = useState<"kanban" | "tabela">("kanban");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline de Oportunidades"
        breadcrumb={["Pipeline"]}
        subtitle="Acompanhe a evolução dos editais por etapa do fluxo. Alterne entre visão Kanban executiva e tabela operacional."
        actions={
          <>
            <div className="inline-flex h-9 items-center rounded-md border border-border bg-card p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium",
                  view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setView("tabela")}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium",
                  view === "tabela" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="h-3.5 w-3.5" /> Tabela
              </button>
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Filter className="h-3.5 w-3.5" /> Filtros avançados
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
              <Plus className="h-3.5 w-3.5" /> Nova Oportunidade
            </button>
          </>
        }
      />

      {/* Filtros rápidos */}
      <div className="card-elevated flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar por número, órgão ou objeto…"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <FilterPill label="Empresa" value="Todas" />
        <FilterPill label="Modalidade" value="Todas" />
        <FilterPill label="Órgão" value="Todos" />
        <FilterPill label="Criticidade" value="Todas" />
        <FilterPill label="Período" value="Últimos 90 dias" icon={<Calendar className="h-3 w-3" />} />
      </div>

      {view === "kanban" ? <KanbanView /> : <TableView />}
    </div>
  );
}

function FilterPill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary">
      {icon}
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </button>
  );
}

function KanbanView() {
  const cols: StatusLicitacao[] = ["oportunidade", "em_analise", "parecer_tecnico", "controladoria", "aprovacao_diretoria", "pregao", "vencida"];
  return (
    <div className="overflow-x-auto pb-4 scroll-elegant">
      <div className="flex gap-4" style={{ minWidth: cols.length * 300 }}>
        {cols.map((s) => {
          const items = licitacoes.filter((l) => l.status === s);
          return (
            <div key={s} className="w-[300px] shrink-0">
              <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <StatusChip status={s} />
                  <span className="text-xs font-semibold text-muted-foreground">{items.length}</span>
                </div>
                <button className="text-muted-foreground hover:text-foreground"><MoreVertical className="h-3.5 w-3.5" /></button>
              </div>
              <div className="space-y-2.5">
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum processo nesta etapa
                  </div>
                )}
                {items.map((l) => (
                  <article key={l.id} className="card-floating cursor-pointer p-3.5 hover:border-primary/40">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[11px] text-muted-foreground">{l.numero}</p>
                      <CriticidadeChip value={l.criticidade} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug">{l.objeto}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Building className="h-3 w-3" /> {l.orgao}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{l.empresa}</span>
                      <span className="font-mono text-[11px] font-semibold">{formatBRL(l.valorEstimado)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{l.responsavel}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {formatDate(l.prazo)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableView() {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Processo</th>
              <th className="px-3 py-3 text-left">Órgão / Modalidade</th>
              <th className="px-3 py-3 text-left">Empresa</th>
              <th className="px-3 py-3 text-left">Etapa</th>
              <th className="px-3 py-3 text-left">Criticidade</th>
              <th className="px-3 py-3 text-right">Valor</th>
              <th className="px-3 py-3 text-left">Responsável</th>
              <th className="px-5 py-3 text-right">Prazo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {licitacoes.map((l) => (
              <tr key={l.id} className="group cursor-pointer hover:bg-muted/40">
                <td className="px-5 py-3">
                  <p className="font-mono text-[11px] text-muted-foreground">{l.numero}</p>
                  <p className="line-clamp-1 max-w-sm text-sm font-medium">{l.objeto}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs">{l.orgao}</p>
                  <p className="text-[11px] text-muted-foreground">{l.modalidade}</p>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{l.empresa}</span>
                </td>
                <td className="px-3 py-3"><StatusChip status={l.status} /></td>
                <td className="px-3 py-3"><CriticidadeChip value={l.criticidade} /></td>
                <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{formatBRL(l.valorEstimado)}</td>
                <td className="px-3 py-3 text-xs">{l.responsavel}</td>
                <td className="px-5 py-3 text-right text-xs text-muted-foreground">{formatDate(l.prazo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>Mostrando 1–{licitacoes.length} de {licitacoes.length} processos</span>
        <div className="flex items-center gap-1">
          <button className="rounded border border-border px-2 py-1 hover:bg-secondary">Anterior</button>
          <button className="rounded bg-primary px-2 py-1 text-primary-foreground">1</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-secondary">Próximo</button>
        </div>
      </div>
    </div>
  );
}
