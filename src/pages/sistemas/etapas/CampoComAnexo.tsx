import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Paperclip } from "lucide-react";
import type { Anexo } from "./types";

export function CampoComAnexo({
  titulo, campo, texto, prazo, podeEditar, anexos, onSalvarTexto, onSalvarPrazo, onAnexar, onDownloadAnexo,
}: {
  titulo: string;
  campo: string;
  texto: string | null;
  prazo: string | null;
  podeEditar: boolean;
  anexos: Anexo[];
  onSalvarTexto: (v: string) => void;
  onSalvarPrazo: (v: string) => void;
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
      <Textarea
        defaultValue={texto ?? ""}
        placeholder="Escreva aqui…"
        disabled={!podeEditar}
        onBlur={(e) => { if (e.target.value !== (texto ?? "")) onSalvarTexto(e.target.value); }}
        className="text-xs"
      />
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-muted-foreground">Prazo:</label>
        <Input
          type="date"
          defaultValue={prazo ?? ""}
          disabled={!podeEditar}
          onBlur={(e) => { if (e.target.value !== (prazo ?? "")) onSalvarPrazo(e.target.value); }}
          className="h-8 w-40 text-xs"
        />
      </div>
      <div className="space-y-1">
        {doCampo.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-[11px]">
            <span className="truncate">{a.nome_arquivo}</span>
            <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">abrir</button>
          </div>
        ))}
      </div>
      {podeEditar && (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            multiple
            className="h-8 flex-1 cursor-pointer text-[11px]"
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
