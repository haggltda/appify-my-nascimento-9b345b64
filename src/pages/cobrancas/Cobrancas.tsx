
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Bell, AlertTriangle, Upload, ListChecks } from "lucide-react";
import ReguaCobrancaTab from "@/pages/financeiro/receber/ReguaCobrancaTab";
import AprovacaoCobrancaTab from "@/pages/financeiro/receber/AprovacaoCobrancaTab";
import ImportarRelatorioServicoCard from "./ImportarRelatorioServicoCard";
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
        <TabsList className="grid grid-cols-4 gap-1 h-auto p-1 max-w-2xl">
          <TabsTrigger value="notas" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Notas em Aberto
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Importar
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
        <TabsContent value="importar" className="mt-6">
          <ImportarRelatorioServicoCard />
        </TabsContent>
        <TabsContent value="regua" className="mt-6">
          <ReguaCobrancaTab />
        </TabsContent>
        <TabsContent value="aprovacao" className="mt-6">
          <AprovacaoCobrancaTab />
        </TabsContent>
      </Tabs>

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function Cobrancas() {
  return (
    <div>
      <PageHeader
        title="Cobranças"
        subtitle="Em construção — em breve as funcionalidades dessa área."
        module="Financeiro"
      />
      <Card className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
        <Bell className="h-10 w-10" />
        <p className="text-sm">Esta tela ainda está em desenvolvimento.</p>
      </Card>

    </div>
  );
}
