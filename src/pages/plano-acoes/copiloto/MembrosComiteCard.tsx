import { Users } from "lucide-react";
import { EmptyCard } from "./EmptyCard";

interface Props {
  comiteSelecionado?: string;
}

export function MembrosComiteCard({ comiteSelecionado }: Props) {
  const empty = !comiteSelecionado
    ? "Selecione um comitê para visualizar os membros sugeridos."
    : "Os membros sugeridos serão exibidos após a análise (líder do comitê + gestores das áreas e setores).";
  return (
    <EmptyCard
      icon={Users}
      title="Membros sugeridos do comitê"
      badge={comiteSelecionado ? "Sugestão" : "—"}
      accent="primary"
      emptyText={empty}
    />
  );
}
