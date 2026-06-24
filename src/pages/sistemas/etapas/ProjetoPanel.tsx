import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowRight, Paperclip } from "lucide-react";
import type { Anexo, EtapaPanelProps } from "./types";

function CampoComAnexo({
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
  onAnexar: (file: File) => void;
  onDownloadAnexo: (path: string) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const doCampo = anexos.filter((a) => a.campo === campo);

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
          <Input type="file" className="h-8 flex-1 cursor-pointer text-[11px]" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {arquivo && (
            <Button size="sm" className="h-8 gap-1" onClick={() => { onAnexar(arquivo); setArquivo(null); }}>
              <Paperclip className="h-3 w-3" /> Anexar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjetoPanel({ card, papeis, anexos, onUpdate, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const podeEditar = papeis.comite || papeis.desenvolvedores;

  return (
    <div className="space-y-3">
      <CampoComAnexo
        titulo="Levantamento Funcional"
        campo="levantamento_funcional"
        texto={card.levantamento_funcional_texto}
        prazo={card.levantamento_funcional_prazo}
        podeEditar={podeEditar}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ levantamento_funcional_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ levantamento_funcional_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "levantamento_funcional")}
        onDownloadAnexo={onDownloadAnexo}
      />
      <CampoComAnexo
        titulo="Documentação Técnica"
        campo="documentacao_tecnica"
        texto={card.documentacao_tecnica_texto}
        prazo={card.documentacao_tecnica_prazo}
        podeEditar={podeEditar}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ documentacao_tecnica_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ documentacao_tecnica_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "documentacao_tecnica")}
        onDownloadAnexo={onDownloadAnexo}
      />
      <CampoComAnexo
        titulo="Análise Técnica"
        campo="analise_tecnica"
        texto={card.analise_tecnica_texto}
        prazo={card.analise_tecnica_prazo}
        podeEditar={podeEditar}
        anexos={anexos}
        onSalvarTexto={(v) => onUpdate({ analise_tecnica_texto: v })}
        onSalvarPrazo={(v) => onUpdate({ analise_tecnica_prazo: v || null })}
        onAnexar={(f) => onAnexar(f, "analise_tecnica")}
        onDownloadAnexo={onDownloadAnexo}
      />

      <Button className="gap-1.5" disabled={!podeEditar} onClick={() => onUpdate({ etapa: "aprovacoes_priorizacao" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Aprovações e Priorização
      </Button>
      {!podeEditar && <p className="text-[11px] text-muted-foreground">Só Comitê ou Desenvolvedores agem nesta etapa.</p>}
    </div>
  );
}
