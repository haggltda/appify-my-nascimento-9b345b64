import { PageHeader } from "@/components/layout/PageHeader";
import { contratos, formatBRL } from "@/data/contratos";
import { CalendarRange, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Faturamento() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cronograma de Faturamento"
        breadcrumb={["Contratos", "Faturamento"]}
        subtitle="Visão consolidada das parcelas mensais por contrato — emissão, envio e liquidação."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Previsto no mês" v="R$ 12,8M" />
        <Kpi label="Faturado" v="R$ 8,4M" t="success" />
        <Kpi label="A emitir" v="R$ 4,4M" t="warning" />
        <Kpi label="Atrasado" v="R$ 0,3M" t="destructive" />
      </div>

      <div className="card-elevated overflow-hidden">
        <header className="border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-bold">Calendário de parcelas — exercício 2025</h3>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 bg-muted/50 px-4 py-3 text-left">Contrato</th>
                {meses.map((m) => (
                  <th key={m} className="px-2 py-3 text-center">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="sticky left-0 bg-card px-4 py-3">
                    <p className="font-semibold">{c.numero}</p>
                    <p className="text-[11px] text-muted-foreground">{formatBRL(c.faturamentoMensal)}/mês</p>
                  </td>
                  {meses.map((_, i) => {
                    const status = i < 3 ? "ok" : i < 5 ? "now" : i < 8 ? "wait" : "future";
                    const map: any = {
                      ok: "bg-success-soft text-success",
                      now: "bg-warning-soft text-warning",
                      wait: "bg-info-soft text-info",
                      future: "bg-muted text-muted-foreground",
                    };
                    const Icon: any = { ok: CheckCircle2, now: AlertCircle, wait: Clock, future: CalendarRange }[status];
                    return (
                      <td key={i} className="px-2 py-2">
                        <div className={`mx-auto grid h-7 w-7 place-items-center rounded-md ${map[status]}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </td>
                    );
                  })}
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
