import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, FileDown, X } from "lucide-react";
import type { EtapaPanelProps } from "./types";
import { AnexoSimples } from "./AnexoSimples";
import { exportarPdfCaptura } from "./exportarPdfCaptura";

export function HomologacaoAreaSolicitantePanel({
  card, papeis, userId, convidados, anexos, onUpdate, onComentar, onAnexar, onDownloadAnexo,
}: EtapaPanelProps) {
  const [comentarioRessalva, setComentarioRessalva] = useState("");
  const [comentarioReprovacao, setComentarioReprovacao] = useState("");

  const souElegivel =
    (!!userId && userId === card.criado_por) ||
    convidados.some((c) => c.user_id === userId) ||
    papeis.controladoria;

  const aprovarComRessalva = async () => {
    if (!comentarioRessalva.trim()) return;
    const ok = await onComentar(comentarioRessalva, "aprovado_ressalva");
    if (ok) {
      setComentarioRessalva("");
      await onUpdate({ etapa: "triagem_inicial" });
    }
  };

  const reprovar = async () => {
    if (!comentarioReprovacao.trim()) return;
    const ok = await onComentar(comentarioReprovacao, "reprovado");
    if (ok) {
      setComentarioReprovacao("");
      await onUpdate({ etapa: "desenvolvimento" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfCaptura("pdf-capture-target", `homologacao-${card.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Quem criou, foi convidado, ou Controladoria pode aprovar, aprovar com ressalva ou reprovar.
      </p>

      <Button className="gap-1.5" disabled={!souElegivel} onClick={() => onUpdate({ etapa: "treinamento" })}>
        <Check className="h-3.5 w-3.5" /> Aprovar
      </Button>

      <AnexoSimples
        titulo="Termo de Homologação da Área (anexo)"
        campo="homologacao_area_solicitante"
        podeAnexar={souElegivel}
        anexos={anexos}
        onAnexar={(f) => onAnexar(f, "homologacao_area_solicitante")}
        onDownloadAnexo={onDownloadAnexo}
      />

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
      {!souElegivel && <p className="text-[11px] text-muted-foreground">Só quem criou, convidados, ou Controladoria agem nesta etapa.</p>}
    </div>
  );
}
