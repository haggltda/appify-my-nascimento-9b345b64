import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Paperclip } from "lucide-react";
import type { EtapaPanelProps } from "./types";

export function TreinamentoPanel({ card, papeis, anexos, onUpdate, onComentar, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const [faltouFuncoes, setFaltouFuncoes] = useState("");
  const [encontradoBug, setEncontradoBug] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const podeAgir = papeis.gerenteSistemas;
  const anexosTreinamento = anexos.filter((a) => a.campo === "treinamento");

  const enviarAnexos = async () => {
    const pendentes = arquivos;
    setArquivos([]);
    for (const f of pendentes) await onAnexar(f, "treinamento");
  };

  const salvarFaltouFuncoes = async () => {
    if (!faltouFuncoes.trim()) return;
    const ok = await onComentar(faltouFuncoes, "faltou_funcoes");
    if (ok) setFaltouFuncoes("");
  };

  const salvarEncontradoBug = async () => {
    if (!encontradoBug.trim()) return;
    const ok = await onComentar(encontradoBug, "encontrado_bug");
    if (ok) setEncontradoBug("");
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Data do treinamento</label>
        <Input
          type="date"
          defaultValue={card.treinamento_data ?? ""}
          disabled={!podeAgir}
          onBlur={(e) => { if (e.target.value !== (card.treinamento_data ?? "")) onUpdate({ treinamento_data: e.target.value || null }); }}
          className="w-40 text-xs"
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documento assinado</p>
        {anexosTreinamento.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-xs">
            <span className="truncate">{a.nome_arquivo}</span>
            <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">abrir</button>
          </div>
        ))}
        {podeAgir && (
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

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faltou alguma funcionalidade? Explique!</p>
        <Textarea
          value={faltouFuncoes}
          disabled={!podeAgir}
          onChange={(e) => setFaltouFuncoes(e.target.value)}
          className="text-xs"
        />
        <Button size="sm" variant="outline" disabled={!podeAgir || !faltouFuncoes.trim()} onClick={salvarFaltouFuncoes}>
          Salvar comentário
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Existe algum bug? Explique!</p>
        <Textarea
          value={encontradoBug}
          disabled={!podeAgir}
          onChange={(e) => setEncontradoBug(e.target.value)}
          className="text-xs"
        />
        <Button size="sm" variant="outline" disabled={!podeAgir || !encontradoBug.trim()} onClick={salvarEncontradoBug}>
          Salvar comentário
        </Button>
      </div>

      <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "implantacao" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Implantação
      </Button>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
