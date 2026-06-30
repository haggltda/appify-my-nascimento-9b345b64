import { Button } from "@/components/ui/button";
import { ArrowRight, Undo2 } from "lucide-react";
import { CampoComAnexo } from "./CampoComAnexo";
import type { EtapaPanelProps } from "./types";

export function DocumentacaoFuncionalPanel({ card, papeis, anexos, onUpdate, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const podeAgir = papeis.controladoria;

  return (
    <div className="space-y-3">
      <CampoComAnexo
        titulo="Documentação Funcional"
        campo="documentacao_tecnica"
        texto={card.documentacao_tecnica_texto}
        prazo={card.documentacao_tecnica_prazo}
        podeEditar={podeAgir}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ documentacao_tecnica_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ documentacao_tecnica_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "documentacao_tecnica")}
        onDownloadAnexo={onDownloadAnexo}
      />

      <div className="flex gap-2">
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
