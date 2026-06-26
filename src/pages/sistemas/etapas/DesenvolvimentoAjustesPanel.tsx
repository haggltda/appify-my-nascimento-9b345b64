import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { STATUS_DESENVOLVIMENTO_LABEL, type EtapaPanelProps } from "./types";

export function DesenvolvimentoAjustesPanel({ card, papeis, onUpdate }: EtapaPanelProps) {
  const podeEditar = papeis.desenvolvedores || papeis.gerenteSistemas;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Desenvolvedores e Gerente de Sistemas atualizam progresso e prazo, estilo Trello.</p>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progresso</label>
        <Progress value={card.progresso_pct} className="h-2.5" />
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={card.progresso_pct}
            disabled={!podeEditar}
            onBlur={(e) => {
              const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
              if (v !== card.progresso_pct) onUpdate({ progresso_pct: v });
            }}
            className="w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Prazo</label>
        <Input
          type="date"
          defaultValue={card.data_fim ?? ""}
          disabled={!podeEditar}
          onBlur={(e) => { if (e.target.value !== (card.data_fim ?? "")) onUpdate({ data_fim: e.target.value || null }); }}
          className="w-40 text-xs"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status de Desenvolvimento</label>
        <Select
          value={card.status_desenvolvimento ?? undefined}
          onValueChange={(v) => onUpdate({ status_desenvolvimento: v })}
          disabled={!podeEditar}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Selecionar status…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_DESENVOLVIMENTO_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="gap-1.5" disabled={!podeEditar} onClick={() => onUpdate({ etapa: "homologacao_tecnica" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Homologação Técnica
      </Button>
      {!podeEditar && <p className="text-[11px] text-muted-foreground">Só Desenvolvedores ou Gerente de Sistemas agem nesta etapa.</p>}
    </div>
  );
}
