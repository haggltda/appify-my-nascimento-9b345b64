import { useState } from "react";
import { ExternalLink, AlertTriangle, GitMerge, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AcaoSimilar } from "@/hooks/useAcoesSimilares";
import type { Draft } from "@/hooks/useCopilotoChat";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  similares: AcaoSimilar[];
  draft: Draft;
  onAbrirExistente: (id: string) => void;
  onCriarComplementar: () => void;
  onCriarMesmoAssim: () => void;
}

const NIVEL_LABEL: Record<AcaoSimilar["nivel"], string> = {
  alta: "Alta similaridade",
  media: "Similaridade média",
  baixa: "Similaridade baixa",
};

const NIVEL_CLASSES: Record<AcaoSimilar["nivel"], string> = {
  alta: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400",
  media: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  baixa: "bg-muted text-muted-foreground border-border",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

export function AcoesSimilaresDialog({
  open,
  onOpenChange,
  similares,
  draft,
  onAbrirExistente,
  onCriarComplementar,
  onCriarMesmoAssim,
}: Props) {
  const [confirmandoMesmoAssim, setConfirmandoMesmoAssim] = useState(false);
  const [confirmandoComplementar, setConfirmandoComplementar] = useState(false);
  const temAlta = similares.some((s) => s.nivel === "alta");

  const handleClose = (v: boolean) => {
    if (!v) {
      setConfirmandoMesmoAssim(false);
      setConfirmandoComplementar(false);
    }
    onOpenChange(v);
  };

  const recomendacao = (nivel: AcaoSimilar["nivel"]) => {
    if (nivel === "alta") return "Provável duplicidade. Avalie usar a ação existente.";
    if (nivel === "media") return "Pode ser parcialmente complementar à ação existente.";
    return "Apenas referência histórica.";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Possíveis ações relacionadas encontradas
          </DialogTitle>
          <DialogDescription>
            A IA encontrou ações existentes que podem resolver o mesmo problema ou parte dele.
            Revise antes de criar uma nova ação.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-3 bg-muted/30 border-dashed">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Nova ação proposta</p>
          <p className="font-medium text-sm">{draft.titulo || "(sem título)"}</p>
          {draft.acao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{draft.acao}</p>}
          <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground">
            {draft.comite && <Badge variant="outline">Comitê: {draft.comite}</Badge>}
            {draft.area && <Badge variant="outline">Área: {draft.area}</Badge>}
            {draft.setor && <Badge variant="outline">Setor: {draft.setor}</Badge>}
            {draft.prioridade_normalizada && <Badge variant="outline">{draft.prioridade_normalizada}</Badge>}
          </div>
        </Card>

        <ScrollArea className="max-h-[45vh]">
          <div className="space-y-3 pr-2">
            {similares.map((s) => (
              <Card key={s.acao.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.acao.titulo || "(sem título)"}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.acao.acao || "—"}</p>
                  </div>
                  <Badge className={NIVEL_CLASSES[s.nivel]}>
                    {NIVEL_LABEL[s.nivel]} · {Math.round(s.score * 100)}%
                  </Badge>
                </div>

                {s.acao.problema && (
                  <p className="text-xs text-muted-foreground mt-2"><span className="font-medium">Problema:</span> {s.acao.problema}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
                  <div><span className="text-muted-foreground">Comitê:</span> {s.acao.comite || "—"}</div>
                  <div><span className="text-muted-foreground">Área:</span> {s.acao.area || "—"}</div>
                  <div><span className="text-muted-foreground">Setor:</span> {s.acao.setor || "—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> {s.acao.status_normalizado}</div>
                  <div><span className="text-muted-foreground">Resp.:</span> {s.acao.responsavel_nome_origem || "—"}</div>
                  <div><span className="text-muted-foreground">Prioridade:</span> {s.acao.prioridade_normalizada || "—"}</div>
                  <div><span className="text-muted-foreground">Início:</span> {fmtDate(s.acao.data_inicio_planejado_original)}</div>
                  <div><span className="text-muted-foreground">Fim:</span> {fmtDate(s.acao.data_fim_planejado_original)}</div>
                </div>

                <Separator className="my-3" />
                <p className="text-xs"><span className="font-medium">Motivo:</span> {s.motivo}</p>
                <p className="text-xs text-muted-foreground mt-1">{recomendacao(s.nivel)}</p>

                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => onAbrirExistente(s.acao.id)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir ação existente
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {confirmandoMesmoAssim && temAlta && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400">
            Existe alta similaridade com ação existente. Confirma criar uma nova ação mesmo assim?
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" onClick={onCriarMesmoAssim}>Sim, criar mesmo assim</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmandoMesmoAssim(false)}>Voltar</Button>
            </div>
          </div>
        )}

        {confirmandoComplementar && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            Esta nova ação será criada como complementar, sem vínculo formal nesta versão.
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={onCriarComplementar}>Confirmar criação complementar</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmandoComplementar(false)}>Voltar</Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => handleClose(false)}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => { setConfirmandoMesmoAssim(false); setConfirmandoComplementar(true); }}
          >
            <GitMerge className="h-4 w-4 mr-1" /> Criar ação complementar
          </Button>
          {temAlta ? (
            <Button
              variant="destructive"
              onClick={() => { setConfirmandoComplementar(false); setConfirmandoMesmoAssim(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Criar nova ação mesmo assim
            </Button>
          ) : (
            <Button onClick={onCriarMesmoAssim}>
              <Plus className="h-4 w-4 mr-1" /> Criar nova ação mesmo assim
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
