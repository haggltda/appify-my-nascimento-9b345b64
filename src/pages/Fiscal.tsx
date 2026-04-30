import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NotasFiscais from "./fiscal/NotasFiscais";
import ApuracaoImpostos from "./fiscal/ApuracaoImpostos";
import ConfigFiscal from "./fiscal/ConfigFiscal";

export default function Fiscal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fiscal & Tributário</h1>
        <p className="text-muted-foreground">Emissão de NFS-e/NF-e, apuração de impostos e configuração tributária.</p>
      </div>
      <Tabs defaultValue="notas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notas">Notas Fiscais</TabsTrigger>
          <TabsTrigger value="apuracao">Apuração de Impostos</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="notas"><NotasFiscais /></TabsContent>
        <TabsContent value="apuracao"><ApuracaoImpostos /></TabsContent>
        <TabsContent value="config"><ConfigFiscal /></TabsContent>
      </Tabs>
    </div>
  );
}
