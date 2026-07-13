import { PageHeader } from "@/components/layout/PageHeader";
import ImportarRelatorioServicoCard from "@/pages/cobrancas/ImportarRelatorioServicoCard";

export default function RelatorioServicos() {
  return (
    <div className="space-y-6">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Relatório de Serviços"]}
        title="Relatório de Serviços"
        subtitle="Registro-mestre de notas fiscais em aberto — em desenvolvimento. Por enquanto, alimentado por importação da planilha oficial do Financeiro; a Cobrança consome esses mesmos dados."
      />

      <ImportarRelatorioServicoCard />
    </div>
  );
}
