import { PageHeader } from "@/components/layout/PageHeader";
import { Receipt, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { formatBRL } from "@/data/contratos";

const encerramentos = [
  {
    n: "CT 2024/0076", o: "Vigilância patrimonial - TCE",
    fim: "2025-05-31", v: 8_640_000,
    checks: { docs: true, financeiro: true, fiscal: true, devolucoes: false, distrato: false },
  },
  {
    n: "CT 2023/0211", o: "Manutenção predial - Hospital Regional",
    fim: "2025-04-30", v: 5_120_000,
    checks: { docs: true, financeiro: true, fiscal: true, devolucoes: true, distrato: true },
  },
];

export default function Encerramentos() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Encerramentos de Contrato"
        breadcrumb={["Contratos", "Encerramentos"]}
        subtitle="Procedimentos finais - quitação, devoluções, distrato, baixas fiscais e arquivamento documental."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Em encerramento" v="2" t="warning" />
        <Kpi label="Concluídos no ano" v="7" t="success" />
        <Kpi label="Aguardando distrato" v="1" t="info" />
      </div>

      <div className="space-y-4">
        {encerramentos.map((e) => (
          <article key={e.n} className="card-elevated overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-sm"><Receipt className="h-5 w-5" /></div>
                <div>
                  <p className="font-mono text-[11px] text-muted-foreground">{e.n}</p>
                  <h3 className="font-display text-base font-bold">{e.o}</h3>
                  <p className="text-xs text-muted-foreground">Fim de vigência {new Date(e.fim).toLocaleDateString("pt-BR")} · Valor total {formatBRL(e.v)}</p>
                </div>
              </div>
              <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                <FileText className="h-4 w-4" /> Gerar termo de encerramento
              </button>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-5">
              <Check ok={e.checks.docs} label="Documentação final" />
              <Check ok={e.checks.financeiro} label="Quitação financeira" />
              <Check ok={e.checks.fiscal} label="Baixa fiscal" />
              <Check ok={e.checks.devolucoes} label="Devolução de bens" />
              <Check ok={e.checks.distrato} label="Distrato assinado" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, v, t }: { label: string; v: string; t: string }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold text-${t}`}>{v}</p>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${ok ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft"}`}>
      <div className={`grid h-7 w-7 place-items-center rounded-md ${ok ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      </div>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className={`text-[11px] ${ok ? "text-success" : "text-warning"}`}>{ok ? "OK" : "Pendente"}</p>
      </div>
    </div>
  );
}
