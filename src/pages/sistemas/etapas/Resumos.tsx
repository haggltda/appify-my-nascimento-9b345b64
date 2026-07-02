import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  APROVACOES_TESTES_INTERNOS, BENEFICIOS_ESPERADOS_OPCOES, CLASSIFICACAO_DEMANDA_OPCOES,
  COMPLEXIDADE_LABEL, CRITERIO_TRIAGEM_LABEL, DOCUMENTOS_APOIO_OPCOES, ETAPAS,
  GRAU_URGENCIA_LABEL, IMPACTO_TIPO_OPCOES, STATUS_DESENVOLVIMENTO_LABEL,
  TIPO_COMENTARIO_BORDA, TIPO_COMENTARIO_LABEL, fmtData, nomeUsuario,
  type Anexo, type Comentario, type Convidado, type Solicitacao, type Usuario,
} from "./types";

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));

interface ResumoProps {
  card: Solicitacao;
  anexos: Anexo[];
  comentarios: Comentario[];
  usuarios: Usuario[];
  onDownloadAnexo: (path: string) => void;
}

export function temDadoResumo(
  etapaKey: string,
  card: Solicitacao,
  anexos: Anexo[],
  comentarios: Comentario[],
  convidados: Convidado[],
): boolean {
  switch (etapaKey) {
    case "triagem_inicial":
      return !!card.criterio_triagem;
    case "analise_necessidade":
      return !!card.analise_necessidade_texto || !!card.analise_necessidade_prazo || anexos.some((a) => a.campo === "analise_necessidade");
    case "levantamento_funcional":
      return !!card.levantamento_funcional_texto || !!card.levantamento_funcional_prazo || anexos.some((a) => a.campo === "levantamento_funcional");
    case "documentacao_funcional":
      return !!card.documentacao_tecnica_texto || !!card.documentacao_tecnica_prazo || anexos.some((a) => a.campo === "documentacao_tecnica");
    case "analise_tecnica":
      return !!card.analise_tecnica_texto || !!card.analise_tecnica_prazo || anexos.some((a) => a.campo === "analise_tecnica");
    case "aprovacao_priorizacao":
      return !!card.prioridade || !!card.responsavel_user_id || !!card.complexidade || anexos.some((a) => a.campo === "aprovacao_priorizacao");
    case "desenvolvimento":
      return (
        card.progresso_pct > 0 || !!card.data_fim || !!card.status_desenvolvimento ||
        comentarios.some((c) => c.tipo === "interromper_desenvolvimento" || c.tipo === "erro_documental")
      );
    case "testes_internos":
      return (
        card.testes_interno_aprov_1 || card.testes_interno_aprov_2 || card.testes_interno_aprov_3 ||
        comentarios.some((c) => c.tipo === "justificativa_retorno") ||
        anexos.some((a) => a.campo === "testes_internos")
      );
    case "homologacao_area_solicitante":
      return (
        comentarios.some((c) => c.tipo === "aprovado_ressalva" || c.tipo === "reprovado") ||
        anexos.some((a) => a.campo === "homologacao_area_solicitante")
      );
    case "treinamento":
      return (
        !!card.treinamento_data ||
        anexos.some((a) => a.campo === "treinamento") ||
        comentarios.some((c) => c.tipo === "faltou_funcoes" || c.tipo === "encontrado_bug")
      );
    case "implantacao":
      return (
        !!card.implantacao_status ||
        comentarios.some((c) => c.tipo === "implantacao_comentario") ||
        anexos.some((a) => a.campo === "implantacao")
      );
    case "acompanhamento_assistido":
      return anexos.some((a) => a.campo === "acompanhamento");
    default:
      return false;
  }
}

