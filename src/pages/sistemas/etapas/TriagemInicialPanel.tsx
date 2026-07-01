import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Ban, Undo2 } from "lucide-react";
import {
  TRIAGEM_CLASSIFICACAO_LABEL, TRIAGEM_DECISAO_LABEL,
  type EtapaPanelProps,
} from "./types";
import { RecusadoPanel } from "./RecusadoPanel";

function CampoLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function TriagemInicialPanel({ card, papeis, anexos, comentarios, usuarios, onUpdate, onExcluir }: EtapaPanelProps) {
  const [recebidoPor, setRecebidoPor] = useState(card.triagem_recebido_por ?? "");
  const [parecer, setParecer] = useState(card.triagem_parecer ?? "");
  const [encaminharPara, setEncaminharPara] = useState(card.triagem_encaminhamento_para ?? "");
  const [encaminharResp, setEncaminharResp] = useState(card.triagem_encaminhamento_responsavel ?? "");

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
  const podeAvancar = podeEditar && card.triagem_classificacao === "sistema" && !!card.triagem_decisao;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#153169]">Parte B — Triagem Inicial</p>

        {/* Seção 13 — Recebido por */}
        <CampoLabel label="13. Recebido por">
          <Input
            value={recebidoPor}
            onChange={(e) => setRecebidoPor(e.target.value)}
            onBlur={() => onUpdate({ triagem_recebido_por: recebidoPor.trim() || null })}
            placeholder="Nome do responsável"
            disabled={!podeEditar}
            className="text-sm"
          />
        </CampoLabel>

        {/* Seção 14 — Data de triagem concluída */}
        <CampoLabel label="14. Triagem concluída em">
          <Input
            type="date"
            value={card.triagem_concluida_em ?? ""}
            onChange={(e) => onUpdate({ triagem_concluida_em: e.target.value || null })}
            disabled={!podeEditar}
            className="text-sm"
          />
        </CampoLabel>

        {/* Seção 15 — Classificação */}
        <CampoLabel label="15. Classificação da Demanda">
          <Select
            value={card.triagem_classificacao ?? undefined}
            onValueChange={(v) => onUpdate({ triagem_classificacao: v })}
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

        {/* Seção 19 — Parecer da Controladoria */}
        <CampoLabel label="19. Parecer da Controladoria">
          <Textarea
            value={parecer}
            onChange={(e) => setParecer(e.target.value)}
            onBlur={() => onUpdate({ triagem_parecer: parecer.trim() || null })}
            placeholder="Digite o parecer da Controladoria..."
            disabled={!podeEditar}
            rows={3}
            className="text-sm"
          />
        </CampoLabel>

        {/* Seção 17 — Encaminhamento */}
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoLabel label="17. Encaminhar para">
            <Input
              value={encaminharPara}
              onChange={(e) => setEncaminharPara(e.target.value)}
              onBlur={() => onUpdate({ triagem_encaminhamento_para: encaminharPara.trim() || null })}
              placeholder="Ex.: Análise de Necessidade"
              disabled={!podeEditar}
              className="text-sm"
            />
          </CampoLabel>
          <CampoLabel label="Responsável:">
            <Input
              value={encaminharResp}
              onChange={(e) => setEncaminharResp(e.target.value)}
              onBlur={() => onUpdate({ triagem_encaminhamento_responsavel: encaminharResp.trim() || null })}
              placeholder="Digite o nome do responsável"
              disabled={!podeEditar}
              className="text-sm"
            />
          </CampoLabel>
        </div>

        {/* Seção 18 — Decisão */}
        <CampoLabel label="18. Decisão da Triagem">
          <Select
            value={card.triagem_decisao ?? undefined}
            onValueChange={(v) => onUpdate({ triagem_decisao: v })}
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
            onChange={(e) => onUpdate({ triagem_data_decisao: e.target.value || null })}
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
        <p className="text-[11px] text-muted-foreground">Selecione "Necessidade de Sistemas" na Classificação e preencha a Decisão para avançar.</p>
      )}
      {card.triagem_decisao === "devolvido_ajustes" && (
        <p className="text-[11px] text-muted-foreground">Decisão: Devolvido para ajustes — use "Voltar ao painel" para retornar à coluna 1.</p>
      )}
    </div>
  );
}
