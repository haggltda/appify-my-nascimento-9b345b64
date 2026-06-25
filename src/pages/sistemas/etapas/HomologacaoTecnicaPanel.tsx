import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { APROVACOES_HOMOLOGACAO_TECNICA, type EtapaPanelProps } from "./types";

const APROVACOES = Object.entries(APROVACOES_HOMOLOGACAO_TECNICA).map(([campo, nome]) => ({
  campo: campo as keyof typeof APROVACOES_HOMOLOGACAO_TECNICA,
  nome,
}));

export function HomologacaoTecnicaPanel({ card, papeis, onUpdate, onComentar }: EtapaPanelProps) {
  const [justificativa, setJustificativa] = useState("");
  const podeAgir = papeis.comite || papeis.controladoria || papeis.desenvolvedores;
  const todasAprovadas = APROVACOES.every((a) => card[a.campo]);

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

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aguardando Aprovações Necessárias</p>
        {APROVACOES.map((a) => (
          <label key={a.campo} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={card[a.campo]}
              disabled={!papeis.comite}
              onCheckedChange={(checked) => onUpdate({ [a.campo]: checked === true })}
            />
            {a.nome}
          </label>
        ))}
        {!papeis.comite && <p className="text-[11px] text-muted-foreground">Só o Comitê marca essas aprovações.</p>}
      </div>

      <Button className="gap-1.5" disabled={!podeAgir || !todasAprovadas} onClick={() => onUpdate({ etapa: "homologacao_usuario" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Homologação do Usuário
      </Button>
      {podeAgir && !todasAprovadas && (
        <p className="text-[11px] text-muted-foreground">As 3 aprovações precisam estar marcadas para avançar.</p>
      )}

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
