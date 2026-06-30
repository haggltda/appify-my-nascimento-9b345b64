import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomeUsuario, type EtapaPanelProps } from "./types";

const OPCOES = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "em_implantacao", label: "Em Implantação" },
];

export function ImplantacaoPanel({ card, papeis, usuarios, comentarios, onUpdate, onComentar }: EtapaPanelProps) {
  const [comentario, setComentario] = useState("");
  const comentariosImplantacao = comentarios.filter((c) => c.tipo === "implantacao_comentario");

  const selecionar = (status: string) => onUpdate({ implantacao_status: status });

  const salvarComentario = async () => {
    if (!comentario.trim()) return;
    const ok = await onComentar(comentario, "implantacao_comentario");
    if (ok) setComentario("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Foi implantado corretamente?</p>
      <div className="flex gap-2">
        {OPCOES.map((o) => (
          <Button
            key={o.value}
            variant={card.implantacao_status === o.value ? "default" : "outline"}
            size="sm"
            disabled={!papeis.gerenteSistemas}
            onClick={() => selecionar(o.value)}
            className={cn(card.implantacao_status === o.value && "ring-2 ring-primary/40")}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {(card.implantacao_status === "sim" || card.implantacao_status === "nao") && (
        <div className="space-y-2">
          {comentariosImplantacao.length > 0 && (
            <div className="space-y-1.5">
              {comentariosImplantacao.map((c) => (
                <div key={c.id} className="rounded border-l-2 border-l-muted-foreground bg-muted/30 px-2 py-1.5 text-[11px]">
                  <p className="text-muted-foreground">
                    {nomeUsuario(usuarios, c.autor_id) ?? "Usuário"} — {new Date(c.created_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-0.5">{c.texto}</p>
                </div>
              ))}
            </div>
          )}
          <Textarea
            placeholder="Comentário (opcional)…"
            value={comentario}
            disabled={!papeis.gerenteSistemas}
            onChange={(e) => setComentario(e.target.value)}
            className="text-xs"
          />
          <Button size="sm" variant="outline" disabled={!papeis.gerenteSistemas || !comentario.trim()} onClick={salvarComentario}>
            Salvar comentário
          </Button>
        </div>
      )}

      <Button className="gap-1.5" disabled={!papeis.gerenteSistemas} onClick={() => onUpdate({ etapa: "acompanhamento_assistido" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Acompanhamento Assistido
      </Button>
      {!papeis.gerenteSistemas && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
