import { cn } from "@/lib/utils";
import type { Criticidade, StatusLicitacao } from "@/data/licitacoes";
import { statusLabel } from "@/data/licitacoes";

const statusStyle: Record<StatusLicitacao, string> = {
  oportunidade: "bg-info-soft text-info border-info/20",
  em_analise: "bg-primary-soft text-primary border-primary/20",
  parecer_tecnico: "bg-secondary text-secondary-foreground border-border",
  parecer_gerencial: "bg-secondary text-secondary-foreground border-border",
  controladoria: "bg-warning-soft text-warning border-warning/30",
  aprovacao_diretoria: "bg-warning-soft text-warning border-warning/30",
  aprovacao_presidencia: "bg-accent-soft text-accent border-accent/30",
  pregao: "bg-info-soft text-info border-info/30 animate-pulse-soft",
  vencida: "bg-success-soft text-success border-success/30",
  perdida: "bg-destructive-soft text-destructive border-destructive/30",
  suspensa: "bg-muted text-muted-foreground border-border",
};

export function StatusChip({ status, className }: { status: StatusLicitacao; className?: string }) {
  return (
    <span className={cn("chip border", statusStyle[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {statusLabel[status]}
    </span>
  );
}

const critStyle: Record<Criticidade, string> = {
  baixa: "bg-success-soft text-success border-success/30",
  media: "bg-info-soft text-info border-info/30",
  alta: "bg-warning-soft text-warning border-warning/30",
  critica: "bg-destructive-soft text-destructive border-destructive/30",
};

const critLabel: Record<Criticidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export function CriticidadeChip({ value, className }: { value: Criticidade; className?: string }) {
  return (
    <span className={cn("chip border font-semibold", critStyle[value], className)}>{critLabel[value]}</span>
  );
}