function LvItem({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-xs whitespace-pre-wrap">{valor || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function listLabels(valores: string[] | null | undefined, opcoes: { value: string; label: string }[]): string {
  if (!valores || valores.length === 0) return "—";
  return valores.map((v) => opcoes.find((o) => o.value === v)?.label ?? v).join(", ");
}

function Bloco({ etapaKey, children }: { etapaKey: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3 opacity-90">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {ETAPA_LABEL[etapaKey]} <span className="font-normal">— concluído</span>
      </p>
      {children}
    </div>
  );
}

export function ListaAnexos({ anexos, campo, onDownloadAnexo }: { anexos: Anexo[]; campo: string; onDownloadAnexo: (path: string) => void }) {
  const lista = anexos.filter((a) => a.campo === campo);
  if (lista.length === 0) return null;
  return (
    <div className="space-y-1">
      {lista.map((a) => (
        <div key={a.id} className="flex justify-between rounded border border-border px-2 py-1 text-[11px] leading-4">
          <span className="break-all">{a.nome_arquivo}</span>
          <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline shrink-0 ml-2">abrir</button>
        </div>
      ))}
    </div>
  );
}

export function ComentariosTipados({ comentarios, tipos, usuarios }: { comentarios: Comentario[]; tipos: string[]; usuarios: Usuario[] }) {
  const lista = comentarios.filter((c) => c.tipo && tipos.includes(c.tipo));
  if (lista.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {lista.map((c) => (
        <div key={c.id} className={cn("rounded border-l-2 bg-muted/30 px-2 py-1.5 text-[11px]", TIPO_COMENTARIO_BORDA[c.tipo!])}>
          <p className="font-medium">{TIPO_COMENTARIO_LABEL[c.tipo!] ?? c.tipo}</p>
          <p className="text-muted-foreground">
            {nomeUsuario(usuarios, c.autor_id) ?? "Usuário"} — {new Date(c.created_at).toLocaleString("pt-BR")}
          </p>
          <p className="mt-0.5">{c.texto}</p>
        </div>
      ))}
    </div>
  );
}

function CampoTexto({ titulo, texto, prazo }: { titulo: string; texto: string | null; prazo: string | null }) {
  if (!texto && !prazo) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium">{titulo}</p>
      {texto && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{texto}</p>}
      {prazo && <p className="text-[11px] text-muted-foreground">Prazo: {fmtData(prazo)}</p>}
    </div>
  );
}

function ResumoSolicitacaoDemanda({ card }: ResumoProps) {
  const temParteA = !!(card.area_solicitante || card.responsavel_solicitacao || (card.classificacao_demanda && card.classificacao_demanda.length > 0) || card.descricao_necessidade);
  return (
    <Bloco etapaKey="solicitacao_demanda">
      {!temParteA ? (
        <div className="space-y-2">
          {card.objetivo_solicitacao && <LvItem label="Objetivo" valor={card.objetivo_solicitacao} />}
          {card.problema_atual && <LvItem label="Problema atual" valor={card.problema_atual} />}
          {card.justificativa && <LvItem label="Justificativa" valor={card.justificativa} />}
          {card.beneficio_esperado && <LvItem label="Benefício esperado" valor={card.beneficio_esperado} />}
          {card.impacto_operacional && <LvItem label="Impacto operacional" valor={card.impacto_operacional} />}
          {card.grau_urgencia && <LvItem label="Grau de urgência" valor={GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia} />}
        </div>
      ) : (
        <div className="space-y-2">
          {card.area_solicitante && <LvItem label="Área Solicitante" valor={card.area_solicitante} />}
          {card.responsavel_solicitacao && <LvItem label="Responsável" valor={card.responsavel_solicitacao} />}
          {card.cargo_solicitante && <LvItem label="Cargo" valor={card.cargo_solicitante} />}
          {card.email_solicitante && <LvItem label="E-mail" valor={card.email_solicitante} />}
          {card.telefone_solicitante && <LvItem label="Telefone" valor={card.telefone_solicitante} />}
          {card.classificacao_demanda && card.classificacao_demanda.length > 0 && (
            <LvItem label="Classificação da Demanda" valor={listLabels(card.classificacao_demanda, CLASSIFICACAO_DEMANDA_OPCOES)} />
          )}
          {card.descricao_necessidade && <LvItem label="Descrição da Necessidade" valor={card.descricao_necessidade} />}
          {card.problema_atual && <LvItem label="Situação Atual" valor={card.problema_atual} />}
          {card.situacao_desejada && <LvItem label="Situação Desejada" valor={card.situacao_desejada} />}
          {card.justificativa && <LvItem label="Justificativa" valor={card.justificativa} />}
          {card.beneficios_esperados_lista && card.beneficios_esperados_lista.length > 0 && (
            <LvItem label="Benefícios Esperados" valor={listLabels(card.beneficios_esperados_lista, BENEFICIOS_ESPERADOS_OPCOES)} />
          )}
          {card.impacto_tipo && (
            <LvItem label="Impacto" valor={IMPACTO_TIPO_OPCOES.find((o) => o.value === card.impacto_tipo)?.label ?? card.impacto_tipo} />
          )}
          {card.areas_impactadas && <LvItem label="Áreas Impactadas" valor={card.areas_impactadas} />}
          {card.grau_urgencia && <LvItem label="Grau de Urgência" valor={GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia} />}
          {card.justificativa_urgencia && <LvItem label="Justificativa da Urgência" valor={card.justificativa_urgencia} />}
          {card.existe_processo_documentado != null && (
            <LvItem label="Processo Documentado" valor={card.existe_processo_documentado ? "Sim" : "Não"} />
          )}
          {card.codigo_processo && <LvItem label="Código do Processo" valor={card.codigo_processo} />}
          {card.tipos_documentos_apoio && card.tipos_documentos_apoio.length > 0 && (
            <LvItem label="Documentos de Apoio" valor={listLabels(card.tipos_documentos_apoio, DOCUMENTOS_APOIO_OPCOES)} />
          )}
          {card.observacoes_abertura && <LvItem label="Observações" valor={card.observacoes_abertura} />}
        </div>
      )}
    </Bloco>
  );
}

