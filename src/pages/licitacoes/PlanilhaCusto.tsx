import { PageHeader } from "@/components/layout/PageHeader";
import { Construction } from "lucide-react";

export default function PlanilhaCusto() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planilha de Custo"
        breadcrumb={["Licitações", "Planilha de Custo"]}
        subtitle="Elaboração e gestão de planilhas de custo para licitações."
      />

      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-8 py-24 text-center">
        <Construction className="h-12 w-12 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Em desenvolvimento</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Este módulo está sendo construído e estará disponível em breve.
            Acompanhe as atualizações do sistema.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
          Em breve
        </span>
      </div>
    </div>
  );
}
