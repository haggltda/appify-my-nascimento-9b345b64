import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, FileDown } from "lucide-react";
import { STATUS_DESENVOLVIMENTO_LABEL, type EtapaPanelProps } from "./types";
import { exportarPdfCaptura } from "./exportarPdfCaptura";

export function DesenvolvimentoPanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onComentar }: EtapaPanelProps) {
  const podeEditar = papeis.desenvolvedores || papeis.gerenteSistemas;
  const podeAvancar = papeis.desenvolvedores;
  const podeDevolver = papeis.desenvolvedores || papeis.gerenteSistemas;
  const pronto = card.progresso_pct === 100 && card.status_desenvolvimento === "finalizado";

  const [justInterromper, setJustInterromper] = useState("");
  const [justErroDoc, setJustErroDoc] = useState("");

  const interromper = async () => {
    if (!justInterromper.trim()) return;
    const ok = await onComentar(justInterromper, "interromper_desenvolvimento");
    if (ok) {
      setJustInterromper("");
      await onUpdate({ etapa: "analise_necessidade" });
    }
  };

  const erroDocumental = async () => {
    if (!justErroDoc.trim()) return;
    const ok = await onComentar(justErroDoc, "erro_documental");
    if (ok) {
      setJustErroDoc("");
      await onUpdate({ etapa: "levantamento_funcional" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfCaptura("pdf-capture-target", `desenvolvimento-${card.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Desenvolvedores e Gerente de Sistemas atualizam progresso e prazo, estilo Trello.</p>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progresso</label>
        <Progress value={card.progresso_pct} className="h-2.5" />
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={card.progresso_pct}
            disabled={!podeEditar}
            onBlur={(e) => {
              const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
              if (v !== card.progresso_pct) onUpdate({ progresso_pct: v });
            }}
            className="w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Prazo</label>
        <Input
          type="date"
          defaultValue={card.data_fim ?? ""}
          disabled={!podeEditar}
          onBlur={(e) => { if (e.target.value !== (card.data_fim ?? "")) onUpdate({ data_fim: e.target.value || null }); }}
          className="w-40 text-xs"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status de Desenvolvimento</label>
        <Select
          value={card.status_desenvolvimento ?? undefined}
          onValueChange={(v) => onUpdate({ status_desenvolvimento: v })}
          disabled={!podeEditar}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Selecionar status…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_DESENVOLVIMENTO_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button className="gap-1.5" disabled={!podeAvancar || !pronto} onClick={() => onUpdate({ etapa: "testes_internos" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Testes Internos
      </Button>
      {!podeAvancar && <p className="text-[11px] text-muted-foreground">Só Desenvolvedores podem avançar esta etapa.</p>}
      {podeAvancar && !pronto && <p className="text-[11px] text-muted-foreground">Só é possível avançar com 100% de progresso e status "Finalizado".</p>}

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interromper Desenvolvimento (volta para Análise de Necessidade)</p>
        <Textarea
          placeholder="Justificativa (obrigatória)…"
          value={justInterromper}
          disabled={!podeDevolver}
          onChange={(e) => setJustInterromper(e.target.value)}
          className="text-xs"
        />
        <Button variant="destructive" size="sm" className="gap-1.5" disabled={!podeDevolver || !justInterromper.trim()} onClick={interromper}>
          <ArrowLeft className="h-3.5 w-3.5" /> Interromper Desenvolvimento
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Erro Documental (volta para Levantamento Funcional)</p>
        <Textarea
          placeholder="Justificativa (obrigatória)…"
          value={justErroDoc}
          disabled={!podeDevolver}
          onChange={(e) => setJustErroDoc(e.target.value)}
          className="text-xs"
        />
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!podeDevolver || !justErroDoc.trim()} onClick={erroDocumental}>
          <ArrowLeft className="h-3.5 w-3.5" /> Erro Documental
        </Button>
      </div>
      {!podeDevolver && <p className="text-[11px] text-muted-foreground">Só Desenvolvedores ou Gerente de Sistemas agem nesta etapa.</p>}
    </div>
  );
}
