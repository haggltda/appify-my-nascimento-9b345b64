export type ReuniaoEtapa = "agendada" | "em_andamento" | "concluida" | "cancelada";

export const ETAPA_LABEL: Record<ReuniaoEtapa, string> = {
  agendada: "Agendada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ETAPA_COR: Record<ReuniaoEtapa, string> = {
  agendada: "bg-blue-100 text-blue-800 border-blue-200",
  em_andamento: "bg-amber-100 text-amber-800 border-amber-200",
  concluida: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelada: "bg-red-100 text-red-700 border-red-200",
};

export type PautaStatus = "nao_iniciada" | "pendente" | "em_andamento" | "concluida";

export const PAUTA_STATUS_LABEL: Record<PautaStatus, string> = {
  nao_iniciada: "Não iniciada",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export const PAUTA_STATUS_COR: Record<PautaStatus, string> = {
  nao_iniciada: "bg-slate-100 text-slate-600 border-slate-200",
  pendente: "bg-amber-100 text-amber-800 border-amber-200",
  em_andamento: "bg-blue-100 text-blue-800 border-blue-200",
  concluida: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const SALAS_PRESENCIAIS = [
  "Sala de Reunião 1 - 1º Andar",
  "Sala de Reunião 2 - 1º Andar",
  "Sala de Reunião - 2º Andar",
  "Outro",
] as const;

export interface Reuniao {
  id: string;
  titulo: string;
  objetivo: string | null;
  data_hora: string;
  duracao_minutos: number;
  tipo_local: "presencial" | "online";
  local_ou_link: string;
  etapa: ReuniaoEtapa;
  criado_por: string;
  responsavel_preenchimento_user_id: string;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
}

/** Recorte mínimo pro calendário — todas as reuniões da empresa, sem objetivo/motivo_cancelamento. */
export interface ReuniaoCalendario {
  id: string;
  titulo: string;
  data_hora: string;
  duracao_minutos: number;
  tipo_local: "presencial" | "online";
  local_ou_link: string;
  etapa: ReuniaoEtapa;
  criado_por: string;
  responsavel_preenchimento_user_id: string;
  convidados: string[];
}

export interface ReuniaoPauta {
  id: string;
  reuniao_id: string;
  ordem: number;
  titulo_topico: string;
  descricao: string | null;
  responsavel_user_id: string | null;
  prazo: string | null;
  status: PautaStatus;
  created_at: string;
}

export interface ReuniaoResposta {
  id: string;
  pauta_id: string;
  texto_resposta: string | null;
  encaminhamento: string | null;
  respondido_por: string;
  created_at: string;
  updated_at: string;
}

export interface ReuniaoConvidado {
  id: string;
  reuniao_id: string;
  user_id: string;
  created_at: string;
}

export interface ReuniaoAnexo {
  id: string;
  reuniao_id: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  enviado_por: string;
  created_at: string;
}

export interface ReuniaoPautaAnexo {
  id: string;
  pauta_id: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  enviado_por: string;
  created_at: string;
}

export interface ReuniaoLog {
  id: string;
  reuniao_id: string;
  user_id: string;
  acao: string;
  detalhe: string;
  created_at: string;
}

export interface ReuniaoComentario {
  id: string;
  reuniao_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
}

export interface ReuniaoAssinatura {
  id: string;
  reuniao_id: string;
  user_id: string;
  assinatura_png: string;
  created_at: string;
}

export interface Usuario {
  id: string;
  display_name: string;
}

export function nomeUsuario(usuarios: Usuario[], id: string | null): string | null {
  return usuarios.find((u) => u.id === id)?.display_name ?? null;
}
