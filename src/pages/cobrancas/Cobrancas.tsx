import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Bell, AlertTriangle, ListChecks } from "lucide-react";
import ReguaCobrancaTab from "@/pages/financeiro/receber/ReguaCobrancaTab";
import AprovacaoCobrancaTab from "@/pages/financeiro/receber/AprovacaoCobrancaTab";
import NotasAbertoTab from "./NotasAbertoTab";

export default function Cobrancas() {
  const [tab, setTab] = useState("notas");

  return (
    <div className="space-y-6">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Cobranças"]}
        title="Cobranças"
        subtitle="Notas em aberto, régua de inadimplência e escalonamento jurídico."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3 gap-1 h-auto p-1 max-w-lg">
          <TabsTrigger value="notas" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Notas em Aberto
          </TabsTrigger>
          <TabsTrigger value="regua" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Régua
          </TabsTrigger>
          <TabsTrigger value="aprovacao" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Aprovação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="mt-6">
          <NotasAbertoTab />
        </TabsContent>
        <TabsContent value="regua" className="mt-6">
          <ReguaCobrancaTab />
        </TabsContent>
        <TabsContent value="aprovacao" className="mt-6">
          <AprovacaoCobrancaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
