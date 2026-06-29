import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  APROVACOES_HOMOLOGACAO_TECNICA, COMPLEXIDADE_LABEL, ETAPAS, STATUS_DESENVOLVIMENTO_LABEL,
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
    case "projeto":
      return (
        !!card.levantamento_funcional_texto || !!card.levantamento_funcional_prazo ||
        !!card.documentacao_tecnica_texto || !!card.documentacao_tecnica_prazo ||
        !!card.analise_tecnica_texto || !!card.analise_tecnica_prazo ||
        anexos.some((a) => a.campo === "levantamento_funcional" || a.campo === "documentacao_tecnica" || a.campo === "analise_tecnica")
      );
    case "definicao_responsavel":
      return !!card.responsavel_user_id || !!card.complexidade;
    case "desenvolvimento_ajustes":
      return card.progresso_pct > 0 || !!card.data_fim || !!card.status_desenvolvimento;
    case "homologacao_tecnica":
      return (
        card.homologacao_aprov_1 || card.homologacao_aprov_2 || card.homologacao_aprov_3 ||
        comentarios.some((c) => c.tipo === "justificativa_retorno")
      );
    case "homologacao_usuario":
      return comentarios.some((c) => c.tipo === "aprovado_ressalva" || c.tipo === "reprovado");
    case "treinamentos":
      return (
        !!card.treinamento_data ||
        anexos.some((a) => a.campo === "treinamento") ||
        comentarios.some((c) => c.tipo === "faltou_funcoes" || c.tipo === "encontrado_bug")
      );
    case "implantacao":
      return !!card.implantacao_status || comentarios.some((c) => c.tipo === "implantacao_comentario");
    case "acompanhamento_assistido":
      return anexos.some((a) => a.campo === "acompanhamento");
    default:
      return false;
  }
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

function ListaAnexos({ anexos, campo, onDownloadAnexo }: { anexos: Anexo[]; campo: string; onDownloadAnexo: (path: string) => void }) {
  const lista = anexos.filter((a) => a.campo === campo);
  if (lista.length === 0) return null;
  return (
    <div className="space-y-1">
      {lista.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-[11px]">
          <span className="truncate">{a.nome_arquivo}</span>
          <button type="button" onClick={() => onDownloadAnexo(a.storage_path)} className="text-primary hover:underline">abrir</button>
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

function ResumoProjeto({ card, anexos, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="projeto">
      <CampoTexto titulo="Levantamento Funcional" texto={card.levantamento_funcional_texto} prazo={card.levantamento_funcional_prazo} />
      <ListaAnexos anexos={anexos} campo="levantamento_funcional" onDownloadAnexo={onDownloadAnexo} />
      <CampoTexto titulo="Documentação Técnica" texto={card.documentacao_tecnica_texto} prazo={card.documentacao_tecnica_prazo} />
      <ListaAnexos anexos={anexos} campo="documentacao_tecnica" onDownloadAnexo={onDownloadAnexo} />
      <CampoTexto titulo="Análise Técnica" texto={card.analise_tecnica_texto} prazo={card.analise_tecnica_prazo} />
      <ListaAnexos anexos={anexos} campo="analise_tecnica" onDownloadAnexo={onDownloadAnexo} />
    </Bloco>
  );
}

function ResumoDefinicaoResponsavel({ card, usuarios }: ResumoProps) {
  return (
    <Bloco etapaKey="definicao_responsavel">
      <p className="text-xs">
        <span className="font-medium">Responsável:</span>{" "}
        {nomeUsuario(usuarios, card.responsavel_user_id) ?? "—"}
      </p>
      <p className="text-xs">
        <span className="font-medium">Complexidade:</span>{" "}
        {card.complexidade ? COMPLEXIDADE_LABEL[card.complexidade] ?? card.complexidade : "—"}
      </p>
    </Bloco>
  );
}

function ResumoDesenvolvimentoAjustes({ card }: ResumoProps) {
  return (
    <Bloco etapaKey="desenvolvimento_ajustes">
      <Progress value={card.progresso_pct} className="h-2" />
      <p className="text-[11px] text-muted-foreground">{card.progresso_pct}% concluído</p>
      {card.data_fim && <p className="text-[11px] text-muted-foreground">Prazo: {fmtData(card.data_fim)}</p>}
      {card.status_desenvolvimento && (
        <p className="text-xs">
          <span className="font-medium">Status de Desenvolvimento:</span>{" "}
          {STATUS_DESENVOLVIMENTO_LABEL[card.status_desenvolvimento] ?? card.status_desenvolvimento}
        </p>
      )}
    </Bloco>
  );
}

const APROVACOES = Object.entries(APROVACOES_HOMOLOGACAO_TECNICA).map(([campo, nome]) => ({
  campo: campo as keyof typeof APROVACOES_HOMOLOGACAO_TECNICA,
  nome,
}));

function ResumoHomologacaoTecnica({ card, comentarios, usuarios }: ResumoProps) {
  return (
    <Bloco etapaKey="homologacao_tecnica">
      <div className="space-y-1">
        {APROVACOES.map((a) => (
          <label key={a.campo} className="flex items-center gap-2 text-xs">
            <Checkbox checked={card[a.campo]} disabled />
            {a.nome}
          </label>
        ))}
      </div>
      <ComentariosTipados comentarios={comentarios} tipos={["justificativa_retorno"]} usuarios={usuarios} />
    </Bloco>
  );
}

function ResumoHomologacaoUsuario({ comentarios, usuarios }: ResumoProps) {
  return (
    <Bloco etapaKey="homologacao_usuario">
      <ComentariosTipados comentarios={comentarios} tipos={["aprovado_ressalva", "reprovado"]} usuarios={usuarios} />
    </Bloco>
  );
}

function ResumoTreinamentos({ card, anexos, comentarios, usuarios, onDownloadAnexo }: ResumoProps) {
  return (
    <Bloco etapaKey="treinamentos">
      {card.treinamento_data && <p className="text-xs">Data do treinamento: {fmtData(card.treinamento_data)}</p>}
      <ListaAnexos anexos={anexos} campo="treinamento" onDownloadAnexo={onDownloadAnexo} />
      <ComentariosTipados comentarios={comentarios} tipos={["faltou_funcoes", "encontrado_bug"]} usuarios={usuarios} />
    </Bloco>
  );
}

const IMPLANTACAO_LABEL: Record<string, string> = { sim: "Sim", nao: "Não", em_implantacao: "Em Implantação" };

function ResumoImplantacao({ card, comentarios, usuarios }: ResumoProps) {
  return (
    <Bloco etapaKey="implantacao">
      <p className="text-xs">
        <span className="font-medium">Implantado corretamente:</span>{" "}
        {card.implantacao_status ? IMPLANTACAO_LABEL[card.implantacao_status] ?? card.implantacao_status : "—"}
      </p>
      <ComentariosTipados comentarios={comentarios} tipos={["implantacao_comentario"]} usuarios={usuarios} />
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
  projeto: ResumoProjeto,
  definicao_responsavel: ResumoDefinicaoResponsavel,
  desenvolvimento_ajustes: ResumoDesenvolvimentoAjustes,
  homologacao_tecnica: ResumoHomologacaoTecnica,
  homologacao_usuario: ResumoHomologacaoUsuario,
  treinamentos: ResumoTreinamentos,
  implantacao: ResumoImplantacao,
  acompanhamento_assistido: ResumoAcompanhamentoAssistido,
};
