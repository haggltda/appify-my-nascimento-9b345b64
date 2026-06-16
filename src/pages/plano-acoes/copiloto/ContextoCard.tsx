import { Brain } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

interface Props {
  contexto?: string[];
  loading?: boolean;
}

export function ContextoCard({ contexto, loading }: Props) {
  const hasData = !loading && contexto && contexto.length > 0;
  return (
    <EmptyCard
      icon={Brain}
      title="IA Contexto"
      badge={loading ? "Analisando…" : hasData ? "Atualizado" : "Aguardando"}
      accent="primary"
      emptyText={
        loading
          ? "Gerando análise de contexto…"
          : "Aguardando contexto. Clique em \"Atualizar análise\" para a IA interpretar tema, problema, área e impacto."
      }
    >
      {hasData ? (
        <ul className="space-y-1.5 text-sm text-foreground">
          {contexto!.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary mt-1">•</span>
              <span className="leading-snug">{c}</span>
            </li>
          ))}
        </ul>
      ) : !loading && contexto && contexto.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Informações insuficientes para gerar contexto. Preencha título, ação ou problema.
        </p>
      ) : undefined}
    </EmptyCard>
  );
}
