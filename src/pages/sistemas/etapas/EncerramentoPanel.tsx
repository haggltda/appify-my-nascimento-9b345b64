import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Paperclip } from "lucide-react";
import type { EtapaPanelProps } from "./types";

export function EncerramentoPanel({ card, papeis, anexos, onUpdate, onComentar, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const [comentario, setComentario] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const anexosEncerramento = anexos.filter((a) => a.campo === "encerramento");

  const salvarComentario = async () => {
    if (!comentario.trim()) return;
    const ok = await onComentar(comentario);
    if (ok) setComentario("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Controladoria anexa e escreve um comentário confirmando que a demanda foi concluída com sucesso.
      </p>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anexos</p>
        {anexosEncerramento.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-xs">
            <span className="truncate">{a.nome_arquivo}</span>
            <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">abrir</button>
          </div>
        ))}
        {papeis.controladoria && (
          <div className="flex items-center gap-2">
            <Input type="file" className="h-8 flex-1 cursor-pointer text-[11px]" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            {arquivo && (
              <Button size="sm" className="h-8 gap-1" onClick={() => { onAnexar(arquivo, "encerramento"); setArquivo(null); }}>
                <Paperclip className="h-3 w-3" /> Anexar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentário de conclusão</p>
        <Textarea
          value={comentario}
          disabled={!papeis.controladoria}
          onChange={(e) => setComentario(e.target.value)}
          className="text-xs"
        />
        <Button size="sm" variant="outline" disabled={!papeis.controladoria || !comentario.trim()} onClick={salvarComentario}>
          Salvar comentário
        </Button>
      </div>

      <Button
        className="gap-1.5"
        disabled={!papeis.controladoria || card.finalizado}
        onClick={() => onUpdate({ finalizado: true })}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> {card.finalizado ? "Demanda finalizada" : "Finalizar demanda"}
      </Button>
      {!papeis.controladoria && <p className="text-[11px] text-muted-foreground">Só Controladoria age nesta etapa.</p>}
    </div>
  );
}
