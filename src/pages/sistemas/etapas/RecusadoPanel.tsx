import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2 } from "lucide-react";

export function RecusadoPanel({
  podeReativar, onReativar, onExcluir,
}: {
  podeReativar: boolean;
  onReativar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Este card foi recusado/encerrado. Só Controladoria pode reativá-lo ou excluí-lo.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="gap-1.5" disabled={!podeReativar} onClick={onReativar}>
          <RotateCcw className="h-3.5 w-3.5" /> Voltar para Solicitações
        </Button>
        <Button variant="destructive" className="gap-1.5" disabled={!podeReativar} onClick={onExcluir}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      </div>
    </div>
  );
}
