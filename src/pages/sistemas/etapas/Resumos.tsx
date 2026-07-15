import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  APROVACOES_TESTES_INTERNOS, BENEFICIOS_ESPERADOS_OPCOES, CLASSIFICACAO_DEMANDA_OPCOES,
  COMPLEXIDADE_LABEL, CRITERIO_TRIAGEM_LABEL, DOCUMENTOS_APOIO_OPCOES, ETAPAS,
  GRAU_URGENCIA_LABEL, IMPACTO_TIPO_OPCOES, STATUS_DESENVOLVIMENTO_LABEL,
  TIPO_COMENTARIO_BORDA, TIPO_COMENTARIO_LABEL, TRIAGEM_CLASSIFICACAO_LABEL, TRIAGEM_DECISAO_LABEL,
  fmtData, nomeUsuario, sdNumero, TIPO_SOLICITACAO_LABEL,
  type Anexo, type Comentario, type Convidado, type PtvDados, type Solicitacao, type Usuario,
} from "./types";
import { calcPrioridade, calcComplexidade, calcPrazo } from "./AnaliseTecnicaPanel";
import { DfdDocumento } from "./DfdDocumento";

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

// ── helpers exclusivos do AnexoIFSDCompleto ──────────────────────────────────

function FsdChk({ checked, label }: { checked: boolean; label: string }) {
  // Usa ☑/☐ Unicode: são texto puro, sem CSS background/border separado,
  // então html2canvas não tem offset entre fundo e conteúdo.
  return (
    <span style={{ display: "inline-block", fontSize: "11px", whiteSpace: "nowrap", verticalAlign: "top" }}>
      <span style={{
        display: "inline-block",
        fontSize: "13px",
        lineHeight: "1",
        color: checked ? "#153169" : "#9ca3af",
        marginRight: "3px",
        verticalAlign: "middle",
      }}>
        {checked ? "☑" : "☐"}
      </span>
      <span style={{ verticalAlign: "middle" }}>{label}</span>
    </span>
  );
}

function FsdCaixa({ valor }: { valor: string | null | undefined }) {
  return (
    <div className="min-h-[36px] whitespace-pre-wrap rounded border border-border px-2 py-1.5 text-[11px]">
      {valor || <span className="italic text-muted-foreground/50">—</span>}
    </div>
  );
}

function FsdSecao({ num, title }: { num: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "2px", marginBottom: "6px" }}>
      {/* position:absolute no número — evita desalinhamento de fundo vs texto no html2canvas */}
      <span style={{
        position: "relative",
        display: "inline-block",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#153169",
        flexShrink: 0,
      }}>
        <span style={{
          position: "absolute",
          top: "2px",
          left: "0",
          right: "0",
          textAlign: "center",
          color: "white",
          fontSize: "8px",
          fontWeight: "bold",
          lineHeight: "1",
        }}>
          {num}
        </span>
      </span>
      <p style={{ margin: 0, fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#153169", lineHeight: "16px" }}>{title}</p>
    </div>
  );
}

// ── componente principal ─────────────────────────────────────────────────────

