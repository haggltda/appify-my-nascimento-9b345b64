import { Button } from "@/components/ui/button";
import { ArrowRight, FileDown, Undo2 } from "lucide-react";
import { CampoComAnexo } from "./CampoComAnexo";
import { exportarPdfCaptura } from "./exportarPdfCaptura";
import type { EtapaPanelProps } from "./types";

export function AnaliseTecnicaPanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const podeAgir = papeis.gerenteSistemas;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfCaptura("pdf-capture-target", `analise-tecnica-${card.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <CampoComAnexo
        titulo="Análise Técnica"
        campo="analise_tecnica"
        texto={card.analise_tecnica_texto}
        prazo={card.analise_tecnica_prazo}
        podeEditar={podeAgir}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ analise_tecnica_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ analise_tecnica_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "analise_tecnica")}
        onDownloadAnexo={onDownloadAnexo}
      />

      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "aprovacao_priorizacao" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Aprovação e Priorização
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "analise_necessidade" })}>
          <Undo2 className="h-3.5 w-3.5" /> Retornar para Análise de Necessidade
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
