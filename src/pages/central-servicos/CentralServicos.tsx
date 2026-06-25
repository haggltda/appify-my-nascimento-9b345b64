import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Headset } from "lucide-react";

export default function CentralServicos() {
  return (
    <div>
      <PageHeader
        title="Central de Serviços"
        subtitle="Em construção — em breve as funcionalidades dessa área."
        module="Central de Serviços"
      />
      <Card className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
        <Headset className="h-10 w-10" />
        <p className="text-sm">Esta tela ainda está em desenvolvimento.</p>
      </Card>
    </div>
  );
}
