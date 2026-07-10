import { nomeUsuario, type ReuniaoLog, type Usuario } from "../types";

export function HistoricoPainel({ logs, usuarios }: { logs: ReuniaoLog[]; usuarios: Usuario[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map((l) => {
        const nome = nomeUsuario(usuarios, l.user_id) ?? "Usuário";
        return (
          <div key={l.id} className="rounded-md border border-border px-3 py-2 text-xs">
            <span className="font-medium">{nome}</span>{" "}
            <span className="text-muted-foreground">{l.detalhe}</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
          </div>
        );
      })}
    </div>
  );
}
