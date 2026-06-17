import { PageHeader } from "@/components/layout/PageHeader";
import { classificadores, driversOBZ, contasContabeis, labelGrupoGerencial } from "@/data/controladoria";

export default function Classificadores() {
  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "Classificadores"]}
        title="Classificadores gerenciais & Drivers OBZ"
        subtitle="Mapeamento por prefixo de conta, drivers permitidos no planejador e amostra do catálogo de contas."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Classificadores por prefixo
        </h2>
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Prefixo</th>
                <th className="px-3 py-2 text-left">Grupo gerencial</th>
                <th className="px-3 py-2 text-left">Natureza</th>
                <th className="px-3 py-2 text-left">D/I</th>
                <th className="px-3 py-2 text-left">Fixo/Variável</th>
                <th className="px-3 py-2 text-left">Folha/Operação</th>
                <th className="px-3 py-2 text-left">DRE</th>
              </tr>
            </thead>
            <tbody>
              {classificadores.map((c) => (
                <tr key={c.prefixo} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{c.prefixo}</td>
                  <td className="px-3 py-2">{labelGrupoGerencial[c.grupoGerencial]}</td>
                  <td className="px-3 py-2 capitalize">{c.natureza}</td>
                  <td className="px-3 py-2 capitalize">{c.diretoIndireto}</td>
                  <td className="px-3 py-2 text-xs">{c.fixoVariavel.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 capitalize">{c.subgrupoFolhaOperacao}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{c.linhaDRE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Drivers OBZ permitidos
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {driversOBZ.map((d) => (
            <div key={d.id} className="card-elevated p-4">
              <p className="text-sm font-semibold text-foreground">{d.label}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{d.id}</p>
              <p className="mt-2 text-xs text-muted-foreground">{d.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Catálogo de contas (amostra)
        </h2>
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Reduzida</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Natureza</th>
              </tr>
            </thead>
            <tbody>
              {contasContabeis.map((c) => (
                <tr key={c.reduzida} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{c.reduzida}</td>
                  <td className="px-3 py-2">{c.descricao}</td>
                  <td className="px-3 py-2 capitalize">{c.tipo}</td>
                  <td className="px-3 py-2 capitalize">{c.natureza}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
