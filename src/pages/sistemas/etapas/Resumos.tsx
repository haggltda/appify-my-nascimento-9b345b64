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
  type Anexo, type Comentario, type Convidado, type DfdDados, type DfdEtapa, type Solicitacao, type Usuario,
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

function DfdChk({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, fontSize: 11 }}>
      <span style={{ fontSize: 11 }}>{checked ? "☑" : "☐"}</span>
      <span>{label}</span>
    </span>
  );
}

function DfdSecao({ titulo }: { titulo: string }) {
  return (
    <div style={{ background: "#153169", color: "#fff", padding: "3px 8px", marginBottom: 6, borderRadius: 3 }}>
      <span style={{ fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>{titulo}</span>
    </div>
  );
}

function DfdSubsecao({ titulo }: { titulo: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#153169", borderBottom: "1px solid #ddd", paddingBottom: 2, marginBottom: 4 }}>
      {titulo}
    </p>
  );
}

function DfdLinha({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 2 }}>
      <span style={{ fontWeight: "bold", color: "#153169", whiteSpace: "nowrap" }}>{label}:</span>
      <span>{valor ?? "—"}</span>
    </div>
  );
}

function DfdChkGrupo({ opcoes, values }: { opcoes: { k: string; l: string }[]; values: string[] | undefined }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 4 }}>
      {opcoes.map(({ k, l }) => (
        <DfdChk key={k} checked={(values ?? []).includes(k)} label={l} />
      ))}
    </div>
  );
}

