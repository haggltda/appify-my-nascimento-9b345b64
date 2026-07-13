import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip } from "lucide-react";
import type { Anexo } from "./types";

// Bloco de anexo "só arquivo" (sem texto/prazo) - pras colunas que só
// precisam de upload de documento, reaproveitando o mesmo padrão de
// min-w-0/flex-1 já corrigido no CampoComAnexo.tsx (evita overflow horizontal
// do input de arquivo nativo).
export function AnexoSimples({
  titulo, campo, podeAnexar, anexos, onAnexar, onDownloadAnexo,
}: {
  titulo: string;
  campo: string;
  podeAnexar: boolean;
  anexos: Anexo[];
  onAnexar: (file: File) => Promise<boolean>;
  onDownloadAnexo: (path: string) => void;
}) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const doCampo = anexos.filter((a) => a.campo === campo);

  const enviar = async () => {
    const pendentes = arquivos;
    setArquivos([]);
    for (const f of pendentes) await onAnexar(f);
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <div className="space-y-1">
        {doCampo.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-[11px]">
            <span className="truncate">{a.nome_arquivo}</span>
            <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">abrir</button>
          </div>
        ))}
        {doCampo.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum arquivo anexado ainda.</p>}
      </div>
      {podeAnexar && (
        <div className="flex min-w-0 items-center gap-2">
          <Input
            type="file"
            multiple
            className="h-8 min-w-0 flex-1 cursor-pointer text-[11px]"
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
          />
          {arquivos.length > 0 && (
            <Button size="sm" className="h-8 gap-1" onClick={enviar}>
              <Paperclip className="h-3 w-3" /> Anexar ({arquivos.length})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
