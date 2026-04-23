import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { contratos, formatBRL, statusContratoLabel } from "@/data/contratos";
import { Building2, Search, Filter, Download, ArrowUpRight } from "lucide-react";

export default function ContratosAtivos() {
  const [q, setQ] = useState("");
  const list = contratos.filter((c) => c.objeto.toLowerCase().includes(q.toLowerCase()) || c.numero.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos Ativos"
        breadcrumb={["Contratos", "Ativos"]}
        subtitle="Carteira completa de contratos vigentes, suspensos e em implantação."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
              Novo contrato
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Contratos ativos" v="18" />
        <Kpi label="Em implantação" v="3" />
        <Kpi label="Faturamento mensal" v="R$ 12,8M" />
        <Kpi label="Reajustes pendentes" v="4" t="warning" />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, objeto ou órgão..."
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Contrato</th>
                <th className="px-4 py-3">Objeto</th>
                <th className="px-4 py-3">Órgão / Empresa</th>
                <th className="px-4 py-3">Vigência</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Postos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[11px] text-muted-foreground">{c.origemLicitacao}</p>
                    <p className="font-semibold">{c.numero}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex items-start gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"><Building2 className="h-3.5 w-3.5" /></div>
                      <span className="line-clamp-2">{c.objeto}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{c.orgao}</p>
                    <p className="text-[11px]">Empresa {c.empresa}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{new Date(c.vigenciaInicio).toLocaleDateString("pt-BR")}</p>
                    <p className="text-[11px]">até {new Date(c.vigenciaFim).toLocaleDateString("pt-BR")}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatBRL(c.valorTotal)}</td>
                  <td className="px-4 py-3 text-right">{c.postos}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, v, t = "primary" }: { label: string; v: string; t?: string }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold text-${t}`}>{v}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: keyof typeof statusContratoLabel }) {
  const map: Record<string, string> = {
    ativo: "bg-success-soft text-success",
    implantacao: "bg-info-soft text-info",
    suspenso: "bg-warning-soft text-warning",
    encerrado: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[status]}`}>{statusContratoLabel[status]}</span>;
}
