import { Button } from "@/components/ui/button";
import { ArrowRight, Undo2 } from "lucide-react";
import { CampoComAnexo } from "./CampoComAnexo";
import type { EtapaPanelProps } from "./types";

export function LevantamentoFuncionalPanel({ card, papeis, anexos, onUpdate, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const podeAgir = papeis.controladoria;

  return (
    <div className="space-y-3">
      <CampoComAnexo
        titulo="Levantamento Funcional"
        campo="levantamento_funcional"
        texto={card.levantamento_funcional_texto}
        prazo={card.levantamento_funcional_prazo}
        podeEditar={podeAgir}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ levantamento_funcional_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ levantamento_funcional_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "levantamento_funcional")}
        onDownloadAnexo={onDownloadAnexo}
      />

      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "documentacao_funcional" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Documentação Funcional
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_necessidade" })}>
          <Undo2 className="h-3.5 w-3.5" /> Retornar para Análise de Necessidade
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só a Controladoria age nesta etapa.</p>}
    </div>
  );
}
