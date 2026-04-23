import { PageHeader } from "@/components/layout/PageHeader";
import { Ruler, FileCheck2, Plus } from "lucide-react";
import { formatBRL } from "@/data/contratos";

const medicoes = [
  { ref: "MED 0008/2025", contrato: "CT 2025/0118", periodo: "Out/2025", valor: 2_358_333, status: "aprovada", responsavel: "Marcos R. Tavares" },
  { ref: "MED 0009/2025", contrato: "CT 2025/0118", periodo: "Nov/2025", valor: 2_358_333, status: "em_revisao", responsavel: "Marcos R. Tavares" },
  { ref: "MED 0004/2025", contrato: "CT 2025/0094", periodo: "Out/2025", valor: 1_995_833, status: "aprovada", responsavel: "Rita C. Albuquerque" },
  { ref: "MED 0005/2025", contrato: "CT 2025/0094", periodo: "Nov/2025", valor: 1_995_833, status: "rascunho", responsavel: "Rita C. Albuquerque" },
];

export default function Medicoes() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Medições"
        breadcrumb={["Contratos", "Medições"]}
        subtitle="Registro mensal de execução para liberação de faturamento e acompanhamento físico-financeiro."
        actions={
          <button className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
            <Plus className="h-4 w-4" /> Nova medição
          </button>
        }
      />

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Referência</th>
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {medicoes.map((m) => (
              <tr key={m.ref} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-soft text-primary"><Ruler className="h-3.5 w-3.5" /></div>
                    <span className="font-mono font-semibold">{m.ref}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{m.contrato}</td>
                <td className="px-4 py-3">{m.periodo}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{formatBRL(m.valor)}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.responsavel}</td>
                <td className="px-4 py-3"><Status s={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Status({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    aprovada: ["bg-success-soft text-success", "Aprovada"],
    em_revisao: ["bg-info-soft text-info", "Em revisão"],
    rascunho: ["bg-muted text-muted-foreground", "Rascunho"],
  };
  const [cls, label] = map[s];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>;
}
