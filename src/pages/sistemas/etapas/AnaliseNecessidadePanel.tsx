import { Button } from "@/components/ui/button";
import { ArrowRight, Ban, FileDown } from "lucide-react";
import { CampoComAnexo } from "./CampoComAnexo";
import type { EtapaPanelProps } from "./types";
import { RecusadoPanel } from "./RecusadoPanel";
import { exportarPdfEtapa } from "./documentoPdf";

export function AnaliseNecessidadePanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onAnexar, onDownloadAnexo, onExcluir }: EtapaPanelProps) {
  const podeAgir = papeis.comite;

  if (card.recusado) {
    return (
      <RecusadoPanel
        podeReativar={papeis.controladoria}
        onReativar={() => onUpdate({ etapa: "solicitacao_demanda", recusado: false })}
        onExcluir={onExcluir}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfEtapa("analise_necessidade", card, anexos, comentarios, usuarios)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <CampoComAnexo
        titulo="Análise da Necessidade"
        campo="analise_necessidade"
        texto={card.analise_necessidade_texto}
        prazo={card.analise_necessidade_prazo}
        podeEditar={podeAgir}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ analise_necessidade_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ analise_necessidade_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "analise_necessidade")}
        onDownloadAnexo={onDownloadAnexo}
      />

      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "levantamento_funcional" })}>
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Levantamento Funcional
        </Button>
        <Button variant="destructive" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ recusado: true })}>
          <Ban className="h-3.5 w-3.5" /> Reprovar Demanda
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só o Comitê age nesta etapa.</p>}
    </div>
  );
}
