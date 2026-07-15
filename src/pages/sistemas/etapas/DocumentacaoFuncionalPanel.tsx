import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Undo2 } from "lucide-react";
import type { EtapaPanelProps, DfdDados } from "./types";
import { DfdDocumento } from "./DfdDocumento";

export function DocumentacaoFuncionalPanel({ card, papeis, onUpdate }: EtapaPanelProps) {
  const [dfd, setDfd] = useState<DfdDados>(card.dfd_dados ?? {});
  useEffect(() => { setDfd(card.dfd_dados ?? {}); }, [card.dfd_dados]);

  const podeAgir = papeis.controladoria;

  function patch(novo: DfdDados) {
    setDfd(novo);
    onUpdate({ dfd_dados: novo });
  }

  return (
    <div className="space-y-4">
      <DfdDocumento dados={dfd} card={card} isReadOnly={!podeAgir} onPatch={patch} />
      <div className="flex gap-2 flex-wrap">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_tecnica" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Análise Técnica
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_necessidade" })}>
          <Undo2 className="h-3.5 w-3.5" /> Retornar para Análise de Necessidade
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só a Controladoria age nesta etapa.</p>}
    </div>
  );
}
