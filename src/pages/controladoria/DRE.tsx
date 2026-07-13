import { PageHeader } from "@/components/layout/PageHeader";
import { linhasDRE, subgrupoAuxiliar04A } from "@/data/controladoria";
import { AlertTriangle, Lock } from "lucide-react";

export default function LinhasDRE() {
  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "DRE Gerencial"]}
        title="Linhas oficiais da DRE"
        subtitle="Catálogo congelado L01-L14. Não promover subgrupos auxiliares a linha oficial sem aprovação humana."
      />

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left w-16">Código</th>
              <th className="px-4 py-2 text-left">Descrição</th>
              <th className="px-4 py-2 text-left w-32">Natureza</th>
              <th className="px-4 py-2 text-left w-24">Oficial</th>
            </tr>
          </thead>
          <tbody>
            {linhasDRE.map((l) => {
              const isSubtotal = l.natureza === "subtotal";
              return (
                <tr
                  key={l.codigo}
                  className={`border-t border-border/60 ${isSubtotal ? "bg-primary-soft/40 font-semibold" : ""}`}
                >
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">{l.codigo}</td>
                  <td className="px-4 py-2">{l.descricao}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {l.natureza}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Lock className="h-3 w-3" />
                      Travada
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-6 card-elevated border-l-4 border-l-warning p-5">
        <header className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold">Subgrupo gerencial auxiliar - {subgrupoAuxiliar04A.codigo}</h2>
          <span className="ml-auto rounded bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
            {subgrupoAuxiliar04A.status}
          </span>
        </header>
        <p className="text-sm text-foreground">{subgrupoAuxiliar04A.descricao}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Vinculado à linha <strong>{subgrupoAuxiliar04A.vinculaLinha}</strong>. {subgrupoAuxiliar04A.observacao}
        </p>
      </section>
    </div>
  );
}