export function AnexoIFSDCompleto({
  card,
  anexos,
}: {
  card: Solicitacao;
  anexos: Anexo[];
  usuarios: Usuario[];
}) {
  const classifDemanda = card.classificacao_demanda ?? [];
  const beneficios = card.beneficios_esperados_lista ?? [];
  const docsApoio = card.tipos_documentos_apoio ?? [];
  const anexosGerais = anexos.filter((a) => !a.campo);

  return (
    <div className="space-y-0 text-[11px]">
      {/* ── PARTE A ── */}
      <div className="mb-3 bg-[#153169] px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-white">
        PARTE A – SOLICITANTE
      </div>

      <div className="space-y-4 px-1">
        {/* 1. Identificação */}
        <div>
          <FsdSecao num={1} title="Identificação da Demanda" />
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="w-[28%] border border-border px-2 py-1.5 font-semibold">Data da Solicitação:</td>
                <td className="w-[22%] border border-border px-2 py-1.5">{fmtData(card.created_at?.slice(0, 10)) ?? "—"}</td>
                <td className="w-[22%] border border-border px-2 py-1.5 font-semibold">Área Solicitante:</td>
                <td className="w-[28%] border border-border px-2 py-1.5">{card.area_solicitante ?? "—"}</td>
              </tr>
              <tr>
                <td className="border border-border px-2 py-1.5 font-semibold">Responsável pela Solicitação:</td>
                <td className="border border-border px-2 py-1.5">{card.responsavel_solicitacao ?? "—"}</td>
                <td className="border border-border px-2 py-1.5 font-semibold">Cargo:</td>
                <td className="border border-border px-2 py-1.5">{card.cargo_solicitante ?? "—"}</td>
              </tr>
              <tr>
                <td className="border border-border px-2 py-1.5 font-semibold">E-mail:</td>
                <td className="border border-border px-2 py-1.5">{card.email_solicitante ?? "—"}</td>
                <td className="border border-border px-2 py-1.5 font-semibold">Telefone:</td>
                <td className="border border-border px-2 py-1.5">{card.telefone_solicitante ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. Classificação da Demanda — largura total, 3 colunas */}
        <div>
          <FsdSecao num={2} title="Classificação da Demanda" />
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 rounded border border-border px-3 py-2.5">
            {CLASSIFICACAO_DEMANDA_OPCOES.map((op) => (
              <FsdChk key={op.value} checked={classifDemanda.includes(op.value)} label={op.label} />
            ))}
          </div>
        </div>

        {/* 3–4 lado a lado */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FsdSecao num={3} title="Descrição da Necessidade" />
            <FsdCaixa valor={card.descricao_necessidade} />
          </div>
          <div>
            <FsdSecao num={4} title="Situação Atual" />
            <FsdCaixa valor={card.problema_atual} />
          </div>
        </div>

        {/* 5–6 lado a lado */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FsdSecao num={5} title="Situação Desejada" />
            <FsdCaixa valor={card.situacao_desejada} />
          </div>
          <div>
            <FsdSecao num={6} title="Justificativa" />
            <FsdCaixa valor={card.justificativa} />
          </div>
        </div>

        {/* 7. Benefícios Esperados — largura total, 3 colunas (evita quebra de texto) */}
        <div>
          <FsdSecao num={7} title="Benefícios Esperados" />
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 rounded border border-border px-3 py-2.5">
            {BENEFICIOS_ESPERADOS_OPCOES.map((op) => (
              <FsdChk key={op.value} checked={beneficios.includes(op.value)} label={op.label} />
            ))}
          </div>
        </div>

        {/* 8. Impacto da Demanda — largura total */}
        <div>
          <FsdSecao num={8} title="Impacto da Demanda" />
          <div className="rounded border border-border px-3 py-2.5">
            <div className="flex gap-8">
              {IMPACTO_TIPO_OPCOES.map((op) => (
                <FsdChk key={op.value} checked={card.impacto_tipo === op.value} label={op.label} />
              ))}
            </div>
            {card.areas_impactadas && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground">Quais áreas impactadas:</p>
                <p className="mt-0.5">{card.areas_impactadas}</p>
              </div>
            )}
          </div>
        </div>

        {/* 9–10 lado a lado */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FsdSecao num={9} title="Grau de Urgência" />
            <div className="rounded border border-border px-3 py-2.5">
              <div className="flex gap-6">
                {(["baixa", "media", "alta"] as const).map((v) => (
                  <FsdChk key={v} checked={card.grau_urgencia === v} label={GRAU_URGENCIA_LABEL[v]} />
                ))}
              </div>
              {card.justificativa_urgencia && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground">Justificativa da urgência:</p>
                  <p className="mt-0.5">{card.justificativa_urgencia}</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <FsdSecao num={10} title="Processo Documentado" />
            <div className="rounded border border-border px-3 py-2.5">
              <div className="flex gap-6">
                <FsdChk checked={card.existe_processo_documentado === true} label="Sim" />
                <FsdChk checked={card.existe_processo_documentado === false} label="Não" />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Código/referência:</p>
              <p className="mt-0.5">{card.codigo_processo ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* 11. Documentos de Apoio — largura total, 3 colunas */}
        <div>
          <FsdSecao num={11} title="Documentos de Apoio" />
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 rounded border border-border px-3 py-2.5">
            {DOCUMENTOS_APOIO_OPCOES.map((op) => (
              <FsdChk key={op.value} checked={docsApoio.includes(op.value)} label={op.label} />
            ))}
          </div>
        </div>

        {/* 12. Observações — largura total */}
        <div>
          <FsdSecao num={12} title="Observações" />
          <FsdCaixa valor={card.observacoes_abertura} />
        </div>
      </div>

      {/* ── PARTE B ── */}
      <div className="mb-3 mt-5 bg-[#E67E22] px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-white">
        PARTE B – TRIAGEM INICIAL (CONTROLADORIA)
      </div>

      <div className="space-y-4 px-1">
        {/* 13–14 lado a lado */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FsdSecao num={13} title="Recebido por" />
            <FsdCaixa valor={card.triagem_recebido_por} />
          </div>
          <div>
            <FsdSecao num={14} title="Triagem Concluída em" />
            <FsdCaixa valor={card.triagem_concluida_em ? fmtData(card.triagem_concluida_em.slice(0, 10)) : null} />
          </div>
        </div>

        {/* 15. Classificação — largura total, 3 colunas */}
        <div>
          <FsdSecao num={15} title="Classificação da Demanda" />
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 rounded border border-border px-3 py-2.5">
            {Object.entries(TRIAGEM_CLASSIFICACAO_LABEL).map(([value, label]) => (
              <FsdChk key={value} checked={card.triagem_classificacao === value} label={label} />
            ))}
          </div>
        </div>

        {/* 16. Parecer — largura total */}
        <div>
          <FsdSecao num={16} title="Parecer da Controladoria" />
          <FsdCaixa valor={card.triagem_parecer} />
        </div>

        {/* 17 */}
        <div>
          <FsdSecao num={17} title="Encaminhar para" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-0.5 text-[10px] text-muted-foreground">Encaminhar para:</p>
              <FsdCaixa valor={card.triagem_encaminhamento_para} />
            </div>
            <div>
              <p className="mb-0.5 text-[10px] text-muted-foreground">Responsável:</p>
              <FsdCaixa valor={card.triagem_encaminhamento_responsavel} />
            </div>
          </div>
        </div>

        {/* 18–19 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FsdSecao num={18} title="Decisão da Triagem" />
            <FsdCaixa
              valor={card.triagem_decisao ? (TRIAGEM_DECISAO_LABEL[card.triagem_decisao] ?? card.triagem_decisao) : null}
            />
          </div>
          <div>
            <FsdSecao num={19} title="Data da Decisão" />
            <FsdCaixa valor={card.triagem_data_decisao ? fmtData(card.triagem_data_decisao.slice(0, 10)) : null} />
          </div>
        </div>

        {/* Anexos Gerais */}
        {anexosGerais.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Anexos Gerais</p>
            <div className="space-y-1">
              {anexosGerais.map((a) => (
                <div key={a.id} className="rounded border border-border px-2 py-1 text-[11px] leading-4">
                  <span className="break-all">{a.nome_arquivo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Anexo II – DFD ───────────────────────────────────────────────────────────

interface DfdAnexoProps {
  card: Solicitacao;
  anexos: Anexo[];
  usuarios: Usuario[];
}

export function AnexoIIDFDCompleto({ card }: DfdAnexoProps) {
  return <DfdDocumento dados={card.dfd_dados ?? {}} card={card} isReadOnly={true} />;
}


// ── Anexo III – PTV ──────────────────────────────────────────────────────────

interface PtvAnexoProps {
  card: Solicitacao;
  anexos: Anexo[];
  usuarios: Usuario[];
}

function PtvSecao({ titulo }: { titulo: string }) {
  return (
    <div style={{ background: "#153169", color: "#fff", padding: "3px 8px", marginBottom: 6, borderRadius: 3 }}>
      <span style={{ fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>{titulo}</span>
    </div>
  );
}

function PtvSub({ titulo }: { titulo: string }) {
  return <p style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#153169", borderBottom: "1px solid #ddd", paddingBottom: 2, marginBottom: 4 }}>{titulo}</p>;
}

function PtvLinha({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 2 }}>
      <span style={{ fontWeight: "bold", color: "#153169", whiteSpace: "nowrap" }}>{label}:</span>
      <span>{valor ?? "—"}</span>
    </div>
  );
}

function PtvAutoRow({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, borderBottom: "1px dashed #ddd", padding: "2px 4px", marginBottom: 2 }}>
      <span style={{ color: "#555" }}>{label}</span>
      <span style={{ fontWeight: "bold", color: "#153169" }}>{valor || "—"}</span>
    </div>
  );
}

function PtvChkGrupo({ opcoes, values }: { opcoes: { k: string; l: string }[]; values: string[] | undefined }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", marginBottom: 4 }}>
      {opcoes.map(({ k, l }) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 3, fontSize: 10 }}>
          <span>{(values ?? []).includes(k) ? "☑" : "☐"}</span>
          <span>{l}</span>
        </span>
      ))}
    </div>
  );
}

const PTV_DFD_PENDENCIAS = [
  { k: "escopo_funcional_insuficiente", l: "Escopo funcional insuficiente" },
  { k: "regras_negocio_insuficientes", l: "Regras de negócio insuficientes" },
  { k: "requisitos_funcionais_insuficientes", l: "Requisitos funcionais insuficientes" },
  { k: "validacoes_insuficientes", l: "Validações funcionais insuficientes" },
  { k: "perfis_permissoes_insuficientes", l: "Perfis e permissões insuficientes" },
  { k: "integracoes_insuficientes", l: "Integrações insuficientes" },
  { k: "documentos_gerados_insuficientes", l: "Documentos gerados insuficientes" },
  { k: "indicadores_insuficientes", l: "Indicadores insuficientes" },
  { k: "criterios_homologacao_insuficientes", l: "Critérios de homologação insuficientes" },
  { k: "premissas_restricoes_insuficientes", l: "Premissas ou restrições insuficientes" },
  { k: "outro", l: "Outro" },
];

const PTV_DFD_ENCAMINHAMENTO = [
  { k: "seguir_analise", l: "Seguir para análise técnica" }, { k: "seguir_ressalva", l: "Seguir com ressalva" },
  { k: "retornar_ajuste_dfd", l: "Retornar para ajuste do DFD" }, { k: "suspender_complementacao", l: "Suspender análise até complementação" },
];

const PTV_FORMA_ATENDIMENTO = [
  { k: "configuracao_funcionalidade_existente", l: "Configuração de funcionalidade existente" },
  { k: "ajuste_funcionalidade_existente", l: "Ajuste em funcionalidade existente" },
  { k: "desenvolvimento_nova_funcionalidade", l: "Desenvolvimento de nova funcionalidade" },
  { k: "desenvolvimento_novo_modulo", l: "Desenvolvimento de novo módulo" },
  { k: "criacao_relatorio", l: "Criação de relatório" }, { k: "criacao_dashboard", l: "Criação de dashboard" },
  { k: "automacao_processo", l: "Automação de processo" }, { k: "integracao_sistemas", l: "Integração entre sistemas" },
  { k: "importacao_dados", l: "Importação de dados" }, { k: "exportacao_dados", l: "Exportação de dados" },
  { k: "ajuste_permissao_acesso", l: "Ajuste de permissão/acesso" },
  { k: "solucao_temporaria_manual_controlada", l: "Solução temporária/manual controlada" }, { k: "outro", l: "Outro" },
];

const PTV_IMPEDIMENTO_TIPOS = [
  { k: "sistema_atual_nao_comporta", l: "Sistema atual não comporta a solução" },
  { k: "limitacao_seguranca", l: "Limitação de segurança" },
  { k: "ausencia_integracao", l: "Ausência de integração disponível" },
  { k: "necessidade_saneamento_dados", l: "Necessidade de saneamento de dados" },
  { k: "base_dados_inconsistente", l: "Base de dados inconsistente" },
  { k: "dependencia_fornecedor_externo", l: "Dependência de fornecedor externo" },
  { k: "necessidade_definicao_funcional_complementar", l: "Necessidade de definição funcional complementar" },
  { k: "limitacao_infraestrutura", l: "Limitação de infraestrutura" }, { k: "outro", l: "Outro" },
];

const PTV_COMPLEXIDADE_ITENS = [
  { k: "configuracao_simples", l: "Configuração simples" }, { k: "integracao_outro_sistema", l: "Integração com outro sistema" },
  { k: "ajuste_pontual", l: "Ajuste pontual" }, { k: "alteracao_banco_dados", l: "Alteração em banco de dados" },
  { k: "alteracao_funcionalidade_existente", l: "Alteração em funcionalidade existente" }, { k: "migracao_dados", l: "Migração de dados" },
  { k: "criacao_tela", l: "Criação de tela" }, { k: "saneamento_dados", l: "Saneamento de base de dados" },
  { k: "criacao_campos", l: "Criação de campos" }, { k: "acesso_externo_usuarios", l: "Acesso externo de usuários" },
  { k: "criacao_workflow", l: "Criação de workflow" }, { k: "seguranca_informacao", l: "Segurança da informação" },
  { k: "regras_automaticas", l: "Criação de regras automáticas" }, { k: "dependencia_fornecedor_tecnico", l: "Dependência de fornecedor técnico" },
  { k: "configuracao_perfil", l: "Configuração de perfil e permissões" }, { k: "novo_modulo_estruturante", l: "Novo módulo estruturante" },
  { k: "relatorio_filtros", l: "Relatório" }, { k: "multiplas_integracoes", l: "Múltiplas integrações" },
  { k: "dashboard_simples", l: "Dashboard" }, { k: "alto_volume_dados", l: "Alto volume de dados" },
  { k: "geracao_documentos", l: "Geração automática de documento" }, { k: "outro", l: "Outro" },
];

const PTV_PARECER_FINAL = [
  { k: "aprovar_continuidade", l: "Aprovar tecnicamente a continuidade da demanda" },
  { k: "aprovar_ressalvas", l: "Aprovar tecnicamente com ressalvas" },
  { k: "retornar_ajuste_dfd", l: "Retornar para ajuste do DFD" },
  { k: "retornar_complementacao_area", l: "Retornar para complementação da área solicitante" },
  { k: "dividir_fases", l: "Dividir a demanda em fases" },
  { k: "encaminhar_comite_governanca", l: "Encaminhar para avaliação do Comitê de Governança" },
  { k: "suspender_temporariamente", l: "Suspender temporariamente a demanda" },
  { k: "considerar_inviavel", l: "Considerar tecnicamente inviável no momento" },
];

export function AnexoIIIPTVCompleto({ card, anexos: _anexos, usuarios: _usuarios }: PtvAnexoProps) {
  const p: PtvDados = card.ptv_dados ?? {};
  const criterios = card.an_criterios ?? [];
  const complexItens = p.complexidade_itens ?? [];
  const prioridadeAuto = calcPrioridade(criterios);
  const prioridadeEfetiva = p.prioridade_override ?? prioridadeAuto;
  const complexidadeAuto = calcComplexidade(complexItens);
  const prazoAuto = calcPrazo(prioridadeEfetiva, complexidadeAuto);
  const resultadoCombinado = `${prioridadeEfetiva} + ${complexidadeAuto}`;

  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda.map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v).join(", ")
    : (card.tipo_solicitacao ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao) : "—");

  const pessoasLabel: Record<string, string> = { "1_5": "1 – 5 pessoas", "5_10": "5 – 10 pessoas", "mais_10": "Mais de 10 pessoas" };

  const encaminhamentoSugerido = p.tecnicamente_viavel === "nao_viavel"
    ? "Considerar tecnicamente inviável no momento"
    : p.dfd_suficiente === "nao"
    ? "Retornar para ajuste do DFD"
    : p.encaminhar_comite === "sim"
    ? "Encaminhar para avaliação do Comitê de Governança"
    : "Seguir para Anexo IV – Ata de Aprovação e Priorização";

  const simNao = (v: string | undefined) => v === "sim" ? "Sim" : v === "nao" ? "Não" : "—";
  const criCheck = (key: string) => criterios.includes(key) ? "Sim" : "Não";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#111", maxWidth: 900, margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ background: "#153169", color: "#fff", padding: "8px 12px", marginBottom: 12, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: "bold", textTransform: "uppercase" }}>ANEXO III – PARECER TÉCNICO DE VIABILIDADE (PTV)</div>
        <div style={{ fontSize: 11, fontWeight: "bold" }}>Nº {sdNumero(card)}</div>
      </div>

      {/* Seção 1 — Identificação */}
      <PtvSecao titulo="1. Identificação da Demanda — Preenchimento Automático" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <PtvLinha label="Número da demanda" valor={sdNumero(card)} />
          <PtvLinha label="Área solicitante" valor={card.area_solicitante} />
          <PtvLinha label="Responsável pela solicitação" valor={card.responsavel_solicitacao} />
          <PtvLinha label="Cargo" valor={card.cargo_solicitante} />
          <PtvLinha label="E-mail" valor={card.email_solicitante} />
          <PtvLinha label="Telefone" valor={card.telefone_solicitante} />
          <PtvLinha label="Data da solicitação" valor={card.created_at ? fmtData(card.created_at.slice(0, 10)) : null} />
          <PtvLinha label="Tipo de demanda" valor={tipoDemanda} />
        </div>
      </div>

      {/* Seção 2 — Conferência DFD */}
      <PtvSecao titulo="2. Conferência Mínima do DFD" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <PtvSub titulo="O DFD possui informações suficientes para análise técnica?" />
        <div style={{ display: "flex", gap: 16, marginBottom: 6, fontSize: 11 }}>
          {[{ k: "sim", l: "Sim" }, { k: "nao", l: "Não" }, { k: "parcialmente", l: "Parcialmente" }].map(({ k, l }) => (
            <span key={k}>{p.dfd_suficiente === k ? "●" : "○"} {l}</span>
          ))}
        </div>
        {p.dfd_pendencias && p.dfd_pendencias.length > 0 && (
          <>
            <PtvSub titulo="Pendências identificadas:" />
            <PtvChkGrupo opcoes={PTV_DFD_PENDENCIAS} values={p.dfd_pendencias} />
          </>
        )}
        <PtvSub titulo="Encaminhamento:" />
        <PtvChkGrupo opcoes={PTV_DFD_ENCAMINHAMENTO} values={p.dfd_encaminhamento} />
      </div>

      {/* Seção 3 — Viabilidade */}
      <PtvSecao titulo="3. Parecer de Viabilidade Técnica" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <PtvSub titulo="A demanda é tecnicamente viável?" />
        <div style={{ display: "flex", gap: 16, marginBottom: 6, fontSize: 11 }}>
          {[{ k: "sim", l: "Sim" }, { k: "sim_ajustes", l: "Sim, com ajustes" }, { k: "parcialmente", l: "Parcialmente viável" }, { k: "nao_viavel", l: "Não viável no momento" }].map(({ k, l }) => (
            <span key={k}>{p.tecnicamente_viavel === k ? "●" : "○"} {l}</span>
          ))}
        </div>
        <PtvSub titulo="Forma técnica de atendimento:" />
        <PtvChkGrupo opcoes={PTV_FORMA_ATENDIMENTO} values={p.forma_atendimento} />
        <PtvSub titulo="Existe impedimento técnico para continuidade?" />
        <div style={{ display: "flex", gap: 16, marginBottom: 4, fontSize: 11 }}>
          <span>{p.impedimento_tecnico === "sim" ? "●" : "○"} Sim</span>
          <span>{p.impedimento_tecnico === "nao" ? "●" : "○"} Não</span>
        </div>
        {p.impedimento_tecnico === "sim" && p.impedimento_tipos && p.impedimento_tipos.length > 0 && (
          <PtvChkGrupo opcoes={PTV_IMPEDIMENTO_TIPOS} values={p.impedimento_tipos} />
        )}
      </div>

      {/* Seção 4 — Classificação */}
      <PtvSecao titulo="4. Classificação da Demanda" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>

        <PtvSub titulo="4.1 Prioridade Institucional — Automático" />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 6 }}>
          <thead>
            <tr style={{ background: "#f0f4ff" }}>
              <th style={{ border: "1px solid #ccc", padding: "2px 4px", textAlign: "left" }}>Informação</th>
              <th style={{ border: "1px solid #ccc", padding: "2px 4px", textAlign: "left" }}>Onde buscar</th>
              <th style={{ border: "1px solid #ccc", padding: "2px 4px", textAlign: "left" }}>Valor (Automático)</th>
            </tr>
          </thead>
          <tbody>
            {([
              ["Tipo de demanda", "Card Solicitação ERP", tipoDemanda],
              ["Necessidade aprovada pelo Comitê", "Fluxo da demanda", "Sim"],
              ["Critério principal de priorização", "Card Solicitação ERP – Grau de Urgência", card.grau_urgencia ? (GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia) : "—"],
              ["Obrigatoriedade legal", "Card Análise da Necessidade", criCheck("obrigatoriedade_legal_prazo")],
              ["Continuidade da operação", "Card Análise da Necessidade", criCheck("risco_paralisacao")],
              ["Correção de Bug", "Card Solicitação ERP", criCheck("correcao_bug_escopo")],
              ["Demanda estratégica", "Card Análise da Necessidade", criCheck("impacto_cliente_contrato")],
              ["Ganho operacional", "Card Análise da Necessidade", criCheck("ganho_operacional_relevante")],
              ["Melhorias evolutivas", "Card Análise da Necessidade", criCheck("melhoria_evolutiva_sem_critico")],
              ["Impacto Financeiro", "Card Análise da Necessidade", criCheck("risco_juridico_trabalhista")],
              ["Impacto Operacional", "Card Análise da Necessidade", criCheck("alto_impacto_operacional")],
              ["Número de usuários impactados", "Card Análise da Necessidade", card.an_pessoas_impactadas ? (pessoasLabel[card.an_pessoas_impactadas] ?? card.an_pessoas_impactadas) : "—"],
              ["Riscos envolvidos", "Card Análise da Necessidade", criCheck("risco_juridico_trabalhista")],
              ["Urgência Institucional", "Card Solicitação ERP", card.grau_urgencia ? (GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia) : "—"],
              ["Alinhamento estratégico", "Regra do processo", "Sim"],
            ] as [string, string, string][]).map(([info, fonte, valor]) => (
              <tr key={info}>
                <td style={{ border: "1px solid #ccc", padding: "2px 4px", fontWeight: "bold" }}>{info}</td>
                <td style={{ border: "1px solid #ccc", padding: "2px 4px", color: "#555" }}>{fonte}</td>
                <td style={{ border: "1px solid #ccc", padding: "2px 4px", fontWeight: "bold", color: "#153169" }}>{valor}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <PtvSub titulo="4.3 Resultado Automático da Prioridade Institucional" />
        <PtvAutoRow label="Prioridade institucional sugerida" valor={prioridadeAuto} />
        {p.prioridade_override && <PtvAutoRow label="Prioridade alterada manualmente" valor={p.prioridade_override} />}
        {p.prioridade_justificativa && <PtvLinha label="Justificativa da alteração" valor={p.prioridade_justificativa} />}
        <PtvAutoRow label="Prioridade institucional efetiva" valor={prioridadeEfetiva} />

        <div style={{ marginTop: 8 }}>
          <PtvSub titulo="4.4 Complexidade Técnica — Itens marcados pela TI" />
          <PtvChkGrupo opcoes={PTV_COMPLEXIDADE_ITENS} values={p.complexidade_itens} />
        </div>

        <PtvSub titulo="4.6 Resultado Automático da Complexidade Técnica" />
        <PtvAutoRow label="Complexidade técnica sugerida" valor={complexidadeAuto} />

        <div style={{ marginTop: 8 }}>
          <PtvSub titulo="4.7–4.10 Cruzamento, Prazo e Registro Automático" />
          <PtvAutoRow label="Prioridade institucional" valor={prioridadeEfetiva} />
          <PtvAutoRow label="Complexidade técnica" valor={complexidadeAuto} />
          <PtvAutoRow label="Resultado combinado" valor={resultadoCombinado} />
          <PtvAutoRow label="Prazo técnico estimado" valor={prazoAuto} />
          <PtvAutoRow label="Encaminhamento sugerido" valor={encaminhamentoSugerido} />
        </div>
      </div>

      {/* Seção 5 — Dependências */}
      <PtvSecao titulo="5. Dependências, Riscos e Condições" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <PtvSub titulo="5.1 A demanda possui dependências técnicas?" />
            <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 4 }}>
              <span>{p.tem_dependencias === "sim" ? "●" : "○"} Sim</span>
              <span>{p.tem_dependencias === "nao" ? "●" : "○"} Não</span>
            </div>
            {p.tem_dependencias === "sim" && p.dependencia_tipos && p.dependencia_tipos.length > 0 && (
              <PtvChkGrupo opcoes={[
                { k: "fornecedor_externo", l: "Fornecedor externo" }, { k: "integracao", l: "Integração" },
                { k: "banco_dados", l: "Banco de dados" }, { k: "infraestrutura", l: "Infraestrutura" },
                { k: "seguranca_informacao", l: "Segurança da informação" }, { k: "saneamento_dados", l: "Saneamento de dados" },
                { k: "definicao_funcional_complementar", l: "Definição funcional complementar" },
                { k: "aprovacao_superior", l: "Aprovação superior" }, { k: "outro", l: "Outro" },
              ]} values={p.dependencia_tipos} />
            )}
          </div>
          <div>
            <PtvSub titulo="5.2 A demanda apresenta risco técnico relevante?" />
            <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 4 }}>
              <span>{p.tem_risco_tecnico === "sim" ? "●" : "○"} Sim</span>
              <span>{p.tem_risco_tecnico === "nao" ? "●" : "○"} Não</span>
            </div>
            {p.tem_risco_tecnico === "sim" && p.risco_tipos && p.risco_tipos.length > 0 && (
              <PtvChkGrupo opcoes={[
                { k: "risco_atraso", l: "Risco de atraso" }, { k: "risco_falha_integracao", l: "Risco de falha de integração" },
                { k: "risco_inconsistencia_dados", l: "Risco de inconsistência de dados" },
                { k: "risco_seguranca_informacao", l: "Risco de segurança da informação" },
                { k: "risco_impacto_sistema_existente", l: "Risco de impacto em sistema existente" },
                { k: "risco_indisponibilidade", l: "Risco de indisponibilidade" },
                { k: "risco_dependencia_fornecedor", l: "Risco de dependência de fornecedor" }, { k: "outro", l: "Outro" },
              ]} values={p.risco_tipos} />
            )}
          </div>
          <div>
            <PtvSub titulo="5.3 A demanda deverá ser dividida em fases?" />
            <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 4 }}>
              <span>{p.dividir_fases === "sim" ? "●" : "○"} Sim</span>
              <span>{p.dividir_fases === "nao" ? "●" : "○"} Não</span>
            </div>
            {p.dividir_fases === "sim" && (
              <>
                <PtvLinha label="Fase 1 — Entrega mínima" valor={p.fase1_entrega} />
                <PtvLinha label="Fase 2 — Complementação futura" valor={p.fase2_complementacao} />
              </>
            )}
          </div>
          <div>
            <PtvSub titulo="5.4 Necessita encaminhamento ao Comitê de Governança?" />
            <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 4 }}>
              <span>{p.encaminhar_comite === "sim" ? "●" : "○"} Sim</span>
              <span>{p.encaminhar_comite === "nao" ? "●" : "○"} Não</span>
            </div>
            {p.encaminhar_comite === "sim" && p.comite_motivos && p.comite_motivos.length > 0 && (
              <PtvChkGrupo opcoes={[
                { k: "impacto_estrategico", l: "Impacto estratégico" }, { k: "impacto_financeiro_relevante", l: "Impacto financeiro relevante" },
                { k: "impacto_operacional_relevante", l: "Impacto operacional relevante" }, { k: "impacto_mais_diretoria", l: "Impacto em mais de uma diretoria" },
                { k: "risco_juridico_trabalhista_contratual", l: "Risco jurídico/trabalhista/contratual" },
                { k: "necessidade_investimento_fornecedor_externo", l: "Necessidade de investimento ou fornecedor externo" },
                { k: "desenvolvimento_alta_complexidade", l: "Desenvolvimento de alta complexidade" },
                { k: "integracao_critica", l: "Integração crítica" }, { k: "excecao_regras_fluxos", l: "Exceção às regras ou fluxos definidos" },
                { k: "outro", l: "Outro" },
              ]} values={p.comite_motivos} />
            )}
            {p.observacao_5 && <PtvLinha label="Observação" valor={p.observacao_5} />}
          </div>
        </div>
      </div>

      {/* Seção 6 — Parecer técnico final */}
      <PtvSecao titulo="6. Parecer Técnico Final" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <PtvSub titulo="Após análise técnica, a TI recomenda:" />
        <PtvChkGrupo opcoes={PTV_PARECER_FINAL} values={p.parecer_final} />
        {p.observacoes_justificativas && (
          <PtvLinha label="Observações / Justificativas" valor={p.observacoes_justificativas} />
        )}
        <div style={{ borderTop: "1px solid #ddd", marginTop: 12, paddingTop: 8 }}>
          <p style={{ fontSize: 10, fontWeight: "bold" }}>ASSINATURAS — TECNOLOGIA DA INFORMAÇÃO</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
            <div style={{ borderBottom: "1px solid #999", paddingBottom: 2, fontSize: 10 }}>Responsável pela análise técnica: _______________</div>
            <div style={{ borderBottom: "1px solid #999", paddingBottom: 2, fontSize: 10 }}>Assinatura: _______________</div>
            <div style={{ borderBottom: "1px solid #999", paddingBottom: 2, fontSize: 10 }}>Data: _____ / _____ / _______</div>
          </div>
        </div>
        <p style={{ fontSize: 9, color: "#888", marginTop: 8, borderTop: "1px solid #eee", paddingTop: 4 }}>
          Este documento é preenchido pela TI. As informações dos blocos identificados como AUTOMÁTICOS são calculadas pelo sistema e não podem ser alteradas manualmente. Versão: 1.0 | Data: {fmtData(new Date().toISOString().slice(0, 10))}
        </p>
      </div>
    </div>
  );
}