function DfdTabela({ colunas, linhas }: { colunas: string[]; linhas: (string | boolean | null | undefined)[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 6 }}>
      <thead>
        <tr style={{ background: "#f0f4ff" }}>
          {colunas.map((c) => (
            <th key={c} style={{ border: "1px solid #ccc", padding: "2px 4px", textAlign: "left", fontWeight: "bold" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i}>
            {linha.map((cel, j) => (
              <td key={j} style={{ border: "1px solid #ccc", padding: "2px 4px" }}>
                {typeof cel === "boolean" ? (cel ? "Sim" : "Não") : (cel ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DFD_TIPO_SOLUCAO = [
  { k: "novo_modulo", l: "Novo módulo" }, { k: "nova_funcionalidade", l: "Nova funcionalidade" },
  { k: "correcao_falha", l: "Correção de falha — Bug" }, { k: "solicitacao_melhoria", l: "Solicitação de Melhoria" },
  { k: "automacao", l: "Automação" }, { k: "integracao", l: "Integração" },
  { k: "relatorio", l: "Relatório" }, { k: "dashboard", l: "Dashboard" },
  { k: "alteracao_regra_negocio", l: "Alteração de regra de negócio" },
  { k: "alteracao_processo", l: "Alteração de processo existente" }, { k: "outro", l: "Outro" },
];
const DFD_MODULOS = [
  { k: "recrutamento_selecao", l: "Recrutamento e Seleção" }, { k: "admissao", l: "Admissão" },
  { k: "rh", l: "RH" }, { k: "financeiro", l: "Financeiro" }, { k: "compras_supply", l: "Compras / Supply" },
  { k: "licitacoes", l: "Licitações" }, { k: "operacional", l: "Operacional" },
  { k: "contratos", l: "Contratos" }, { k: "juridico", l: "Jurídico" }, { k: "sst", l: "SST" },
  { k: "treinamentos", l: "Treinamentos" }, { k: "crm", l: "CRM" }, { k: "outro", l: "Outro" },
];
const DFD_CONTEMPLAR = [
  { k: "criar_cadastro", l: "Criar cadastro novo" }, { k: "alterar_cadastro", l: "Alterar cadastro existente" },
  { k: "consultar_informacoes", l: "Consultar informações" }, { k: "controlar_andamento", l: "Controlar andamento" },
  { k: "controlar_status", l: "Controlar status" }, { k: "controlar_aprovacoes", l: "Controlar aprovações" },
  { k: "controlar_reprovacoes", l: "Controlar reprovações" }, { k: "permitir_cancelamento", l: "Permitir cancelamento" },
  { k: "permitir_devolucao", l: "Permitir devolução" }, { k: "permitir_anexar", l: "Permitir anexar docs" },
  { k: "gerar_documento", l: "Gerar documento" }, { k: "gerar_relatorio", l: "Gerar relatório" },
  { k: "gerar_dashboard", l: "Gerar dashboard" }, { k: "enviar_notificacoes", l: "Enviar notificações" },
  { k: "controlar_prazos", l: "Controlar prazos" }, { k: "controlar_responsaveis", l: "Controlar responsáveis" },
  { k: "registrar_historico", l: "Registrar histórico" }, { k: "bloquear_avanco_pendencia", l: "Bloquear avanço" },
  { k: "integrar_outro_sistema", l: "Integrar" }, { k: "importar_dados", l: "Importar dados" },
  { k: "exportar_dados", l: "Exportar dados" }, { k: "permitir_acesso_externos", l: "Acesso externo" }, { k: "outro", l: "Outro" },
];
const DFD_ESCOPO_NEGATIVO = [
  { k: "nao_integracao", l: "Não contempla integração" }, { k: "nao_dashboard", l: "Não contempla dashboard" },
  { k: "nao_relatorio_gerencial", l: "Não contempla relatório gerencial" }, { k: "nao_app_mobile", l: "Não contempla app mobile" },
  { k: "nao_assinatura_digital", l: "Não contempla assinatura digital" }, { k: "nao_envio_whatsapp", l: "Não contempla WhatsApp" },
  { k: "nao_envio_email", l: "Não contempla e-mail automático" }, { k: "nao_acesso_externo", l: "Não contempla acesso externo" },
  { k: "nao_migracao_dados", l: "Não contempla migração de dados" }, { k: "nao_automacao_total", l: "Não contempla automação total" },
  { k: "outro", l: "Outro" },
];
const DFD_MATRIZ_COLS = [
  { k: "registrar", l: "Registrar" }, { k: "validar", l: "Validar" }, { k: "aprovar", l: "Aprovar" },
  { k: "notificar", l: "Notificar" }, { k: "gerar_doc", l: "Gerar doc." }, { k: "integrar", l: "Integrar" }, { k: "encerrar", l: "Encerrar" },
];

export function AnexoIIDFDCompleto({ card, anexos: _anexos, usuarios: _usuarios }: DfdAnexoProps) {
  const d: DfdDados = card.dfd_dados ?? {};
  const etapas: DfdEtapa[] = d.etapas ?? [];
  const tipoDemanda = card.classificacao_demanda?.length
    ? card.classificacao_demanda.map((v) => CLASSIFICACAO_DEMANDA_OPCOES.find((o) => o.value === v)?.label ?? v).join(", ")
    : (card.tipo_solicitacao ? (TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao) : null);
  const etapaLabel = (codigo: string | undefined) => {
    const e = etapas.find((x) => x.codigo === codigo);
    return e ? `${e.codigo} – ${e.descricao}` : (codigo ?? "—");
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#111", maxWidth: 900, margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ background: "#153169", color: "#fff", padding: "8px 12px", marginBottom: 12, borderRadius: 4 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", textTransform: "uppercase" }}>
          ANEXO II – DOCUMENTO FUNCIONAL DA DEMANDA (DFD)
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
        <DfdLinha label="Número da Demanda" valor={sdNumero(card)} />
        <DfdLinha label="Área Solicitante" valor={card.area_solicitante} />
        <DfdLinha label="Responsável" valor={card.responsavel_solicitacao} />
        <DfdLinha label="Usuário-chave" valor={d.usuario_chave} />
        <DfdLinha label="Tipo da Demanda" valor={tipoDemanda} />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: "bold", color: "#153169", fontSize: 11 }}>Objetivo: </span>
        <span style={{ fontSize: 11 }}>{d.objetivo ?? "—"}</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: "bold", color: "#153169", fontSize: 11 }}>Justificativa: </span>
        <span style={{ fontSize: 11 }}>{d.justificativa ?? "—"}</span>
      </div>

      {/* Seção 1 */}
      <DfdSecao titulo="1. Escopo Funcional da Solução" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdSubsecao titulo="1.1 Tipo de solução" />
        <DfdChkGrupo opcoes={DFD_TIPO_SOLUCAO} values={d.tipo_solucao} />
        <DfdSubsecao titulo="1.2 Módulos impactados" />
        <DfdChkGrupo opcoes={DFD_MODULOS} values={d.modulos_impactados} />
        <DfdSubsecao titulo="1.3 A solução deverá contemplar" />
        <DfdChkGrupo opcoes={DFD_CONTEMPLAR} values={d.contemplar} />
        <DfdSubsecao titulo="1.6 Escopo negativo" />
        <DfdChkGrupo opcoes={DFD_ESCOPO_NEGATIVO} values={d.escopo_negativo} />
      </div>

      {/* Seção 2 */}
      <DfdSecao titulo="2. Mapa das Etapas do Processo" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdSubsecao titulo="2.1 Etapas" />
        {etapas.length === 0 ? (
          <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>Nenhuma etapa cadastrada.</p>
        ) : (
          <DfdTabela
            colunas={["Código", "Descrição"]}
            linhas={etapas.map((e) => [e.codigo, e.descricao])}
          />
        )}
        <DfdSubsecao titulo="2.4 Encerramento — o processo se encerra quando:" />
        <DfdChkGrupo opcoes={[
          { k: "solicitacao_aprovada", l: "A solicitação for aprovada" }, { k: "solicitacao_reprovada", l: "For reprovada" },
          { k: "execucao_concluida", l: "Execução concluída" }, { k: "documento_gerado", l: "Documento gerado" },
          { k: "responsavel_finalizar", l: "Responsável finalizar" }, { k: "prazo_expirar", l: "Prazo expirar" },
          { k: "houver_cancelamento", l: "Cancelamento" }, { k: "outro", l: "Outro" },
        ]} values={d.encerramento} />
      </div>

      {/* Seção 3 */}
      <DfdSecao titulo="3. Matriz Funcional por Etapa" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        {etapas.length === 0 ? (
          <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>Nenhuma etapa cadastrada.</p>
        ) : (
          <DfdTabela
            colunas={["Etapa", ...DFD_MATRIZ_COLS.map((c) => c.l), "Hist. S", "Hist. N", "Notif. S", "Notif. N", "Bloq. S", "Bloq. N", "Bloq. O"]}
            linhas={etapas.map((e) => {
              const row = d.matriz?.[e.codigo] ?? {};
              const r = row as Record<string, boolean>;
              return [
                `${e.codigo} – ${e.descricao}`,
                ...DFD_MATRIZ_COLS.map((c) => r[c.k] ? "☑" : "☐"),
                r["gera_historico"] ? "☑" : "☐",
                r["gera_historico_n"] ? "☑" : "☐",
                r["gera_notificacao"] ? "☑" : "☐",
                r["gera_notificacao_n"] ? "☑" : "☐",
                r["bloqueia_avanco"] ? "☑" : "☐",
                r["bloqueia_nao"] ? "☑" : "☐",
                r["bloqueia_outro"] ? "☑" : "☐",
              ];
            })}
          />
        )}
      </div>

      {/* Seção 4 */}
      <DfdSecao titulo="4. Regras de Negócio e Validações" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdSubsecao titulo="4.1 Matriz de regras" />
        {(d.regras_negocio ?? []).some((r) => r.regra || r.etapa) ? (
          <DfdTabela
            colunas={["Etapa", "Tipo", "Regra / Validação", "Responsável"]}
            linhas={(d.regras_negocio ?? []).filter((r) => r.regra || r.etapa).map((r) => [etapaLabel(r.etapa), r.tipo ?? "—", r.regra ?? "—", r.responsavel ?? "—"])}
          />
        ) : (
          <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>Não preenchido.</p>
        )}
        <DfdSubsecao titulo="4.3 Controle de prazo" />
        <DfdLinha label="Terá controle de prazo?" valor={d.tem_prazo === "sim" ? "Sim" : d.tem_prazo === "nao" ? "Não" : d.tem_prazo ?? "—"} />
      </div>

      {/* Seção 5 */}
      <DfdSecao titulo="5. Funcionalidades e Ações Sistêmicas" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdSubsecao titulo="5.2 Detalhamento das ações" />
        {(d.acoes ?? []).some((a) => a.acao) ? (
          <DfdTabela
            colunas={["Ação", "Etapa", "Precisa aprovação", "Gera histórico"]}
            linhas={(d.acoes ?? []).filter((a) => a.acao).map((a) => [a.acao ?? "—", etapaLabel(a.etapa_vinculada), a.precisa_aprovacao === true ? "Sim" : a.precisa_aprovacao === false ? "Não" : "—", a.gera_historico === true ? "Sim" : a.gera_historico === false ? "Não" : "—"])}
          />
        ) : (
          <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>Não preenchido.</p>
        )}
      </div>

      {/* Seção 7 */}
      <DfdSecao titulo="7. Perfis e Permissões de Acesso" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdSubsecao titulo="7.2 Matriz resumida de permissões" />
        {(d.permissoes ?? []).some((p) => p.perfil) ? (
          <DfdTabela
            colunas={["Perfil", "Etapa", "Vis.", "Inc.", "Alt.", "Apr.", "Rep.", "Can.", "Anex.", "Exp.", "Ind."]}
            linhas={(d.permissoes ?? []).filter((p) => p.perfil).map((p) => {
              const row = p as Record<string, unknown>;
              const chk = (k: string) => row[k] ? "☑" : "☐";
              return [p.perfil ?? "—", etapaLabel(p.etapa_vinculada), chk("visualizar"), chk("incluir"), chk("alterar"), chk("aprovar"), chk("reprovar"), chk("cancelar"), chk("anexar"), chk("exportar"), chk("indicadores")];
            })}
          />
        ) : (
          <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>Não preenchido.</p>
        )}
      </div>

      {/* Seção 8 */}
      <DfdSecao titulo="8. Integrações" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdLinha label="Terá integração?" valor={d.tem_integracao === "sim" ? "Sim" : d.tem_integracao === "nao" ? "Não" : d.tem_integracao ?? "—"} />
        {(d.integracoes ?? []).some((i) => i.sistema) && (
          <DfdTabela
            colunas={["Etapa", "Sistema", "Dados", "Frequência", "Tratamento em caso de falha"]}
            linhas={(d.integracoes ?? []).filter((i) => i.sistema).map((i) => [etapaLabel(i.etapa_vinculada), i.sistema ?? "—", i.dados ?? "—", i.frequencia ?? "—", i.tratamento_falha ?? "—"])}
          />
        )}
      </div>

      {/* Seção 9 */}
      <DfdSecao titulo="9. Documentos, Relatórios e Indicadores" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        {(d.documentos ?? []).some((doc) => doc.documento) && (
          <>
            <DfdSubsecao titulo="9.1 Documentos e relatórios" />
            <DfdTabela
              colunas={["Etapa", "Documento", "Finalidade", "Gerado automaticamente?", "Quem acessa?"]}
              linhas={(d.documentos ?? []).filter((doc) => doc.documento).map((doc) => [etapaLabel(doc.etapa_vinculada), doc.documento ?? "—", doc.finalidade ?? "—", doc.gerado_auto === true ? "Sim" : doc.gerado_auto === false ? "Não" : "—", doc.quem_acessa ?? "—"])}
            />
          </>
        )}
        {(d.indicadores ?? []).some((ind) => ind.indicador) && (
          <>
            <DfdSubsecao titulo="9.2 Indicadores" />
            <DfdTabela
              colunas={["Etapa", "Indicador", "Objetivo", "Fonte", "Frequência", "Responsável"]}
              linhas={(d.indicadores ?? []).filter((ind) => ind.indicador).map((ind) => [etapaLabel(ind.etapa_vinculada), ind.indicador ?? "—", ind.objetivo ?? "—", ind.fonte ?? "—", ind.frequencia ?? "—", ind.responsavel ?? "—"])}
            />
          </>
        )}
      </div>

      {/* Seção 10 */}
      <DfdSecao titulo="10. Premissas, Restrições, Dependências e Riscos" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        {(d.premissas ?? []).some((p) => p.responsavel || p.tratamento) ? (
          <DfdTabela
            colunas={["Tipos", "Etapa", "Responsável", "Impacto", "Tratamento"]}
            linhas={(d.premissas ?? []).filter((p) => p.responsavel || p.tratamento).map((p) => [(p.tipos ?? []).join(", ") || "—", etapaLabel(p.etapa_vinculada), p.responsavel ?? "—", p.impacto ?? "—", p.tratamento ?? "—"])}
          />
        ) : (
          <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>Não preenchido.</p>
        )}
      </div>

      {/* Seção 11 */}
      <DfdSecao titulo="11. Critérios de Homologação" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        {(d.criterios_etapa ?? []).some((c) => c.criterio) && (
          <>
            <DfdSubsecao titulo="11.1 Critérios por etapa" />
            <DfdTabela
              colunas={["Etapa", "O que validar na homologação", "Resultado esperado"]}
              linhas={(d.criterios_etapa ?? []).filter((c) => c.criterio).map((c) => [etapaLabel(c.etapa_vinculada), c.criterio ?? "—", c.resultado ?? "—"])}
            />
          </>
        )}
      </div>

      {/* Seção 12 */}
      <DfdSecao titulo="12. Validação do DFD" />
      <div style={{ padding: "0 4px", marginBottom: 8 }}>
        <DfdLinha label="Situação" valor={d.situacao ?? "—"} />
        {d.observacoes_finais && <DfdLinha label="Observações finais" valor={d.observacoes_finais} />}
      </div>
    </div>
  );
}
