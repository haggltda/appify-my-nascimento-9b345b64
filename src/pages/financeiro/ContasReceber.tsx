import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { FileText, Receipt, QrCode, Bell, Send } from "lucide-react";
import TitulosReceberTab from "./receber/TitulosReceberTab";
import FaturamentoContratoTab from "./receber/FaturamentoContratoTab";
import CobrancaTab from "./receber/CobrancaTab";
import ReguaCobrancaTab from "./receber/ReguaCobrancaTab";
import RemessaConciliacaoTab from "./receber/RemessaConciliacaoTab";

export default function ContasReceber() {
  const [tab, setTab] = useState("titulos");

  return (
    <div className="space-y-6">
      <PageHeader
        module="Financeiro"
        breadcrumb={["Contas a Receber"]}
        title="Contas a Receber"
        subtitle="Faturamento de contratos, títulos, cobrança (boleto + PIX) e régua de inadimplência."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 gap-1 h-auto p-1">
          <TabsTrigger value="titulos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Títulos</span>
          </TabsTrigger>
          <TabsTrigger value="faturamento" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> <span className="hidden sm:inline">Faturamento</span>
          </TabsTrigger>
          <TabsTrigger value="cobranca" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" /> <span className="hidden sm:inline">Cobrança</span>
          </TabsTrigger>
          <TabsTrigger value="remessa" className="flex items-center gap-2">
            <Send className="h-4 w-4" /> <span className="hidden sm:inline">Remessa/Concil.</span>
          </TabsTrigger>
          <TabsTrigger value="regua" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> <span className="hidden sm:inline">Régua</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="titulos" className="mt-6">
          <TitulosReceberTab />
        </TabsContent>
        <TabsContent value="faturamento" className="mt-6">
          <FaturamentoContratoTab onFaturado={() => setTab("titulos")} />
        </TabsContent>
        <TabsContent value="cobranca" className="mt-6">
          <CobrancaTab />
        </TabsContent>
        <TabsContent value="remessa" className="mt-6">
          <RemessaConciliacaoTab />
        </TabsContent>
        <TabsContent value="regua" className="mt-6">
          <ReguaCobrancaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
