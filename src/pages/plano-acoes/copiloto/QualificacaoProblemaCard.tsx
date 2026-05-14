import { ClipboardCheck } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

export function QualificacaoProblemaCard() {
  return (
    <EmptyCard
      icon={ClipboardCheck}
      title="Qualificação do Problema"
      badge="Pendente"
      accent="sky"
      emptyText="Problema ainda não qualificado. A IA avaliará clareza, pontos ausentes e poderá sugerir uma redação melhor."
    />
  );
}
