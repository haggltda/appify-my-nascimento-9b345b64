import { Brain } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

export function ContextoCard() {
  return (
    <EmptyCard
      icon={Brain}
      title="IA Contexto"
      badge="Aguardando"
      accent="primary"
      emptyText="Aguardando contexto… Envie uma mensagem ou áudio para a IA interpretar tema, problema, área e impacto esperado."
    />
  );
}
