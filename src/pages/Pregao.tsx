import { PageHeader } from "@/components/layout/PageHeader";
import { Gavel, Radio, Clock, TrendingDown, TrendingUp } from "lucide-react";

const lances = [
  { h: "10:42:18", emp: "NEN - Nascimento", v: 11_350_000, t: "down", obs: "Lance inicial" },
  { h: "10:43:05", emp: "Concorrente A", v: 11_180_000, t: "down", obs: "" },
  { h: "10:43:47", emp: "NEN - Nascimento", v: 11_050_000, t: "down", obs: "" },
  { h: "10:44:32", emp: "Concorrente B", v: 10_980_000, t: "down", obs: "" },
  { h: "10:45:12", emp: "Concorrente A", v: 10_900_000, t: "down", obs: "" },
  { h: "10:46:01", emp: "NEN - Nascimento", v: 10_840_000, t: "down", obs: "Estratégia de bloqueio" },
  { h: "10:46:55", emp: "Concorrente B", v: 10_780_000, t: "down", obs: "" },
  { h: "10:47:30", emp: "NEN - Nascimento", v: 10_720_000, t: "down", obs: "Limite de margem próximo" },
];

export default function Pregao() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pregão & Histórico de Lances"
        breadcrumb={["Pregão & Lances"]}
        subtitle="Sessão pública em tempo real ou consulta pós-evento. Timeline detalhada por lance."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Lances totais", v: "47" },
          { l: "Nossa posição", v: "1º", t: "success" },
          { l: "Melhor preço", v: "R$ 10,72M", t: "success" },
          { l: "Margem restante", v: "3,4%", t: "warning" },
        ].map((s) => (
          <div key={s.l} className="card-elevated p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 font-display text-3xl font-bold ${s.t ? `text-${s.t}` : ""}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="card-elevated">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-bold">Timeline da disputa</h2>
            </div>
            <span className="chip border border-info/30 bg-info-soft text-info animate-pulse-soft">
              <Radio className="h-3 w-3" /> Sessão ao vivo
            </span>
          </header>
          <ul className="max-h-[480px] overflow-y-auto scroll-elegant divide-y divide-border">
            {lances.slice().reverse().map((l, i) => {
              const isUs = l.emp.includes("NEN");
              return (
                <li key={i} className={`flex items-start gap-3 px-5 py-3 ${isUs ? "bg-primary-soft/40" : ""}`}>
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isUs ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {l.t === "down" ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{l.emp}</p>
                      <p className="font-mono text-sm font-bold">R$ {l.v.toLocaleString("pt-BR")}</p>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {l.h}
                      {l.obs && <span className="italic">- {l.obs}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-4">
          <div className="card-elevated p-5">
            <h3 className="font-display text-sm font-bold">Sessão</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Processo" v="RDC 012/2025" />
              <Row k="Órgão" v="CEDAE" />
              <Row k="Início" v="29/04 10:30" />
              <Row k="Status" v={<span className="chip border border-info/30 bg-info-soft text-info">Em disputa</span>} />
              <Row k="Pregoeiro" v="João Almeida" />
              <Row k="Modalidade" v="RDC eletrônico" />
            </dl>
          </div>
          <div className="card-elevated p-5">
            <h3 className="font-display text-sm font-bold">Eventos da disputa</h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="rounded-md bg-info-soft px-3 py-2 text-info">10:30 - Sessão aberta</li>
              <li className="rounded-md bg-muted px-3 py-2">10:35 - Habilitação verificada</li>
              <li className="rounded-md bg-muted px-3 py-2">10:42 - Início dos lances</li>
              <li className="rounded-md bg-warning-soft px-3 py-2 text-warning">10:50 - Suspensão técnica de 5 min</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
