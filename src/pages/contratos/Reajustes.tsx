import { PageHeader } from "@/components/layout/PageHeader";
import { TrendingUp, Calendar, Plus } from "lucide-react";
import { formatBRL } from "@/data/contratos";

const reajustes = [
  { contrato: "CT 2025/0118", indice: "IPCA", base: "Mar/2024", aplicacao: "Mar/2026", variacao: 4.62, impacto: 1_307_460, status: "aplicado" },
  { contrato: "CT 2025/0094", indice: "IGPM", base: "Jan/2025", aplicacao: "Jan/2026", variacao: 3.18, impacto: 1_523_220, status: "previsto" },
  { contrato: "CT 2024/0076", indice: "IPCA", base: "Jun/2024", aplicacao: "Jun/2025", variacao: 4.23, impacto: 365_472, status: "negociacao" },
];

export default function Reajustes() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reajustes contratuais (IGPM / IPCA)"
        breadcrumb={["Contratos", "Reajustes"]}
        subtitle="Aplicação periódica de índices oficiais sobre valores contratados, conforme cláusula de reequilíbrio."
        actions={
          <button className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
            <Plus className="h-4 w-4" /> Calcular reajuste
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Índice IPCA acumulado 12m" v="4,62%" icon={TrendingUp} />
        <Card label="Índice IGPM acumulado 12m" v="3,18%" icon={TrendingUp} />
        <Card label="Próxima aplicação" v="Jan/2026" icon={Calendar} />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3">Índice</th>
              <th className="px-4 py-3">Data-base</th>
              <th className="px-4 py-3">Aplicação</th>
              <th className="px-4 py-3 text-right">Variação</th>
              <th className="px-4 py-3 text-right">Impacto anual</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {reajustes.map((r) => (
              <tr key={r.contrato} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3 font-mono font-semibold">{r.contrato}</td>
                <td className="px-4 py-3"><span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{r.indice}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{r.base}</td>
                <td className="px-4 py-3">{r.aplicacao}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-success">+{r.variacao.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{formatBRL(r.impacto)}</td>
                <td className="px-4 py-3">
                  {r.status === "aplicado" && <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">Aplicado</span>}
                  {r.status === "previsto" && <span className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">Previsto</span>}
                  {r.status === "negociacao" && <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">Em negociação</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, v, icon: Icon }: { label: string; v: string; icon: any }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-primary">{v}</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}
