import { PageHeader } from "@/components/layout/PageHeader";
import { Calculator, AlertTriangle, ShieldCheck, CheckCircle2, XCircle, RotateCcw, Lock } from "lucide-react";

export default function Controladoria() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisão de Margem e Tributos — Controladoria"
        breadcrumb={["Controladoria"]}
        subtitle="Análise gerencial do orçamento da proposta. Estrutura preparada para o motor financeiro definitivo."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 bg-destructive-soft px-3 text-xs font-semibold text-destructive hover:bg-destructive-soft/70">
              <XCircle className="h-3.5 w-3.5" /> Reprovar
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <RotateCcw className="h-3.5 w-3.5" /> Devolver
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar e seguir
            </button>
          </>
        }
      />

      <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Área restrita à Controladoria.</strong> Decisões aqui registradas alimentam alçadas superiores e ficam permanentemente auditadas.</p>
        </div>
      </div>

      {/* KPIs financeiros (placeholder visual) */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Receita projetada", v: "R$ 18,42M", c: "text-foreground" },
          { l: "Margem bruta", v: "12,8%", c: "text-warning", sub: "Mínimo institucional: 14%" },
          { l: "Tributos efetivos", v: "8,4%", c: "text-foreground" },
          { l: "Resultado líquido", v: "R$ 1,72M", c: "text-success" },
        ].map((s) => (
          <div key={s.l} className="card-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 font-display text-2xl font-bold ${s.c}`}>{s.v}</p>
            {s.sub && <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card-elevated">
          <header className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Calculator className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold">Estrutura do orçamento da proposta</h2>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Componente</th>
                <th className="px-3 py-3 text-right">Valor</th>
                <th className="px-3 py-3 text-right">% s/ Receita</th>
                <th className="px-5 py-3 text-left">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { c: "Custo direto operacional", v: "R$ 11.840.000", p: "64,3%", o: "Mão de obra + insumos" },
                { c: "Custo indireto / BDI", v: "R$ 1.620.000", p: "8,8%", o: "Administração local" },
                { c: "Tributos sobre receita", v: "R$ 1.547.280", p: "8,4%", o: "PIS/COFINS/ISS — slot preparado" },
                { c: "Encargos & garantias", v: "R$ 940.000", p: "5,1%", o: "Apólice 10% + ART" },
                { c: "Reserva de contingência", v: "R$ 750.000", p: "4,1%", o: "Risco operacional" },
                { c: "Margem", v: "R$ 1.722.720", p: "9,3%", o: "Abaixo do alvo institucional" },
              ].map((r) => (
                <tr key={r.c}>
                  <td className="px-5 py-3 font-medium">{r.c}</td>
                  <td className="px-3 py-3 text-right font-mono">{r.v}</td>
                  <td className="px-3 py-3 text-right font-mono">{r.p}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{r.o}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-primary/5">
              <tr>
                <td className="px-5 py-3 font-semibold">Total</td>
                <td className="px-3 py-3 text-right font-mono font-semibold">R$ 18.420.000</td>
                <td className="px-3 py-3 text-right font-mono font-semibold">100%</td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </section>

        <div className="space-y-4">
          <section className="card-elevated p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold"><AlertTriangle className="h-4 w-4 text-warning" /> Impacto econômico</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" /> Margem 1,2 p.p. abaixo do mínimo institucional</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" /> Garantia exigida acima do padrão consome capital de giro</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-info" /> Reajuste anual mitiga inflação operacional</li>
            </ul>
          </section>

          <section className="card-elevated p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Conclusão da controladoria</h3>
            <select className="mt-3 h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              <option>Aprovar com ressalvas</option><option>Aprovar</option><option>Reprovar</option><option>Devolver para revisão</option>
            </select>
            <textarea rows={5} placeholder="Justificativa e observações críticas para alçadas superiores."
              className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
            <p className="mt-2 text-[11px] text-muted-foreground">Decisão registrada com responsável, data e hora na trilha de auditoria.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
