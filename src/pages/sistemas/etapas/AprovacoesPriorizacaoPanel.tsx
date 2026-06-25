import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import type { EtapaPanelProps } from "./types";

export function AprovacoesPriorizacaoPanel({ card, papeis, totalNaColuna, prioridadesUsadas, onUpdate }: EtapaPanelProps) {
  const opcoes = Array.from({ length: totalNaColuna }, (_, i) => i + 1).filter(
    (n) => n === card.prioridade || !prioridadesUsadas.includes(n),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Comitê define a prioridade desta solicitação em relação às outras {totalNaColuna} nesta coluna.
      </p>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Prioridade</label>
        <Select
          value={card.prioridade != null ? String(card.prioridade) : undefined}
          onValueChange={(v) => onUpdate({ prioridade: Number(v) })}
          disabled={!papeis.comite}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Selecionar prioridade…" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((n) => (
              <SelectItem key={n} value={String(n)}>Prioridade {n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="gap-1.5"
        disabled={!papeis.comite || card.prioridade !== 1}
        onClick={() => onUpdate({ etapa: "definicao_responsavel" })}
      >
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Definição de Responsável
      </Button>
      {!papeis.comite && <p className="text-[11px] text-muted-foreground">Só o Comitê age nesta etapa.</p>}
      {papeis.comite && card.prioridade !== 1 && (
        <p className="text-[11px] text-muted-foreground">
          Só é possível avançar o card que estiver com prioridade 1. Avance-o primeiro.
        </p>
      )}
    </div>
  );
}
