export interface Solicitacao {
  id: string;
  titulo: string;
  descricao: string | null;
  etapa: string;
  recusado: boolean;
  prioridade: number | null;
  responsavel_user_id: string | null;
  progresso_pct: number;
  data_inicio: string | null;
  data_fim: string | null;
  levantamento_funcional_texto: string | null;
  levantamento_funcional_prazo: string | null;
  documentacao_tecnica_texto: string | null;
  documentacao_tecnica_prazo: string | null;
  analise_tecnica_texto: string | null;
  analise_tecnica_prazo: string | null;
  treinamento_data: string | null;
  implantacao_status: string | null;
  finalizado: boolean;
  etapa_entrada_em: string;
  criado_por: string;
  created_at: string;
}

export interface Anexo {
  id: string;
  storage_path: string;
  nome_arquivo: string;
  campo: string | null;
  created_at: string;
}

export interface Comentario {
  id: string;
  autor_id: string;
  texto: string;
  tipo: string | null;
  created_at: string;
}

export interface Convidado {
  id: string;
  user_id: string;
  created_at: string;
}

export interface Usuario {
  id: string;
  display_name: string;
}

export interface Papeis {
  comite: boolean;
  controladoria: boolean;
  gerenteSistemas: boolean;
  desenvolvedores: boolean;
  criarSolicitacao: boolean;
  convidado: boolean;
  verTodas: boolean;
}

export const ETAPAS: Array<{ key: string; label: string }> = [
  { key: "registro_oficial", label: "Solicitações Registro Oficial" },
  { key: "triagem_inicial_comite", label: "Triagem Inicial - Comitê" },
  { key: "projeto", label: "Projeto" },
  { key: "aprovacoes_priorizacao", label: "Aprovações e Priorização" },
  { key: "definicao_responsavel", label: "Definição de Responsável" },
  { key: "desenvolvimento_ajustes", label: "Desenvolvimento e Ajustes" },
  { key: "homologacao_tecnica", label: "Homologação Técnica" },
  { key: "homologacao_usuario", label: "Homologação do Usuário" },
  { key: "treinamentos", label: "Treinamentos" },
  { key: "implantacao", label: "Implantação" },
  { key: "acompanhamento_assistido", label: "Acompanhamento Assistido" },
  { key: "encerramento", label: "Encerramento" },
];

// Comentários "tipados" (justificativa/ressalva/reprovação/etc.) ganham borda própria.
export const TIPO_COMENTARIO_LABEL: Record<string, string> = {
  justificativa_retorno: "Justificativa de retorno de etapa",
  aprovado_ressalva: "Aprovado com ressalva",
  reprovado: "Reprovado",
  faltou_funcoes: "Faltou função",
  encontrado_bug: "Bug encontrado",
};

export const TIPO_COMENTARIO_BORDA: Record<string, string> = {
  justificativa_retorno: "border-l-warning",
  aprovado_ressalva: "border-l-warning",
  reprovado: "border-l-destructive",
  faltou_funcoes: "border-l-warning",
  encontrado_bug: "border-l-destructive",
};

export function nomeUsuario(usuarios: Usuario[], id: string | null): string | null {
  return usuarios.find((u) => u.id === id)?.display_name ?? null;
}

export function iniciais(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function fmtData(data: string | null): string | null {
  if (!data) return null;
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export interface EtapaPanelProps {
  card: Solicitacao;
  papeis: Papeis;
  userId: string | null;
  usuarios: Usuario[];
  convidaveis: Usuario[];
  anexos: Anexo[];
  comentarios: Comentario[];
  convidados: Convidado[];
  totalNaColuna: number;
  prioridadesUsadas: number[];
  /** Atualiza colunas da própria solicitação (etapa, campos, flags) — já passa pelas regras do trigger no banco. */
  onUpdate: (patch: Record<string, unknown>) => Promise<boolean>;
  onComentar: (texto: string, tipo?: string) => Promise<boolean>;
  onAnexar: (file: File, campo?: string) => Promise<boolean>;
  onDownloadAnexo: (path: string) => void;
  onAdicionarConvidado: (userId: string) => Promise<boolean>;
  onRemoverConvidado: (convidadoId: string) => Promise<boolean>;
  onExcluir: () => Promise<boolean>;
}
