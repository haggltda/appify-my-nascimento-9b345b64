import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, RotateCcw, FileDown } from "lucide-react";
import { CRITERIO_TRIAGEM_LABEL, type EtapaPanelProps } from "./types";
import { RecusadoPanel } from "./RecusadoPanel";
import { exportarPdfEtapa } from "./documentoPdf";

export function TriagemInicialPanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onExcluir }: EtapaPanelProps) {
  if (card.recusado) {
    return (
      <RecusadoPanel
        podeReativar={papeis.controladoria}
        onReativar={() => onUpdate({ etapa: "solicitacao_demanda", recusado: false })}
        onExcluir={onExcluir}
      />
    );
  }

  const podeAprovar = papeis.comite && card.criterio_triagem === "necessidade_desenvolvimento";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfEtapa("triagem_inicial", card, anexos, comentarios, usuarios)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Critério</label>
        <Select
          value={card.criterio_triagem ?? undefined}
          onValueChange={(v) => onUpdate({ criterio_triagem: v })}
          disabled={!papeis.comite}
        >
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecionar critério…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CRITERIO_TRIAGEM_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button className="gap-1.5" disabled={!podeAprovar} onClick={() => onUpdate({ etapa: "analise_necessidade" })}>
          <Check className="h-3.5 w-3.5" /> Aprovar
        </Button>
        <Button variant="outline" className="gap-1.5" disabled={!papeis.comite} onClick={() => onUpdate({ recusado: true })}>
          <X className="h-3.5 w-3.5" /> Recusar
        </Button>
        <Button variant="ghost" className="gap-1.5" disabled={!papeis.comite} onClick={() => onUpdate({ etapa: "solicitacao_demanda" })}>
          <RotateCcw className="h-3.5 w-3.5" /> Devolver
        </Button>
      </div>
      {!papeis.comite && <p className="text-[11px] text-muted-foreground">Só o Comitê pode agir nesta etapa.</p>}
      {papeis.comite && card.criterio_triagem && card.criterio_triagem !== "necessidade_desenvolvimento" && (
        <p className="text-[11px] text-muted-foreground">Só é possível aprovar se o critério for "Necessidade de Desenvolvimento". Recusar ou Devolver continuam disponíveis.</p>
      )}
    </div>
  );
}
