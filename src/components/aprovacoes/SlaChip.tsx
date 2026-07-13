import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  /** Horas que a etapa já está parada aguardando decisão. */
  horasParadas?: number | null;
  /** Prazo definido pela etapa (em horas). Null = sem prazo. */
  prazoHoras?: number | null;
  className?: string;
}

/**
 * Chip de SLA da aprovação - verde (no prazo), âmbar (perto de estourar),
 * vermelho (atrasado). Se não houver prazo, mostra apenas as horas paradas.
 */
export function SlaChip({ horasParadas, prazoHoras, className }: Props) {
  const horas = Number(horasParadas ?? 0);
  const prazo = prazoHoras == null ? null : Number(prazoHoras);

  let tone = "bg-muted text-muted-foreground border-border";
  let Icon = Clock;
  let label = `${horas.toFixed(0)}h parada`;

  if (prazo !== null && prazo > 0) {
    const pct = horas / prazo;
    if (pct >= 1) {
      tone = "bg-destructive/15 text-destructive border-destructive/30";
      Icon = AlertTriangle;
      label = `Atrasada ${(horas - prazo).toFixed(0)}h`;
    } else if (pct >= 0.7) {
      tone = "bg-amber-500/15 text-amber-700 border-amber-300";
      Icon = AlertTriangle;
      label = `${horas.toFixed(0)}h / ${prazo}h`;
    } else {
      tone = "bg-emerald-500/15 text-emerald-700 border-emerald-300";
      Icon = CheckCircle2;
      label = `${horas.toFixed(0)}h / ${prazo}h`;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone} ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
