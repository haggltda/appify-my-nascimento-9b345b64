import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Send, X, Ban } from "lucide-react";
import { nomeUsuario, type EtapaPanelProps } from "./types";
import { RecusadoPanel } from "./RecusadoPanel";

export function SolicitacaoDemandaPanel({
  card, papeis, userId, convidaveis, convidados, onUpdate, onAdicionarConvidado, onRemoverConvidado, onExcluir,
}: EtapaPanelProps) {
  const [novoConvidado, setNovoConvidado] = useState<string | null>(null);
  const souCriador = !!userId && userId === card.criado_por;
  const podeAgir = papeis.comite || papeis.controladoria;

  if (card.recusado) {
    return (
      <RecusadoPanel
        podeReativar={papeis.controladoria}
        onReativar={() => onUpdate({ etapa: "solicitacao_demanda", recusado: false })}
        onExcluir={onExcluir}
      />
    );
  }
  const opcoes = convidaveis
    .filter((u) => !convidados.some((c) => c.user_id === u.id))
    .map((u) => ({ value: u.id, label: u.display_name }));

  const adicionar = async () => {
    if (!novoConvidado) return;
    const ok = await onAdicionarConvidado(novoConvidado);
    if (ok) setNovoConvidado(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Convidados</p>
        <div className="space-y-1">
          {convidados.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-xs">
              <span>{nomeUsuario(convidaveis, c.user_id) ?? c.user_id}</span>
              {souCriador && (
                <button type="button" onClick={() => onRemoverConvidado(c.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {convidados.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum convidado ainda.</p>}
        </div>
        {souCriador && (
          <div className="mt-2 flex items-center gap-2">
            <SearchableSelect
              value={novoConvidado}
              onChange={setNovoConvidado}
              options={opcoes}
              placeholder="Adicionar convidado…"
              searchPlaceholder="Buscar usuário..."
            />
            <Button size="sm" onClick={adicionar} disabled={!novoConvidado}>Adicionar</Button>
          </div>
        )}
        {!souCriador && (
          <p className="mt-1 text-[11px] text-muted-foreground">Só quem criou a solicitação pode gerenciar convidados.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onUpdate({ etapa: "triagem_inicial" })} disabled={!podeAgir} className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Enviar para Triagem Inicial
        </Button>
        <Button variant="destructive" className="gap-1.5" disabled={!podeAgir} onClick={() => onUpdate({ recusado: true })}>
          <Ban className="h-3.5 w-3.5" /> Encerrar/Excluir
        </Button>
      </div>
      {!podeAgir && <p className="text-[11px] text-muted-foreground">Só Comitê ou Controladoria agem nesta etapa.</p>}
    </div>
  );
}
