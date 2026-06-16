import { PageHeader } from "@/components/layout/PageHeader";
import { contratos, formatBRL } from "@/data/contratos";
import { ListChecks, CheckCircle2, Clock, AlertCircle, Building2, Users2, FileSignature, Wallet, ShieldCheck } from "lucide-react";

const checklistImplantacao = [
  { key: "assinatura", label: "Assinatura do contrato", icon: FileSignature },
  { key: "empenho", label: "Cadastro de empenho", icon: Wallet },
  { key: "postos", label: "Mobilização de postos", icon: Users2 },
  { key: "epi", label: "Entrega de EPIs/uniformes", icon: ShieldCheck },
  { key: "kickoff", label: "Reunião de kick-off", icon: CheckCircle2 },
];

export default function Implantacao() {
  const emImplantacao = contratos.filter((c) => c.status === "implantacao");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Implantação de Contratos"
        breadcrumb={["Contratos", "Implantação"]}
        subtitle="Acompanhamento da fase de mobilização: do handoff da licitação até a operação plena."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Em implantação" v={String(emImplantacao.length)} t="info" icon={Clock} />
        <Kpi label="Aguardando empenho" v="2" t="warning" icon={Wallet} />
        <Kpi label="Postos mobilizados" v="46/92" t="info" icon={Users2} />
        <Kpi label="Concluídas no mês" v="3" t="success" icon={CheckCircle2} />
      </div>

      <div className="space-y-4">
        {emImplantacao.concat(contratos.filter((c) => c.status === "ativo").slice(0, 1)).map((c) => (
          <article key={c.id} className="card-elevated overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-[11px] text-muted-foreground">{c.numero} · origem {c.origemLicitacao}</p>
                  <h3 className="font-display text-base font-bold">{c.objeto}</h3>
                  <p className="text-xs text-muted-foreground">{c.orgao} · Empresa {c.empresa} · Valor {formatBRL(c.valorTotal)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">Em implantação</span>
                <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                  Abrir contrato
                </button>
              </div>
            </header>

            <div className="grid gap-4 p-5 md:grid-cols-5">
              {checklistImplantacao.map((it, i) => {
                const ok = i < 3;
                return (
                  <div key={it.key} className={`rounded-lg border p-3 ${ok ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`grid h-7 w-7 place-items-center rounded-md ${ok ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
                        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      </div>
                      <p className="text-xs font-semibold">{it.label}</p>
                    </div>
                    <p className={`mt-2 text-[11px] ${ok ? "text-success" : "text-warning"}`}>{ok ? "Concluído" : "Pendente"}</p>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, v, t, icon: Icon }: { label: string; v: string; t: string; icon: any }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-2 font-display text-3xl font-bold text-${t}`}>{v}</p>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-md bg-${t}-soft text-${t}`}><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}
