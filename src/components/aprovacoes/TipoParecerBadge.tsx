import { Badge } from "@/components/ui/badge";

export type TipoParecer = "bloqueante" | "consultivo" | "ciencia" | string;

const TONE: Record<string, string> = {
  bloqueante: "bg-destructive/15 text-destructive border-destructive/30",
  consultivo: "bg-blue-500/15 text-blue-700 border-blue-300",
  ciencia: "bg-muted text-muted-foreground border-border",
};

const LABEL: Record<string, string> = {
  bloqueante: "Bloqueante",
  consultivo: "Consultivo",
  ciencia: "Ciência",
};

/** Badge unificado de tipo de parecer de aprovação. */
export function TipoParecerBadge({ tipo, className }: { tipo: TipoParecer; className?: string }) {
  const tone = TONE[tipo] ?? TONE.consultivo;
  const label = LABEL[tipo] ?? tipo;
  return (
    <Badge variant="outline" className={`${tone} ${className ?? ""}`}>
      {label}
    </Badge>
  );
}
