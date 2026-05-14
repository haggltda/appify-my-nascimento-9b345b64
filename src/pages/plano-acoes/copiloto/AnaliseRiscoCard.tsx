import { ShieldAlert } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

export function AnaliseRiscoCard() {
  return (
    <EmptyCard
      icon={ShieldAlert}
      title="Análise de Risco"
      badge="Aguardando"
      accent="rose"
      emptyText="A IA avaliará riscos de Dados, Cronograma, Financeiro, Operacional, Integração, Governança e Compliance/LGPD."
    />
  );
}
