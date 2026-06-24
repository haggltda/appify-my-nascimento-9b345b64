import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, AlertTriangle, X } from "lucide-react";
import type { EtapaPanelProps } from "./types";

const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

export function HomologacaoUsuarioPanel({ card, papeis, userId, convidados, onUpdate, onComentar }: EtapaPanelProps) {
  const [comentarioRessalva, setComentarioRessalva] = useState("");
  const [comentarioReprovacao, setComentarioReprovacao] = useState("");

  const souElegivel =
    (!!userId && userId === card.criado_por) ||
    convidados.some((c) => c.user_id === userId) ||
    papeis.controladoria;

  const prazoFinal = new Date(new Date(card.etapa_entrada_em).getTime() + DOIS_DIAS_MS);
  const expirado = new Date() > prazoFinal;
  const prazoFmt = `${String(prazoFinal.getDate()).padStart(2, "0")}/${String(prazoFinal.getMonth() + 1).padStart(2, "0")}/${prazoFinal.getFullYear()}`;

  const aprovarComRessalva = async () => {
    if (!comentarioRessalva.trim()) return;
    const ok = await onComentar(comentarioRessalva, "aprovado_ressalva");
    if (ok) {
      setComentarioRessalva("");
      await onUpdate({ etapa: "triagem_inicial_comite" });
    }
  };

  const reprovar = async () => {
    if (!comentarioReprovacao.trim()) return;
    const ok = await onComentar(comentarioReprovacao, "reprovado");
    if (ok) {
      setComentarioReprovacao("");
      await onUpdate({ etapa: "desenvolvimento_ajustes" });
    }
  };

  return (
    <div className="space-y-4">
      {(!!userId && (userId === card.criado_por || convidados.some((c) => c.user_id === userId))) && (
        expirado ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            O prazo para tomar uma ação neste card expirou no dia {prazoFmt}.
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Você tem até {prazoFmt} pra tomar uma ação neste card.</p>
        )
      )}

      <p className="text-sm text-muted-foreground">
        Quem criou, foi convidado, ou Controladoria pode aprovar, aprovar com ressalva ou reprovar.
      </p>

      <Button className="gap-1.5" disabled={!souElegivel} onClick={() => onUpdate({ etapa: "treinamentos" })}>
        <Check className="h-3.5 w-3.5" /> Aprovar
      </Button>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aprovar com Ressalva</p>
        <Textarea
          placeholder="Justificativa (obrigatória)…"
          value={comentarioRessalva}
          disabled={!souElegivel}
          onChange={(e) => setComentarioRessalva(e.target.value)}
          className="text-xs"
        />
        <Button variant="outline" className="gap-1.5" disabled={!souElegivel || !comentarioRessalva.trim()} onClick={aprovarComRessalva}>
          Aprovar com Ressalva
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reprovar</p>
        <Textarea
          placeholder="Justificativa (obrigatória)…"
          value={comentarioReprovacao}
          disabled={!souElegivel}
          onChange={(e) => setComentarioReprovacao(e.target.value)}
          className="text-xs"
        />
        <Button variant="destructive" className="gap-1.5" disabled={!souElegivel || !comentarioReprovacao.trim()} onClick={reprovar}>
          <X className="h-3.5 w-3.5" /> Reprovar
        </Button>
      </div>
    </div>
  );
}
