import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, Upload } from "lucide-react";
import ImportarRelatorioServicoCard from "@/pages/cobrancas/ImportarRelatorioServicoCard";
import RegistroNotasTab from "./relatorio-servicos/RegistroNotasTab";

export default function RelatorioServicos() {
  const [tab, setTab] = useState("registro");

  return (
    <div className="space-y-6">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Relatório de Serviços"]}
        title="Relatório de Serviços"
        subtitle="Registro-mestre de notas fiscais em aberto — em desenvolvimento. Por enquanto, alimentado por importação da planilha oficial do Financeiro; a Cobrança consome esses mesmos dados."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 gap-1 h-auto p-1 max-w-md">
          <TabsTrigger value="registro" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Registro de Notas
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Importar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro" className="mt-6">
          <RegistroNotasTab />
        </TabsContent>
        <TabsContent value="importar" className="mt-6">
          <ImportarRelatorioServicoCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
