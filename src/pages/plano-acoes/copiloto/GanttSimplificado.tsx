import { CalendarRange } from "lucide-react";
import { EmptyCard } from "./EmptyCard";
import type { GanttEtapa } from "@/hooks/useCopilotoAnalise";

interface Props {
  etapas?: GanttEtapa[];
  loading?: boolean;
}

const fmtDia = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

export function GanttSimplificado({ etapas, loading }: Props) {
  const hasData = Array.isArray(etapas) && etapas.length > 0;

  // calcula janela total
  let minMs = Infinity;
  let maxMs = -Infinity;
  if (hasData) {
    for (const e of etapas!) {
      const i = new Date(e.inicio).getTime();
      const f = new Date(e.fim).getTime();
      if (!isNaN(i)) minMs = Math.min(minMs, i);
      if (!isNaN(f)) maxMs = Math.max(maxMs, f);
    }
  }
  const totalMs = Math.max(maxMs - minMs, 1);

  return (
    <EmptyCard
      icon={CalendarRange}
      title="Cronograma / Gantt Simplificado"
      badge={hasData ? "Sugerido pela IA" : "Aguardando análise"}
      accent="emerald"
      emptyText=""
    >
      {loading && !hasData ? (
        <p className="text-xs text-muted-foreground italic">Gerando cronograma sugerido…</p>
      ) : !hasData ? (
        <p className="text-xs text-muted-foreground italic">
          Clique em <span className="font-medium">Atualizar análise</span> para gerar um cronograma sugerido. As datas não preenchem o rascunho automaticamente.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{fmtDia(new Date(minMs).toISOString())}</span>
            <span>{fmtDia(new Date(maxMs).toISOString())}</span>
          </div>
          <div className="space-y-1.5">
            {etapas!.map((e, idx) => {
              const i = new Date(e.inicio).getTime();
              const f = new Date(e.fim).getTime();
              const left = isFinite(i) ? ((i - minMs) / totalMs) * 100 : 0;
              const width = isFinite(i) && isFinite(f) ? Math.max(((f - i) / totalMs) * 100, 2) : 100;
              return (
                <div key={`${e.etapa}-${idx}`} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 text-[11px] text-muted-foreground truncate" title={e.etapa}>
                    {e.etapa}
                  </div>
                  <div className="flex-1 h-3 rounded-sm bg-muted/40 overflow-hidden relative">
                    <div
                      className="absolute h-full bg-gradient-to-r from-emerald-500/60 to-emerald-500/30 border border-emerald-500/40 rounded-sm"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${fmtDia(e.inicio)} → ${fmtDia(e.fim)}`}
                    />
                  </div>
                  <div className="w-28 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                    {fmtDia(e.inicio)} → {fmtDia(e.fim)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground italic pt-1">
            Cronograma sugerido. Não preenche datas no rascunho automaticamente.
          </p>
        </div>
      )}
    </EmptyCard>
  );
}
