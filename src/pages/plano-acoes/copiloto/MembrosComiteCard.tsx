import { Users, Loader2 } from "lucide-react";
import { EmptyCard } from "./EmptyCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useMembrosComite, type MembroOrigem } from "@/hooks/useMembrosComite";

interface Props {
  comiteSelecionado?: string;
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const origemStyle: Record<MembroOrigem, string> = {
  "Líder do comitê": "bg-primary/10 text-primary border-primary/30",
  "Gestor da área": "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "Gestor do setor": "bg-muted text-muted-foreground border-border",
};

export function MembrosComiteCard({ comiteSelecionado }: Props) {
  const { data, isLoading } = useMembrosComite(comiteSelecionado);

  if (!comiteSelecionado) {
    return (
      <EmptyCard
        icon={Users}
        title="Membros sugeridos do comitê"
        badge="—"
        accent="primary"
        emptyText="Selecione um comitê para visualizar os membros sugeridos."
      />
    );
  }

  const membros = data ?? [];

  return (
    <EmptyCard
      icon={Users}
      title="Membros sugeridos do comitê"
      badge={membros.length ? `${membros.length} sugerido${membros.length > 1 ? "s" : ""}` : "Sugestão"}
      accent="primary"
      emptyText=""
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground italic flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Buscando membros…
        </p>
      ) : !membros.length ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhum membro sugerido encontrado para este comitê.
        </p>
      ) : (
        <ul className="space-y-2">
          {membros.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                {m.avatar_url ? <AvatarImage src={m.avatar_url} alt={m.nome} /> : null}
                <AvatarFallback className="text-[10px]">{initials(m.nome) || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{m.nome}</div>
                {m.email && <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>}
              </div>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${origemStyle[m.origem]}`}>
                {m.origem}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </EmptyCard>
  );
}
