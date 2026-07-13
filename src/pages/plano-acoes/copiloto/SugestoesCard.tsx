import { Lightbulb } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

interface Props {
  sugestoes?: string[];
  loading?: boolean;
}

export function SugestoesCard({ sugestoes, loading }: Props) {
  const hasData = !loading && sugestoes && sugestoes.length > 0;
  return (
    <EmptyCard
      icon={Lightbulb}
      title="Sugestões de Contexto"
      badge={loading ? "Analisando…" : hasData ? `${sugestoes!.length}` : "-"}
      accent="amber"
      emptyText={
        loading
          ? "Gerando recomendações…"
          : "Clique em \"Atualizar análise\" para gerar sugestões de áreas envolvidas, dependências, riscos e governança."
      }
    >
      {hasData ? (
        <ul className="space-y-1.5 text-sm text-foreground">
          {sugestoes!.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-1">›</span>
              <span className="leading-snug">{s}</span>
            </li>
          ))}
        </ul>
      ) : !loading && sugestoes && sugestoes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sem sugestões no momento. Adicione mais detalhes ao rascunho.
        </p>
      ) : undefined}
    </EmptyCard>
  );
}
