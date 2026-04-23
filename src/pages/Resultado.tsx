import { PageHeader } from "@/components/layout/PageHeader";
import { Trophy, XCircle, AlertTriangle, Ban, ArrowRight } from "lucide-react";
import { licitacoes, formatBRL, formatDate } from "@/data/licitacoes";

export default function Resultado() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultado da Licitação"
        breadcrumb={["Resultado"]}
        subtitle="Classifique resultados e prepare o handoff de licitações vencidas para o módulo de contratos."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <ResultCard label="Vencidas" value="14" icon={Trophy} tone="success" desc="Prontas para handoff" />
        <ResultCard label="Perdidas" value="22" icon={XCircle} tone="destructive" desc="Aprendizados registrados" />
        <ResultCard label="Suspensas" value="3" icon={AlertTriangle} tone="warning" desc="Em monitoramento" />
        <ResultCard label="Canceladas" value="1" icon={Ban} tone="muted" desc="Encerradas pelo órgão" />
      </div>

      {/* Vencida — destaque com handoff */}
      <section className="card-elevated overflow-hidden">
        <div className="border-b border-border bg-success/5 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-success text-success-foreground shadow-md">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-success">Licitação vencida</p>
                <h2 className="font-display text-lg font-bold">PE 044/2025 — Limpeza urbana e coleta seletiva · Salvador</h2>
                <p className="text-sm text-muted-foreground">Empresa NSV · Valor: R$ 28.300.000 · Resultado: 22/04/2025</p>
              </div>
            </div>
            <button className="btn-relief inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-accent px-4 text-sm font-semibold text-accent-foreground">
              Migrar para módulo de Contratos <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <Info label="Documentação" value="Completa" tone="success" />
          <Info label="Aprovações" value="Encerradas" tone="success" />
          <Info label="Ata de pregão" value="Validada" tone="success" />
        </div>
        <div className="border-t border-border bg-info-soft/30 px-5 py-3 text-xs text-info">
          <strong>Continuidade preservada:</strong> ao migrar, o cadastro existente é mantido. Não há recriação de registros — todos os dados, anexos e trilha seguem para o módulo de Contratos.
        </div>
      </section>

      {/* Tabela completa */}
      <section className="card-elevated">
        <header className="border-b border-border px-5 py-3.5">
          <h2 className="font-display text-sm font-bold">Resultados por processo</h2>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Processo</th>
              <th className="px-3 py-3 text-left">Empresa</th>
              <th className="px-3 py-3 text-left">Resultado</th>
              <th className="px-3 py-3 text-right">Valor</th>
              <th className="px-5 py-3 text-right">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {licitacoes.filter((l) => ["vencida", "perdida", "suspensa"].includes(l.status)).map((l) => (
              <tr key={l.id} className="hover:bg-muted/40">
                <td className="px-5 py-3">
                  <p className="font-mono text-[11px] text-muted-foreground">{l.numero}</p>
                  <p className="text-sm font-medium">{l.objeto}</p>
                </td>
                <td className="px-3 py-3"><span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{l.empresa}</span></td>
                <td className="px-3 py-3">
                  {l.status === "vencida" && <span className="chip border border-success/30 bg-success-soft text-success"><Trophy className="h-3 w-3" /> Vencida</span>}
                  {l.status === "perdida" && <span className="chip border border-destructive/30 bg-destructive-soft text-destructive"><XCircle className="h-3 w-3" /> Perdida</span>}
                  {l.status === "suspensa" && <span className="chip border border-warning/30 bg-warning-soft text-warning"><AlertTriangle className="h-3 w-3" /> Suspensa</span>}
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{formatBRL(l.valorEstimado)}</td>
                <td className="px-5 py-3 text-right text-xs text-muted-foreground">{formatDate(l.prazo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ResultCard({ label, value, icon: Icon, tone, desc }: any) {
  return (
    <div className="card-floating p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-lg bg-${tone}-soft text-${tone}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className={`mt-3 font-display text-3xl font-bold text-${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
function Info({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base font-bold text-${tone}`}>{value}</p>
    </div>
  );
}
