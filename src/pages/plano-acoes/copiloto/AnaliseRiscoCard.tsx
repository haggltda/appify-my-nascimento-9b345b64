import { ShieldAlert } from "lucide-react";
import { EmptyCard } from "./EmptyCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiscoAnalise } from "@/hooks/useCopilotoAnalise";

interface Props {
  riscos?: RiscoAnalise[];
  loading?: boolean;
}

const sevStyle: Record<RiscoAnalise["severidade"], string> = {
  Alta: "bg-rose-500/10 text-rose-700 border-rose-500/40 dark:text-rose-300",
  Média: "bg-amber-500/10 text-amber-700 border-amber-500/40 dark:text-amber-300",
  Baixa: "bg-muted text-muted-foreground border-border",
};

export function AnaliseRiscoCard({ riscos, loading }: Props) {
  const hasData = Array.isArray(riscos) && riscos.length > 0;

  return (
    <EmptyCard
      icon={ShieldAlert}
      title="Análise de Risco"
      badge={hasData ? "Sugerido pela IA" : "Aguardando análise"}
      accent="rose"
      emptyText=""
    >
      {loading && !hasData ? (
        <p className="text-xs text-muted-foreground italic">Avaliando riscos…</p>
      ) : !hasData ? (
        <p className="text-xs text-muted-foreground italic">
          Clique em <span className="font-medium">Atualizar análise</span> para avaliar riscos de Dados, Cronograma, Financeiro, Operacional, Integração, Governança e Compliance/LGPD.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {riscos!.map((r, i) => (
            <li key={`${r.risco}-${i}`} className="rounded-md border bg-background/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-foreground leading-tight">{r.risco}</span>
                <Badge variant="outline" className={cn("shrink-0 text-[10px] uppercase tracking-wide", sevStyle[r.severidade])}>
                  {r.severidade}
                </Badge>
              </div>
              {r.justificativa && (
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{r.justificativa}</p>
              )}
              {r.recomendacao && (
                <p className="text-[11px] mt-1.5 leading-snug">
                  <span className="font-medium text-foreground">Recomendação: </span>
                  <span className="text-muted-foreground">{r.recomendacao}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </EmptyCard>
  );
}
