import { PageHeader } from "@/components/layout/PageHeader";
import { Users2, MapPin, Briefcase, Plus } from "lucide-react";

const postos = [
  { cargo: "Agente de limpeza I", qtd: 84, local: "Zona Sul — Setores 1 a 5", contrato: "CT 2025/0118", jornada: "44h" },
  { cargo: "Encarregado operacional", qtd: 12, local: "Zona Sul — Base SLU", contrato: "CT 2025/0118", jornada: "44h" },
  { cargo: "Motorista de coleta", qtd: 24, local: "Zona Sul — Garagem central", contrato: "CT 2025/0118", jornada: "44h" },
  { cargo: "Auxiliar rodoviário", qtd: 56, local: "BR-XXX km 120-280", contrato: "CT 2025/0094", jornada: "44h" },
  { cargo: "Vigilante 12x36 diurno", qtd: 18, local: "TCE — Sede Administrativa", contrato: "CT 2024/0076", jornada: "12x36" },
];

export default function Postos() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Postos & Alocações"
        breadcrumb={["Contratos", "Postos"]}
        subtitle="Quadro completo de postos contratados, locais de prestação e jornadas vigentes."
        actions={
          <button className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
            <Plus className="h-4 w-4" /> Novo posto
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Total de postos" v="312" />
        <Kpi label="Mobilizados" v="294" t="success" />
        <Kpi label="Vagas em aberto" v="18" t="warning" />
        <Kpi label="Locais ativos" v="22" t="info" />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3 text-right">Quantidade</th>
              <th className="px-4 py-3">Local de prestação</th>
              <th className="px-4 py-3">Jornada</th>
              <th className="px-4 py-3">Contrato</th>
            </tr>
          </thead>
          <tbody>
            {postos.map((p, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-soft text-primary"><Briefcase className="h-3.5 w-3.5" /></div>
                    <span className="font-semibold">{p.cargo}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{p.qtd}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {p.local}</span>
                </td>
                <td className="px-4 py-3"><span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold">{p.jornada}</span></td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{p.contrato}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
