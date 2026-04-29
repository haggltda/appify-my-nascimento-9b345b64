import { PageHeader } from "@/components/layout/PageHeader";
import { useContratos, formatBRL } from "@/hooks/useContratos";
import { CalendarRange, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Faturamento() {
  const { data: contratos = [], isLoading } = useContratos();
  const ativos = contratos.filter((c) => c.status === "ativo" || c.status === "implantacao");

  const previstoMes = ativos.reduce((acc, c) => acc + Number(c.faturamento_mensal ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cronograma de Faturamento"
        module="Contratos"
        breadcrumb={["Contratos", "Faturamento"]}
        subtitle="Visão consolidada das parcelas mensais por contrato — tabela de cronograma chega no próximo bloco."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Previsto no mês" v={formatBRL(previstoMes)} />
        <Kpi label="Faturado" v="—" t="success" />
        <Kpi label="A emitir" v="—" t="warning" />
        <Kpi label="Atrasado" v="—" t="destructive" />
      </div>

      <div className="card-elevated overflow-hidden">
        <header className="border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-bold">Calendário de parcelas — exercício {new Date().getFullYear()}</h3>
          <p className="text-xs text-muted-foreground">Visualização simulada com base no faturamento mensal de cada contrato. A integração definitiva virá com `cronograma_faturamento` no Bloco Orçamento.</p>
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
              {isLoading && (
                <tr><td colSpan={13} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && ativos.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-8 text-center text-muted-foreground">Nenhum contrato ativo.</td></tr>
              )}
              {ativos.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="sticky left-0 bg-card px-4 py-3">
                    <p className="font-semibold">{c.numero}</p>
                    <p className="text-[11px] text-muted-foreground">{formatBRL(Number(c.faturamento_mensal))}/mês</p>
                  </td>
                  {meses.map((_, i) => {
                    const mesAtual = new Date().getMonth();
                    const status = i < mesAtual ? "ok" : i === mesAtual ? "now" : i <= mesAtual + 2 ? "wait" : "future";
                    const map: Record<string, string> = {
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