function ResumoTriagemInicial({ card }: ResumoProps) {
  return (
    <Bloco etapaKey="triagem_inicial">
      <p className="text-xs">
        <span className="font-medium">Critério:</span>{" "}
        {card.criterio_triagem ? CRITERIO_TRIAGEM_LABEL[card.criterio_triagem] ?? card.criterio_triagem : "—"}
      </p>
    </Bloco>
  );
}

function ResumoAnaliseNecessidade({ card, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="analise_necessidade">
      <CampoTexto titulo="Análise da Necessidade" texto={card.analise_necessidade_texto} prazo={card.analise_necessidade_prazo} />
      <ListaAnexos anexos={anexos} campo="analise_necessidade" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoLevantamentoFuncional({ card, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="levantamento_funcional">
      <CampoTexto titulo="Levantamento Funcional" texto={card.levantamento_funcional_texto} prazo={card.levantamento_funcional_prazo} />
      <ListaAnexos anexos={anexos} campo="levantamento_funcional" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoDocumentacaoFuncional({ card, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="documentacao_funcional">
      <CampoTexto titulo="Documentação Funcional" texto={card.documentacao_tecnica_texto} prazo={card.documentacao_tecnica_prazo} />
      <ListaAnexos anexos={anexos} campo="documentacao_tecnica" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoAnaliseTecnica({ card, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="analise_tecnica">
      <CampoTexto titulo="Análise Técnica" texto={card.analise_tecnica_texto} prazo={card.analise_tecnica_prazo} />
      <ListaAnexos anexos={anexos} campo="analise_tecnica" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoAprovacaoPriorizacao({ card, usuarios, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="aprovacao_priorizacao">
      {card.prioridade != null && <p className="text-xs"><span className="font-medium">Prioridade:</span> {card.prioridade}</p>}
      <p className="text-xs">
        <span className="font-medium">Responsável:</span>{" "}
        {nomeUsuario(usuarios, card.responsavel_user_id) ?? "—"}
      </p>
      <p className="text-xs">
        <span className="font-medium">Complexidade:</span>{" "}
        {card.complexidade ? COMPLEXIDADE_LABEL[card.complexidade] ?? card.complexidade : "—"}
      </p>
      <ListaAnexos anexos={anexos} campo="aprovacao_priorizacao" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoDesenvolvimento({ card, comentarios, usuarios }: ResumoProps) {
  return (
    <Bloco etapaKey="desenvolvimento">
      <Progress value={card.progresso_pct} className="h-2" />
      <p className="text-[11px] text-muted-foreground">{card.progresso_pct}% concluído</p>
      {card.data_fim && <p className="text-[11px] text-muted-foreground">Prazo: {fmtData(card.data_fim)}</p>}
      {card.status_desenvolvimento && (
        <p className="text-xs">
          <span className="font-medium">Status de Desenvolvimento:</span>{" "}
          {STATUS_DESENVOLVIMENTO_LABEL[card.status_desenvolvimento] ?? card.status_desenvolvimento}
        </p>
      )}
      <ComentariosTipados comentarios={comentarios} tipos={["interromper_desenvolvimento", "erro_documental"]} usuarios={usuarios} />
    </Bloco>
  );
}

const APROVACOES = Object.entries(APROVACOES_TESTES_INTERNOS).map(([campo, nome]) => ({
  campo: campo as keyof typeof APROVACOES_TESTES_INTERNOS,
  nome,
}));

function ResumoTestesInternos({ card, comentarios, usuarios, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="testes_internos">
      <div className="space-y-1">
        {APROVACOES.map((a) => (
          <label key={a.campo} className="flex items-center gap-2 text-xs">
            <Checkbox checked={card[a.campo]} disabled />
            {a.nome}
          </label>
        ))}
      </div>
      <ComentariosTipados comentarios={comentarios} tipos={["justificativa_retorno"]} usuarios={usuarios} />
      <ListaAnexos anexos={anexos} campo="testes_internos" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoHomologacaoAreaSolicitante({ comentarios, usuarios, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="homologacao_area_solicitante">
      <ComentariosTipados comentarios={comentarios} tipos={["aprovado_ressalva", "reprovado"]} usuarios={usuarios} />
      <ListaAnexos anexos={anexos} campo="homologacao_area_solicitante" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoTreinamento({ card, anexos, comentarios, usuarios, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="treinamento">
      {card.treinamento_data && <p className="text-xs">Data do treinamento: {fmtData(card.treinamento_data)}</p>}
      <ListaAnexos anexos={anexos} campo="treinamento" onDownloadAnexo={onDownloadAnexo} />
      <ComentariosTipados comentarios={comentarios} tipos={["faltou_funcoes", "encontrado_bug"]} usuarios={usuarios} />
    </Bloco>
  );
}

const IMPLANTACAO_LABEL: Record<string, string> = { sim: "Sim", nao: "Não", em_implantacao: "Em Implantação" };

function ResumoImplantacao({ card, comentarios, usuarios, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="implantacao">
      <p className="text-xs">
        <span className="font-medium">Implantado corretamente:</span>{" "}
        {card.implantacao_status ? IMPLANTACAO_LABEL[card.implantacao_status] ?? card.implantacao_status : "—"}
      </p>
      <ComentariosTipados comentarios={comentarios} tipos={["implantacao_comentario"]} usuarios={usuarios} />
      <ListaAnexos anexos={anexos} campo="implantacao" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoAcompanhamentoAssistido({ anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="acompanhamento_assistido">
      <ListaAnexos anexos={anexos} campo="acompanhamento" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

export const RESUMOS: Record<string, (props: ResumoProps) => JSX.Element> = {
  solicitacao_demanda: ResumoSolicitacaoDemanda,
  triagem_inicial: ResumoTriagemInicial,
  analise_necessidade: ResumoAnaliseNecessidade,
  levantamento_funcional: ResumoLevantamentoFuncional,
  documentacao_funcional: ResumoDocumentacaoFuncional,
  analise_tecnica: ResumoAnaliseTecnica,
  aprovacao_priorizacao: ResumoAprovacaoPriorizacao,
  desenvolvimento: ResumoDesenvolvimento,
  testes_internos: ResumoTestesInternos,
  homologacao_area_solicitante: ResumoHomologacaoAreaSolicitante,
  treinamento: ResumoTreinamento,
  implantacao: ResumoImplantacao,
  acompanhamento_assistido: ResumoAcompanhamentoAssistido,
};
