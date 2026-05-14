import { CalendarRange } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

const ETAPAS_PREVIEW = [
  "Diagnóstico", "Validação", "Planejamento", "Execução",
  "Testes", "Treinamento", "Implantação", "Acompanhamento",
];

export function GanttSimplificado() {
  return (
    <EmptyCard
      icon={CalendarRange}
      title="Cronograma / Gantt Simplificado"
      badge="Placeholder"
      accent="emerald"
      emptyText=""
    >
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground italic mb-3">
          Exemplo visual preliminar. O cronograma real será gerado após a análise da ação. As datas sugeridas não preenchem o rascunho automaticamente.
        </p>
        <div className="space-y-1.5">
          {ETAPAS_PREVIEW.map((etapa, i) => (
            <div key={etapa} className="flex items-center gap-2">
              <div className="w-28 shrink-0 text-[11px] text-muted-foreground truncate">{etapa}</div>
              <div className="flex-1 h-3 rounded-sm bg-muted/40 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500/30 to-emerald-500/10 border border-dashed border-emerald-500/30"
                  style={{
                    marginLeft: `${i * 8}%`,
                    width: `${18 + (i % 3) * 6}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </EmptyCard>
  );
}
