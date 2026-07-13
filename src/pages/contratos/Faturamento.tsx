import { PageHeader } from "@/components/layout/PageHeader";
import { Link } from "react-router-dom";
import { useCronogramaTodos } from "@/hooks/useOrcamento";
import { formatBRL } from "@/hooks/useContratos";
import { CalendarRange, CheckCircle2, Clock, AlertCircle, FileX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const statusMap: Record<string, { cls: string; Icon: any; label: string }> = {
  previsto: { cls: "bg-info-soft text-info", Icon: Clock, label: "Previsto" },
  emitido: { cls: "bg-warning-soft text-warning", Icon: AlertCircle, label: "Emitido" },
  recebido: { cls: "bg-success-soft text-success", Icon: CheckCircle2, label: "Recebido" },
  atrasado: { cls: "bg-destructive/15 text-destructive", Icon: AlertCircle, label: "Atrasado" },
  cancelado: { cls: "bg-muted text-muted-foreground", Icon: FileX, label: "Cancelado" },
};

export default function Faturamento() {
  const { data: parcelas = [], isLoading } = useCronogramaTodos();
  const ano = new Date().getFullYear();

  // Agrupa por contrato
  const porContrato = new Map<string, any>();
  parcelas.forEach((p: any) => {
    const key = p.contrato_id;
    if (!porContrato.has(key)) {
      porContrato.set(key, { contrato: p.contrato, contrato_id: key, parcelas: [] });
    }
    porContrato.get(key)!.parcelas.push(p);
  });
  const linhas = Array.from(porContrato.values());

  const previstoAno = parcelas
    .filter((p: any) => new Date(p.competencia).getFullYear() === ano)
    .reduce((acc: number, p: any) => acc + Number(p.valor_previsto), 0);
  const recebidoAno = parcelas.reduce((acc: number, p: any) => acc + Number(p.valor_recebido ?? 0), 0);
  const emitidoAno = parcelas.reduce((acc: number, p: any) => acc + Number(p.valor_emitido ?? 0), 0);
  const atrasados = parcelas.filter((p: any) => p.status === "atrasado").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cronograma de Faturamento"
        module="Contratos"
        breadcrumb={["Contratos", "Faturamento"]}
        subtitle="Parcelas geradas a partir do orçamento de cada contrato."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label={`Previsto ${ano}`} v={formatBRL(previstoAno)} />
        <Kpi label="Emitido" v={formatBRL(emitidoAno)} t="warning" />
        <Kpi label="Recebido" v={formatBRL(recebidoAno)} t="success" />
        <Kpi label="Atrasados" v={String(atrasados)} t="destructive" />
      </div>

      <div className="card-elevated overflow-hidden">
        <header className="border-b border-border px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold">Calendário de parcelas - {ano}</h3>
            <p className="text-xs text-muted-foreground">Para popular: gere o orçamento do contrato em <Link to="/app/orcamento" className="text-primary underline">Orçamento</Link>.</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 bg-muted/50 px-4 py-3 text-left">Contrato</th>
                {meses.map((m) => <th key={m} className="px-2 py-3 text-center">{m}</th>)}
                <th className="px-3 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && linhas.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">Nenhuma parcela. Gere orçamento em <Link to="/app/orcamento" className="text-primary underline">/app/orcamento</Link>.</td></tr>
              )}
              {linhas.map((l) => {
                const totalAno = l.parcelas
                  .filter((p: any) => new Date(p.competencia).getFullYear() === ano)
                  .reduce((acc: number, p: any) => acc + Number(p.valor_previsto), 0);
                return (
                  <tr key={l.contrato_id} className="border-t border-border">
                    <td className="sticky left-0 bg-card px-4 py-3">
                      <Link to={`/app/contratos/${l.contrato_id}`} className="font-semibold text-primary hover:underline">{l.contrato?.numero ?? l.contrato_id.slice(0, 8)}</Link>
                    </td>
                    {meses.map((_, i) => {
                      const p = l.parcelas.find((x: any) => {
                        const d = new Date(x.competencia);
                        return d.getFullYear() === ano && d.getMonth() === i;
                      });
                      if (!p) {
                        return <td key={i} className="px-2 py-2"><div className="mx-auto grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground"><CalendarRange className="h-3.5 w-3.5" /></div></td>;
                      }
                      const cfg = statusMap[p.status] ?? statusMap.previsto;
                      return (
                        <td key={i} className="px-2 py-2" title={`${cfg.label} · ${formatBRL(Number(p.valor_previsto))}`}>
                          <div className={`mx-auto grid h-7 w-7 place-items-center rounded-md ${cfg.cls}`}><cfg.Icon className="h-3.5 w-3.5" /></div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right font-mono text-xs">{formatBRL(totalAno)}</td>
                  </tr>
                );
              })}
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
