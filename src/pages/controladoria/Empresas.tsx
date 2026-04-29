import { PageHeader } from "@/components/layout/PageHeader";
import { empresasGrupo } from "@/data/controladoria";
import { ShieldAlert, CheckCircle2, Pencil } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useToast } from "@/hooks/use-toast";

export default function Empresas() {
  const { toast } = useToast();
  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "Empresas"]}
        title="Empresas do Grupo Nascimento"
        subtitle="Catálogo congelado das pessoas jurídicas do grupo. Read-only — base para empresa_id em todo o ERP."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {empresasGrupo.map((e) => (
          <div key={e.id} className="card-elevated p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                {e.sigla}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{e.razao}</p>
                <p className="font-mono text-xs text-muted-foreground">{e.cnpj}</p>
              </div>
              {e.validacaoDocumentalObrigatoria ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
                  <ShieldAlert className="h-3 w-3" />
                  Validar
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Cadastro OK
                </span>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Regime</dt>
                <dd className="mt-0.5 font-medium text-foreground">{e.regime}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Papel</dt>
                <dd className="mt-0.5 font-medium text-foreground">{e.papel}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">ID interno (empresa_id)</dt>
                <dd className="mt-0.5 font-mono text-foreground">{e.id}</dd>
              </div>
              {e.observacao && (
                <div className="col-span-2 rounded-md bg-muted/60 p-2 text-muted-foreground">
                  {e.observacao}
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
