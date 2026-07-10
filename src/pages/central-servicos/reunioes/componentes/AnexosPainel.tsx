import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Trash2 } from "lucide-react";
import type { ReuniaoAnexo } from "../types";

export function AnexosPainel({
  anexos, onAnexar, onDownloadAnexo, onRemoverAnexo,
}: {
  anexos: ReuniaoAnexo[];
  onAnexar: (file: File) => Promise<boolean>;
  onDownloadAnexo: (path: string) => void;
  onRemoverAnexo: (id: string) => Promise<boolean>;
}) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const pendentes = arquivos;
    setArquivos([]);
    setEnviando(true);
    for (const f of pendentes) await onAnexar(f);
    setEnviando(false);
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Ata preenchida / documentos de apoio
      </p>
      <div className="space-y-1">
        {anexos.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
            <span className="truncate">{a.nome_arquivo}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">
                abrir
              </button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onRemoverAnexo(a.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {anexos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum arquivo anexado ainda.</p>}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Input
          type="file"
          multiple
          className="h-8 min-w-0 flex-1 cursor-pointer text-xs"
          onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
        />
        {arquivos.length > 0 && (
          <Button size="sm" className="h-8 gap-1" onClick={enviar} disabled={enviando}>
            <Paperclip className="h-3 w-3" /> Anexar ({arquivos.length})
          </Button>
        )}
      </div>
    </div>
  );
}
