import { ClipboardCheck, Pencil, Check, RotateCcw } from "lucide-react";
import { EmptyCard } from "./EmptyCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QualificacaoProblema } from "@/hooks/useCopilotoAnalise";

interface Props {
  qualificacao?: QualificacaoProblema;
  loading?: boolean;
  onUsarSugestao?: (texto: string) => void;
  onManter?: () => void;
  onEditarManual?: () => void;
}

const clarezaTone: Record<string, string> = {
  Alta: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  Média: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  Baixa: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400",
};

export function QualificacaoProblemaCard({ qualificacao, loading, onUsarSugestao, onManter, onEditarManual }: Props) {
  const hasData = !loading && !!qualificacao;
  return (
    <EmptyCard
      icon={ClipboardCheck}
      title="Qualificação do Problema"
      badge={loading ? "Analisando…" : hasData ? qualificacao!.clareza : "Pendente"}
      accent="sky"
      emptyText={
        loading
          ? "Avaliando clareza do problema…"
          : "Clique em \"Atualizar análise\" para a IA avaliar clareza, pontos ausentes e sugerir uma redação melhor."
      }
    >
      {hasData ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Clareza:</span>
            <Badge variant="outline" className={clarezaTone[qualificacao!.clareza] ?? ""}>
              {qualificacao!.clareza}
            </Badge>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Problema original</p>
            <p className="text-sm text-foreground/90 italic">
              {qualificacao!.problema_original?.trim() || "(vazio)"}
            </p>
          </div>

          {qualificacao!.problema_sugerido?.trim() && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reformulação sugerida</p>
              <p className="text-sm text-foreground bg-sky-500/5 border border-sky-500/20 rounded-md p-2 leading-snug">
                {qualificacao!.problema_sugerido}
              </p>
            </div>
          )}

          {qualificacao!.pontos_ausentes?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Pontos ausentes</p>
              <div className="flex flex-wrap gap-1">
                {qualificacao!.pontos_ausentes.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] font-normal">{p}</Badge>
                ))}
              </div>
            </div>
          )}

          {qualificacao!.perguntas_recomendadas?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Perguntas recomendadas</p>
              <ul className="space-y-1">
                {qualificacao!.perguntas_recomendadas.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-sky-600 dark:text-sky-400 mt-0.5">?</span>
                    <span className="leading-snug">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onUsarSugestao?.(qualificacao!.problema_sugerido)}
              disabled={!qualificacao!.problema_sugerido?.trim()}
              className="h-8"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Usar sugestão da IA
            </Button>
            <Button size="sm" variant="outline" onClick={onManter} className="h-8">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Manter texto original
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditarManual} className="h-8">
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar manualmente
            </Button>
          </div>
        </div>
      ) : undefined}
    </EmptyCard>
  );
}
