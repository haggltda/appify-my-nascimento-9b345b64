import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Undo2 } from "lucide-react";
import type { EtapaPanelProps, PtvDados } from "./types";
import { PtvDocumento } from "./PtvDocumento";

export { calcPrioridade, calcComplexidade, calcPrazo } from "./PtvDocumento";

export function AnaliseTecnicaPanel({ card, papeis, onUpdate }: EtapaPanelProps) {
  const [ptv, setPtv] = useState<PtvDados>(card.ptv_dados ?? {});
  useEffect(() => { setPtv(card.ptv_dados ?? {}); }, [card.ptv_dados]);

  const podeAgir = papeis.gerenteSistemas;

  function patch(novo: PtvDados) {
    setPtv(novo);
    onUpdate({ ptv_dados: novo });
  }

  return (
    <div className="space-y-4">
      <PtvDocumento dados={ptv} card={card} isReadOnly={!podeAgir} onPatch={patch} />
      <div className="flex gap-2 flex-wrap">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "aprovacao_priorizacao" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Aprovação e Priorização
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "documentacao_funcional" })}>
          <Undo2 className="h-3.5 w-3.5" /> Retornar para Documentação Funcional
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
