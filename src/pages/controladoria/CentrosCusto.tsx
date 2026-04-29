import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { centrosCustoADM, centrosCustoContratuais, proximoCodigoContratual, empresasGrupo } from "@/data/controladoria";
import { Lock, Building2, FileBadge, Plus, PowerOff } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useToast } from "@/hooks/use-toast";

type CCContrat = (typeof centrosCustoContratuais)[number];

export default function CentrosCusto() {
  const { toast } = useToast();
  const [lista, setLista] = useState<CCContrat[]>(centrosCustoContratuais);
  const [draft, setDraft] = useState({
    empresaId: empresasGrupo[0].id,
    nome: "",
    contratoNumero: "",
  });

  const addCC = () => {
    if (!draft.nome.trim() || !draft.contratoNumero.trim()) {
      toast({ title: "Campos obrigatórios", description: "Informe nome e contrato.", variant: "destructive" });
      return;
    }
    const ano = new Date().getFullYear();
    const codigo = proximoCodigoContratual(draft.empresaId, ano);
    const seq = lista.filter((c) => c.empresaId === draft.empresaId && c.ano === ano).length + 1;
    setLista((s) => [
      ...s,
      { codigo, nome: draft.nome, empresaId: draft.empresaId, contratoNumero: draft.contratoNumero, ano, sequencial: seq, status: "ativo" },
    ]);
    setDraft({ empresaId: empresasGrupo[0].id, nome: "", contratoNumero: "" });
    toast({ title: "CC criado", description: codigo });
  };
  const toggle = (codigo: string) =>
    setLista((s) =>
      s.map((c) =>
        c.codigo === codigo ? { ...c, status: c.status === "ativo" ? "encerrado" : "ativo" } : c,
      ),
    );

  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "Centros de Custo"]}
        title="Centros de Custo"
        subtitle="ADM fixos (catálogo congelado) e contratuais com CRUD restrito a Controladoria."
      />

      <section className="mb-8">
        <header className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Administrativos — catálogo travado ({centrosCustoADM.length})
          </h2>
        </header>
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Natureza</th>
              </tr>
            </thead>
            <tbody>
              {centrosCustoADM.map((c) => (
                <tr key={c.codigo} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">{c.codigo}</td>
                  <td className="px-4 py-2">{c.nome}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {c.natureza}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <header className="mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contratuais — gerados ao validar contrato
          </h2>
        </header>
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Empresa</th>
                <th className="px-4 py-2 text-left">Contrato</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {centrosCustoContratuais.map((c) => (
                <tr key={c.codigo} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-accent">{c.codigo}</td>
                  <td className="px-4 py-2">{c.nome}</td>
                  <td className="px-4 py-2">{c.empresaId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.contratoNumero}</td>
                  <td className="px-4 py-2">
                    <span className={c.status === "ativo" ? "chip bg-success-soft text-success" : "chip bg-muted text-muted-foreground"}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-elevated p-5">
        <header className="mb-3 flex items-center gap-2">
          <FileBadge className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Regra de codificação</h2>
        </header>
        <p className="font-mono text-sm text-foreground">
          CC.CONTR.&lt;EMPRESA&gt;.&lt;ANO&gt;.&lt;SEQUENCIAL&gt;
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Próximos códigos disponíveis (simulação para 2026):
        </p>
        <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2 lg:grid-cols-3">
          {empresasGrupo.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-1.5">
              <span className="font-medium text-muted-foreground">{e.sigla}</span>
              <span className="font-mono text-xs text-primary">{proximoCodigoContratual(e.id, 2026)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
