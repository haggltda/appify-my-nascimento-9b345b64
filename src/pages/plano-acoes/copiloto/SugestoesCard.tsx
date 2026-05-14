import { Lightbulb } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

export function SugestoesCard() {
  return (
    <EmptyCard
      icon={Lightbulb}
      title="Sugestões de Contexto"
      badge="—"
      accent="amber"
      emptyText="Envie uma mensagem para gerar sugestões de áreas envolvidas, dependências, riscos operacionais e pontos de governança."
    />
  );
}
