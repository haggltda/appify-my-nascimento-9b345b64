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
