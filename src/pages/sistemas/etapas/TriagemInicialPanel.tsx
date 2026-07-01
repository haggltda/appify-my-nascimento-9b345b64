import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Ban, Undo2, FileDown } from "lucide-react";
import {
  TRIAGEM_CLASSIFICACAO_LABEL, TRIAGEM_DECISAO_LABEL,
  type EtapaPanelProps,
} from "./types";
import { RecusadoPanel } from "./RecusadoPanel";
import { exportarPdfCaptura } from "./exportarPdfCaptura";

function CampoLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function TriagemInicialPanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onExcluir }: EtapaPanelProps) {
  if (card.recusado) {
    return (
      <RecusadoPanel
        podeReativar={papeis.controladoria}
        onReativar={() => onUpdate({ etapa: "solicitacao_demanda", recusado: false })}
        onExcluir={onExcluir}
      />
    );
  }

  const podeEditar = papeis.controladoria || papeis.comite;
  const podeAvancar = podeEditar && !!card.triagem_classificacao && !!card.triagem_decisao;

  const save = (campo: string) => (valor: string | boolean | null) =>
    onUpdate({ [campo]: valor });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => exportarPdfCaptura("pdf-capture-target", `triagem-${card.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`)}
        >
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>

      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#153169]">Parte B — Triagem Inicial</p>

        {/* Seção 13 — Recebido por */}
        <CampoLabel label="13. Recebido por">
          <Input
            value={card.triagem_recebido_por ?? ""}
            onChange={(e) => save("triagem_recebido_por")(e.target.value || null)}
            placeholder="Nome de quem recebeu a solicitação"
            disabled={!podeEditar}
            className="text-sm"
          />
        </CampoLabel>

        {/* Seção 14 — Data de triagem concluída */}
        <CampoLabel label="14. Triagem concluída em">
          <Input
            type="date"
            value={card.triagem_concluida_em ?? ""}
            onChange={(e) => save("triagem_concluida_em")(e.target.value || null)}
            disabled={!podeEditar}
            className="text-sm"
          />
        </CampoLabel>

        {/* Seção 15 — Classificação */}
        <CampoLabel label="15. Classificação da Demanda">
          <Select
            value={card.triagem_classificacao ?? undefined}
            onValueChange={(v) => save("triagem_classificacao")(v)}
            disabled={!podeEditar}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Selecione a classificação…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRIAGEM_CLASSIFICACAO_LABEL).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoLabel>

        {/* Seção 16 — Análise preliminar / parecer */}
        <CampoLabel label="16. Análise Preliminar">
          <Textarea
            value={card.triagem_parecer ?? ""}
            onChange={(e) => save("triagem_parecer")(e.target.value || null)}
            placeholder="Descreva a análise preliminar da solicitação…"
            disabled={!podeEditar}
            rows={3}
            className="text-sm"
          />
        </CampoLabel>

        {/* Seção 17 — Encaminhamento */}
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoLabel label="17. Encaminhar para">
            <Input
              value={card.triagem_encaminhamento_para ?? ""}
              onChange={(e) => save("triagem_encaminhamento_para")(e.target.value || null)}
              placeholder="Ex.: Análise de Necessidade"
              disabled={!podeEditar}
              className="text-sm"
            />
          </CampoLabel>
          <CampoLabel label="Responsável pelo encaminhamento">
            <Input
              value={card.triagem_encaminhamento_responsavel ?? ""}
              onChange={(e) => save("triagem_encaminhamento_responsavel")(e.target.value || null)}
              placeholder="Nome do responsável"
              disabled={!podeEditar}
              className="text-sm"
            />
          </CampoLabel>
        </div>

        {/* Seção 18 — Decisão */}
        <CampoLabel label="18. Decisão da Triagem">
          <Select
            value={card.triagem_decisao ?? undefined}
            onValueChange={(v) => save("triagem_decisao")(v)}
            disabled={!podeEditar}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Selecione a decisão…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRIAGEM_DECISAO_LABEL).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoLabel>

        {/* Seção 19 — Data da decisão */}
        <CampoLabel label="19. Data da Decisão">
          <Input
            type="date"
            value={card.triagem_data_decisao ?? ""}
            onChange={(e) => save("triagem_data_decisao")(e.target.value || null)}
            disabled={!podeEditar}
            className="text-sm"
          />
        </CampoLabel>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button
          className="gap-1.5"
          disabled={!podeAvancar || card.triagem_decisao === "reprovado" || card.triagem_decisao === "devolvido_ajustes"}
          onClick={() => onUpdate({ etapa: "analise_necessidade" })}
        >
          <ArrowRight className="h-3.5 w-3.5" /> Avançar para Análise de Necessidade
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={!podeEditar}
          onClick={() => onUpdate({ etapa: "solicitacao_demanda" })}
        >
          <Undo2 className="h-3.5 w-3.5" /> Voltar ao painel
        </Button>
        <Button
          variant="destructive"
          className="gap-1.5"
          disabled={!podeEditar}
          onClick={() => onUpdate({ recusado: true })}
        >
          <Ban className="h-3.5 w-3.5" /> Cancelar solicitação
        </Button>
      </div>

      {!podeEditar && (
        <p className="text-[11px] text-muted-foreground">Só Controladoria ou Comitê agem nesta etapa.</p>
      )}
      {podeEditar && !podeAvancar && (
        <p className="text-[11px] text-muted-foreground">Preencha a Classificação e a Decisão para avançar.</p>
      )}
      {card.triagem_decisao === "devolvido_ajustes" && (
        <p className="text-[11px] text-muted-foreground">Decisão: Devolvido para ajustes — use "Voltar ao painel" para retornar à coluna 1.</p>
      )}
    </div>
  );
}
