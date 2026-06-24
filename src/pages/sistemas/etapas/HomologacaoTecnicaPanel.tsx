import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft } from "lucide-react";
import type { EtapaPanelProps } from "./types";

export function HomologacaoTecnicaPanel({ papeis, onUpdate, onComentar }: EtapaPanelProps) {
  const [justificativa, setJustificativa] = useState("");
  const podeAgir = papeis.comite || papeis.controladoria || papeis.desenvolvedores;

  const voltar = async () => {
    if (!justificativa.trim()) return;
    const ok = await onComentar(justificativa, "justificativa_retorno");
    if (ok) {
      setJustificativa("");
      await onUpdate({ etapa: "desenvolvimento_ajustes" });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Comitê, Controladoria e Desenvolvedores validam se a demanda está ok.</p>
      <Button className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ etapa: "homologacao_usuario" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Homologação do Usuário
      </Button>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voltar para Desenvolvimento e Ajustes</p>
        <Textarea
          placeholder="Justificativa do retorno (obrigatória)…"
          value={justificativa}
          disabled={!podeAgir}
          onChange={(e) => setJustificativa(e.target.value)}
          className="text-xs"
        />
        <Button variant="outline" className="gap-1.5" disabled={!podeAgir || !justificativa.trim()} onClick={voltar}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar com justificativa
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só Comitê, Controladoria ou Desenvolvedores agem nesta etapa.</p>}
    </div>
  );
}
