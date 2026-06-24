import { Button } from "@/components/ui/button";
import { Check, X, RotateCcw, Trash2 } from "lucide-react";
import type { EtapaPanelProps } from "./types";

export function TriagemComitePanel({ card, papeis, onUpdate, onExcluir }: EtapaPanelProps) {
  if (card.recusado) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Este card foi recusado na Triagem Inicial. Só Controladoria pode reativá-lo ou excluí-lo.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={!papeis.controladoria}
            onClick={() => onUpdate({ etapa: "registro_oficial", recusado: false })}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Voltar para Solicitações
          </Button>
          <Button variant="destructive" className="gap-1.5" disabled={!papeis.controladoria} onClick={onExcluir}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Comitê decide o destino desta solicitação.</p>
      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!papeis.comite} onClick={() => onUpdate({ etapa: "projeto" })}>
          <Check className="h-3.5 w-3.5" /> Aprovar
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!papeis.comite} onClick={() => onUpdate({ recusado: true })}>
          <X className="h-3.5 w-3.5" /> Recusar
        </Button>
        <Button variant="ghost" className="gap-1.5" disabled={!papeis.comite} onClick={() => onUpdate({ etapa: "registro_oficial" })}>
          <RotateCcw className="h-3.5 w-3.5" /> Devolver
        </Button>
      </div>
      {!papeis.comite && <p className="text-[11px] text-muted-foreground">Só o Comitê pode agir nesta etapa.</p>}
    </div>
  );
}
