import { PageHeader } from "@/components/layout/PageHeader";
import { Building2, CheckCircle2, AlertCircle, ArrowRight, FileText, ShieldCheck, ClipboardCheck } from "lucide-react";
import { usePermissoes } from "@/context/PermissoesContext";

const candidatas = [
  {
    n: "PE 044/2025", o: "Limpeza urbana e coleta seletiva", emp: "NSV", v: "R$ 28,30M",
    checks: { docs: true, aprov: true, controll: true, ata: true }, ready: true,
  },
  {
    n: "PE 058/2025", o: "Locação de software de gestão patrimonial", emp: "NTC", v: "R$ 3,24M",
    checks: { docs: true, aprov: true, controll: false, ata: true }, ready: false,
  },
  {
    n: "RDC 012/2025", o: "Reforma de estação elevatória — fase 2", emp: "NEN", v: "R$ 11,75M",
    checks: { docs: false, aprov: true, controll: true, ata: false }, ready: false,
  },
];

export default function ProntasContrato() {
  const { can } = usePermissoes();
  // B2.1.d — Fase 7 (ProntasContrato): permissões finas
  const canAprovar = can("aprovar", "licitacoes", "prontas-contrato");
  const canAlterar = can("alterar", "licitacoes", "prontas-contrato");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prontas para Contrato"
        breadcrumb={["Prontas p/ Contrato"]}
        subtitle="Licitações vencedoras consolidadas. Acompanhe o checklist e libere o handoff ao módulo de contratos."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { l: "Aptas para migração", v: "1", t: "success" },
          { l: "Com pendências", v: "2", t: "warning" },
          { l: "Em handoff", v: "0", t: "info" },
        ].map((s) => (
          <div key={s.l} className="card-elevated p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 font-display text-3xl font-bold text-${s.t}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {candidatas.map((c) => (
          <article key={c.n} className="card-elevated overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${c.ready ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"} shadow-sm`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-[11px] text-muted-foreground">{c.n}</p>
                  <h3 className="font-display text-base font-bold">{c.o}</h3>
                  <p className="text-xs text-muted-foreground">Empresa {c.emp} · Valor estimado {c.v}</p>
                </div>
              </div>
              {(() => {
                const acaoPermitida = c.ready ? canAprovar : canAlterar;
                const tooltip = acaoPermitida
                  ? undefined
                  : c.ready
                    ? "Sem permissão para migrar para Contratos"
                    : "Sem permissão para alterar pendências";
                return (
                  <button
                    disabled={!acaoPermitida || (!c.ready && !canAlterar)}
                    title={tooltip}
                    className={`btn-relief inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                      c.ready ? "bg-gradient-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.ready ? "Migrar para Contrato" : "Resolver pendências"}
                    {c.ready && <ArrowRight className="h-4 w-4" />}
                  </button>
                );
              })()}
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-4">
              <Check ok={c.checks.docs} label="Documentação" icon={FileText} />
              <Check ok={c.checks.aprov} label="Aprovações" icon={CheckCircle2} />
              <Check ok={c.checks.controll} label="Controladoria" icon={ShieldCheck} />
              <Check ok={c.checks.ata} label="Ata de pregão" icon={ClipboardCheck} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Check({ ok, label, icon: Icon }: { ok: boolean; label: string; icon: any }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${ok ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft"}`}>
      <div className={`grid h-8 w-8 place-items-center rounded-md ${ok ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      </div>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className={`text-[11px] ${ok ? "text-success" : "text-warning"}`}>{ok ? "OK" : "Pendente"}</p>
      </div>
    </div>
  );
}
