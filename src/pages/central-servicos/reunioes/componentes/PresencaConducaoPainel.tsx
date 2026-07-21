import { Button } from "@/components/ui/button";
import { nomeUsuario, type ReuniaoConvidado, type Usuario } from "../types";

export function PresencaConducaoPainel({
  convidados, usuarios, onMarcar,
}: {
  convidados: ReuniaoConvidado[];
  usuarios: Usuario[];
  onMarcar: (convidadoId: string, presente: boolean) => void;
}) {
  const presentes = convidados.filter((c) => c.presente === true).length;
  const ausentes = convidados.filter((c) => c.presente === false).length;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Participantes ({convidados.length})</p>
      <p className="text-xs text-muted-foreground">Presentes: {presentes} · Ausentes: {ausentes}</p>
      <div className="space-y-1">
        {convidados.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5 text-sm">
            <span className="min-w-0 truncate">
              {nomeUsuario(usuarios, c.user_id) ?? c.user_id}
              {c.papel === "observador" && <span className="ml-1 text-xs text-muted-foreground">(observador)</span>}
            </span>
            <div className="flex shrink-0 gap-1">
              <Button type="button" size="sm" variant={c.presente === true ? "default" : "outline"} onClick={() => onMarcar(c.id, true)}>
                Presente
              </Button>
              <Button type="button" size="sm" variant={c.presente === false ? "destructive" : "outline"} onClick={() => onMarcar(c.id, false)}>
                Ausente
              </Button>
            </div>
          </div>
        ))}
        {convidados.length === 0 && <p className="text-xs text-muted-foreground">Nenhum participante adicionado.</p>}
      </div>
    </div>
  );
}
