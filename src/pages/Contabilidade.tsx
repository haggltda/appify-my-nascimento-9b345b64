import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, ScrollText, Calculator, FileBarChart, LineChart, Landmark, HeartPulse } from "lucide-react";
import RegrasContabilizacao from "./contabil/RegrasContabilizacao";
import SaudeRegras from "./contabil/SaudeRegras";
import Balancete from "./contabil/Balancete";
import DRERealizado from "./contabil/DRE";
import BalancoPatrimonial from "./contabil/Balanco";

export default function Contabilidade() {
  const [tab, setTab] = useState("regras");
  return (
    <div>
      <PageHeader
        module="Contábil"
        breadcrumb={["Contabilidade Avançada"]}
        title="Contabilidade Avançada"
        subtitle="Regras de contabilização automática, balancete, DRE realizada e balanço patrimonial — integrados com NFs e títulos."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="regras" className="gap-2"><ScrollText className="h-3.5 w-3.5" />Regras</TabsTrigger>
          <TabsTrigger value="saude" className="gap-2"><HeartPulse className="h-3.5 w-3.5" />Saúde das Regras</TabsTrigger>
          <TabsTrigger value="balancete" className="gap-2"><Calculator className="h-3.5 w-3.5" />Balancete</TabsTrigger>
          <TabsTrigger value="dre" className="gap-2"><LineChart className="h-3.5 w-3.5" />DRE Realizada</TabsTrigger>
          <TabsTrigger value="balanco" className="gap-2"><Landmark className="h-3.5 w-3.5" />Balanço</TabsTrigger>
        </TabsList>
        <TabsContent value="regras" className="mt-4"><RegrasContabilizacao /></TabsContent>
        <TabsContent value="saude" className="mt-4"><SaudeRegras /></TabsContent>
        <TabsContent value="balancete" className="mt-4"><Balancete /></TabsContent>
        <TabsContent value="dre" className="mt-4"><DRERealizado /></TabsContent>
        <TabsContent value="balanco" className="mt-4"><BalancoPatrimonial /></TabsContent>
      </Tabs>
    </div>
  );
}
