// Mapper public.licitacao -> tipo visual Licitacao do Pipeline.
// Sem alterar banco, sem reordenar enums, sem inventar colunas.
import type { Database } from "@/integrations/supabase/types";
import type {
  Licitacao,
  StatusLicitacao,
  Criticidade,
} from "@/data/licitacoes";

export type DbLicitacaoRow = Database["public"]["Tables"]["licitacao"]["Row"];
export type DbLicitacaoStatus = Database["public"]["Enums"]["licitacao_status"];

export type ResponsavelInfo = {
  nome: string | null;
  email: string | null;
};
export type ResponsavelMap = Record<string, ResponsavelInfo>;

// STATUS_SEM_EQUIVALENTE_NO_BANCO — mapeamento conservador apenas para visual.
// Enum DB atual: rascunho | oportunidade | em_andamento | vencida | perdida | cancelada.
// Enum UI possui 11 valores (workflow). Mapeamento documentado no plano §3 (D-PIPE-2).
const STATUS_DB_TO_UI: Record<DbLicitacaoStatus, StatusLicitacao> = {
  rascunho: "oportunidade",
  oportunidade: "oportunidade",
  em_andamento: "em_analise",
  vencida: "vencida",
  perdida: "perdida",
  cancelada: "suspensa",
};

// CRITICIDADE_NAO_LOCALIZADA_NO_BANCO — neutro até existir coluna real (D-PIPE-4).
const CRITICIDADE_DEFAULT: Criticidade = "media";

function fallbackResponsavel(
  userId: string | null,
  info?: ResponsavelInfo,
): string {
  if (!userId) return "—";
  if (info?.nome && info.nome.trim()) return info.nome.trim();
  if (info?.email && info.email.trim()) return info.email.trim();
  return "Responsável vinculado";
}

export function mapDbLicitacaoToPipeline(
  row: DbLicitacaoRow,
  responsaveis: ResponsavelMap = {},
): Licitacao {
  const abertura = row.abertura ?? "";
  return {
    id: row.id, // uuid real do banco, preservado
    numero: row.numero ?? "",
    objeto: row.objeto ?? "",
    orgao: row.orgao ?? "",
    modalidade: row.modalidade ?? "",
    // Sigla da empresa não vem em public.licitacao; resolução completa = D-PIPE-1.
    empresa: "",
    responsavel: fallbackResponsavel(
      row.responsavel_user_id,
      row.responsavel_user_id
        ? responsaveis[row.responsavel_user_id]
        : undefined,
    ),
    status: STATUS_DB_TO_UI[row.status] ?? "oportunidade",
    criticidade: CRITICIDADE_DEFAULT,
    valorEstimado: Number(row.valor_estimado ?? 0),
    prazo: abertura, // proxy: não há coluna prazo no banco hoje
    abertura,
    ultimaAcao: "",
  };
}

export function mapManyDbLicitacaoToPipeline(
  rows: DbLicitacaoRow[],
  responsaveis: ResponsavelMap = {},
): Licitacao[] {
  return rows.map((r) => mapDbLicitacaoToPipeline(r, responsaveis));
}
