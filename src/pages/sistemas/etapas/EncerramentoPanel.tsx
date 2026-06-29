import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Paperclip } from "lucide-react";
import {
  PESQUISA_ENCERRAMENTO, PESQUISA_PODE_ENCERRAR_PERGUNTA, PESQUISA_PODE_ENCERRAR_OPCOES,
  nomeUsuario, type EtapaPanelProps,
} from "./types";

export function EncerramentoPanel({ card, papeis, userId, usuarios, convidados, anexos, comentarios, onUpdate, onComentar, onAnexar, onDownloadAnexo }: EtapaPanelProps) {
  const [comentario, setComentario] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const anexosEncerramento = anexos.filter((a) => a.campo === "encerramento");
  const comentariosEncerramento = comentarios.filter((c) => c.tipo === "encerramento_comentario");

  const enviarAnexos = async () => {
    const pendentes = arquivos;
    setArquivos([]);
    for (const f of pendentes) await onAnexar(f, "encerramento");
  };

  const souElegivelPesquisa =
    (!!userId && userId === card.criado_por) ||
    convidados.some((c) => c.user_id === userId) ||
    papeis.controladoria;

  const pesquisaCompleta =
    PESQUISA_ENCERRAMENTO.every((p) => card[p.key] != null) && card.pesquisa_pode_encerrar != null;

  const salvarComentario = async () => {
    if (!comentario.trim()) return;
    const ok = await onComentar(comentario, "encerramento_comentario");
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
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentário de conclusão</p>
        {comentariosEncerramento.length > 0 && (
          <div className="space-y-1.5">
            {comentariosEncerramento.map((c) => (
              <div key={c.id} className="rounded border-l-2 border-l-success bg-muted/30 px-2 py-1.5 text-[11px]">
                <p className="text-muted-foreground">
                  {nomeUsuario(usuarios, c.autor_id) ?? "Usuário"} — {new Date(c.created_at).toLocaleString("pt-BR")}
                </p>
                <p className="mt-0.5">{c.texto}</p>
              </div>
            ))}
          </div>
        )}
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

      <div className="space-y-4 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pesquisa de Avaliação da Demanda</p>
        {!souElegivelPesquisa && (
          <p className="text-[11px] text-muted-foreground">Só quem criou a solicitação, convidados, ou Controladoria respondem a pesquisa.</p>
        )}
        {PESQUISA_ENCERRAMENTO.map((p, i) => (
          <div key={p.key}>
            <p className="mb-1.5 text-xs font-medium">{i + 1}. {p.pergunta}</p>
            <RadioGroup
              value={card[p.key] != null ? String(card[p.key]) : undefined}
              onValueChange={(v) => onUpdate({ [p.key]: Number(v) })}
              disabled={!souElegivelPesquisa}
            >
              {p.opcoes.map((opcao, idx) => (
                <label key={idx} className="flex items-center gap-2 text-xs">
                  <RadioGroupItem value={String(idx + 1)} />
                  {idx + 1} – {opcao}
                </label>
              ))}
            </RadioGroup>
          </div>
        ))}
        <div>
          <p className="mb-1.5 text-xs font-medium">{PESQUISA_PODE_ENCERRAR_PERGUNTA}</p>
          <RadioGroup
            value={card.pesquisa_pode_encerrar == null ? undefined : card.pesquisa_pode_encerrar ? "sim" : "nao"}
            onValueChange={(v) => onUpdate({ pesquisa_pode_encerrar: v === "sim" })}
            disabled={!souElegivelPesquisa}
          >
            <label className="flex items-center gap-2 text-xs">
              <RadioGroupItem value="sim" />
              {PESQUISA_PODE_ENCERRAR_OPCOES.sim}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <RadioGroupItem value="nao" />
              {PESQUISA_PODE_ENCERRAR_OPCOES.nao}
            </label>
          </RadioGroup>
        </div>
      </div>

      <Button
        className="gap-1.5"
        disabled={!papeis.controladoria || card.finalizado || !pesquisaCompleta}
        onClick={() => onUpdate({ finalizado: true })}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> {card.finalizado ? "Demanda finalizada" : "Finalizar demanda"}
      </Button>
      {!papeis.controladoria && <p className="text-[11px] text-muted-foreground">Só Controladoria age nesta etapa.</p>}
      {papeis.controladoria && !card.finalizado && !pesquisaCompleta && (
        <p className="text-[11px] text-muted-foreground">A Pesquisa de Avaliação da Demanda precisa estar completa pra finalizar.</p>
      )}
    </div>
  );
}
