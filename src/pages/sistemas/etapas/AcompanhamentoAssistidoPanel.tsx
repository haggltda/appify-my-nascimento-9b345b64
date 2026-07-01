import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, FileDown, Paperclip } from "lucide-react";
import type { EtapaPanelProps } from "./types";
import { exportarPdfEtapa } from "./documentoPdf";

export function AcompanhamentoAssistidoPanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onComentar, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const [comentario, setComentario] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const anexosAcompanhamento = anexos.filter((a) => a.campo === "acompanhamento");

  const salvarComentario = async () => {
    if (!comentario.trim()) return;
    const ok = await onComentar(comentario);
    if (ok) setComentario("");
  };

  const enviarAnexos = async () => {
    const pendentes = arquivos;
    setArquivos([]);
    for (const f of pendentes) await onAnexar(f, "acompanhamento");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfEtapa("acompanhamento_assistido", card, anexos, comentarios, usuarios)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Gerente de Sistemas acompanha os usuários finais; Desenvolvedores ficam disponíveis por 10 dias úteis pra arrumar bugs.
      </p>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Foi encontrado algum bug? Descreva para equipe de Desenvolvedores.
        </p>
        <Textarea
          value={comentario}
          disabled={!papeis.gerenteSistemas}
          onChange={(e) => setComentario(e.target.value)}
          className="text-xs"
        />
        <Button size="sm" variant="outline" disabled={!papeis.gerenteSistemas || !comentario.trim()} onClick={salvarComentario}>
          Salvar comentário
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anexos</p>
        {anexosAcompanhamento.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-xs">
            <span className="truncate">{a.nome_arquivo}</span>
            <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">abrir</button>
          </div>
        ))}
        {papeis.gerenteSistemas && (
          <div className="flex min-w-0 items-center gap-2">
            <Input
              type="file"
              multiple
              className="h-8 min-w-0 flex-1 cursor-pointer text-[11px]"
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            />
            {arquivos.length > 0 && (
              <Button size="sm" className="h-8 gap-1" onClick={enviarAnexos}>
                <Paperclip className="h-3 w-3" /> Anexar ({arquivos.length})
              </Button>
            )}
          </div>
        )}
      </div>

      <Button className="gap-1.5" disabled={!papeis.gerenteSistemas} onClick={() => onUpdate({ etapa: "encerramento" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Encerramento
      </Button>
      {!papeis.gerenteSistemas && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
