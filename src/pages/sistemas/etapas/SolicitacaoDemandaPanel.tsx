import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Send, X, Ban } from "lucide-react";
import {
  nomeUsuario, fmtData,
  CLASSIFICACAO_DEMANDA_OPCOES, BENEFICIOS_ESPERADOS_OPCOES, IMPACTO_TIPO_OPCOES,
  DOCUMENTOS_APOIO_OPCOES, GRAU_URGENCIA_LABEL,
  type EtapaPanelProps,
} from "./types";
import { RecusadoPanel } from "./RecusadoPanel";

function LabelValor({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{valor || <span className="text-muted-foreground">-</span>}</div>
    </div>
  );
}

function SecaoParteA({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2 border-b border-border pb-1.5">
        <span className="inline-block h-5 w-5 shrink-0 rounded-full bg-[#153169] text-[10px] font-bold text-white leading-5 text-center">
          {numero}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#153169]">{titulo}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ListaOpcoes({ valores, opcoes }: { valores: string[] | null; opcoes: { value: string; label: string }[] }) {
  if (!valores || valores.length === 0) return <span className="text-muted-foreground">-</span>;
  const labels = valores.map((v) => opcoes.find((o) => o.value === v)?.label ?? v);
  return <span>{labels.join(", ")}</span>;
}

export function SolicitacaoDemandaPanel({
  card, papeis, userId, anexos, comentarios, usuarios, convidaveis, convidados,
  onUpdate, onAdicionarConvidado, onRemoverConvidado, onExcluir,
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

  // Verifica se o card tem campos da Parte A (novo FSD) ou apenas campos legados
  const temParteA = !!(card.area_solicitante || card.responsavel_solicitacao || card.classificacao_demanda?.length || card.descricao_necessidade);

  return (
    <div className="space-y-4">
      {/* Parte A - leitura para todos */}
      {temParteA ? (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parte A - Solicitação da Demanda (read-only)</p>

          <SecaoParteA numero={1} titulo="Identificação">
            <div className="grid gap-2 sm:grid-cols-2">
              <LabelValor label="Área Solicitante" valor={card.area_solicitante} />
              <LabelValor label="Responsável" valor={card.responsavel_solicitacao} />
              <LabelValor label="Cargo" valor={card.cargo_solicitante} />
              <LabelValor label="E-mail" valor={card.email_solicitante} />
              <LabelValor label="Telefone" valor={card.telefone_solicitante} />
            </div>
          </SecaoParteA>

          <SecaoParteA numero={2} titulo="Classificação da Demanda">
            <ListaOpcoes valores={card.classificacao_demanda} opcoes={CLASSIFICACAO_DEMANDA_OPCOES} />
          </SecaoParteA>

          <SecaoParteA numero={3} titulo="Descrição da Necessidade">
            <p className="whitespace-pre-wrap text-sm">{card.descricao_necessidade || "-"}</p>
          </SecaoParteA>

          <SecaoParteA numero={4} titulo="Situação Atual">
            <p className="whitespace-pre-wrap text-sm">{card.problema_atual || "-"}</p>
          </SecaoParteA>

          <SecaoParteA numero={5} titulo="Situação Desejada">
            <p className="whitespace-pre-wrap text-sm">{card.situacao_desejada || "-"}</p>
          </SecaoParteA>

          <SecaoParteA numero={6} titulo="Justificativa">
            <p className="whitespace-pre-wrap text-sm">{card.justificativa || "-"}</p>
          </SecaoParteA>

          <SecaoParteA numero={7} titulo="Benefícios Esperados">
            <ListaOpcoes valores={card.beneficios_esperados_lista} opcoes={BENEFICIOS_ESPERADOS_OPCOES} />
          </SecaoParteA>

          <SecaoParteA numero={8} titulo="Impacto">
            <div className="grid gap-2 sm:grid-cols-2">
              <LabelValor label="Escopo" valor={IMPACTO_TIPO_OPCOES.find((o) => o.value === card.impacto_tipo)?.label ?? card.impacto_tipo} />
              {card.areas_impactadas && <LabelValor label="Áreas impactadas" valor={card.areas_impactadas} />}
            </div>
          </SecaoParteA>

          <SecaoParteA numero={9} titulo="Grau de Urgência">
            <div className="grid gap-2 sm:grid-cols-2">
              <LabelValor label="Grau" valor={card.grau_urgencia ? GRAU_URGENCIA_LABEL[card.grau_urgencia] : null} />
              {card.justificativa_urgencia && <LabelValor label="Justificativa" valor={card.justificativa_urgencia} />}
            </div>
          </SecaoParteA>

          <SecaoParteA numero={10} titulo="Processo Documentado">
            <div className="grid gap-2 sm:grid-cols-2">
              <LabelValor label="Existe processo?" valor={card.existe_processo_documentado === true ? "Sim" : card.existe_processo_documentado === false ? "Não" : null} />
              {card.codigo_processo && <LabelValor label="Código" valor={card.codigo_processo} />}
            </div>
          </SecaoParteA>

          <SecaoParteA numero={11} titulo="Documentos de Apoio">
            <ListaOpcoes valores={card.tipos_documentos_apoio} opcoes={DOCUMENTOS_APOIO_OPCOES} />
          </SecaoParteA>

          {card.observacoes_abertura && (
            <SecaoParteA numero={12} titulo="Observações">
              <p className="whitespace-pre-wrap text-sm">{card.observacoes_abertura}</p>
            </SecaoParteA>
          )}
        </div>
      ) : (
        /* Cards legados - exibe campos antigos */
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Detalhes da Abertura</p>
          {card.objetivo_solicitacao && <LabelValor label="Objetivo" valor={card.objetivo_solicitacao} />}
          {card.problema_atual && <LabelValor label="Problema atual" valor={card.problema_atual} />}
          {card.justificativa && <LabelValor label="Justificativa" valor={card.justificativa} />}
          {card.beneficio_esperado && <LabelValor label="Benefício esperado" valor={card.beneficio_esperado} />}
          {card.impacto_operacional && <LabelValor label="Impacto operacional" valor={card.impacto_operacional} />}
          {card.grau_urgencia && <LabelValor label="Grau de urgência" valor={GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia} />}
        </div>
      )}

      {/* Gestão de Convidados */}
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

      {/* Ações */}
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
