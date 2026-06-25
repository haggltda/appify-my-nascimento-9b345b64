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
  homologacao_aprov_1: boolean;
  homologacao_aprov_2: boolean;
  homologacao_aprov_3: boolean;
  complexidade: string | null;
  objetivo_solicitacao: string | null;
  problema_atual: string | null;
  justificativa: string | null;
  beneficio_esperado: string | null;
  impacto_operacional: string | null;
  impacto_financeiro: string | null;
  grau_urgencia: string | null;
  tipo_solicitacao: string | null;
  tipo_correcao: string | null;
  tipo_melhoria: string | null;
  tipo_novo_modulo: string | null;
  tipo_integracao: string | null;
  tipo_relatorio: string | null;
  tipo_automacao: string | null;
  tipo_alteracao_legal: string | null;
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

// Aprovações nominais da Homologação Técnica — nomes só aqui (front-end), as colunas
// no banco (homologacao_aprov_1/2/3) são genéricas pra não acoplar schema a pessoas.
export const APROVACOES_HOMOLOGACAO_TECNICA: Record<"homologacao_aprov_1" | "homologacao_aprov_2" | "homologacao_aprov_3", string> = {
  homologacao_aprov_1: "Érica Souza Ávila",
  homologacao_aprov_2: "Yuri Rosa",
  homologacao_aprov_3: "Iury de Jesus Silva",
};

// 15 campos de justificativa de negócio exigidos na abertura da solicitação —
// todos com o mesmo formato (título + comentário com placeholder), sem select.
export const CAMPOS_ABERTURA: Array<{ key: keyof Solicitacao; label: string; placeholder: string }> = [
  { key: "objetivo_solicitacao", label: "Objetivo da solicitação", placeholder: "Qual é o objetivo desta solicitação?" },
  { key: "problema_atual", label: "Problema atual", placeholder: "Descreva o problema que motivou esta solicitação." },
  { key: "justificativa", label: "Justificativa", placeholder: "Por que esta solicitação é necessária?" },
  { key: "beneficio_esperado", label: "Benefício esperado", placeholder: "Que benefício esta solicitação trará?" },
  { key: "impacto_operacional", label: "Impacto operacional", placeholder: "Qual o impacto na operação?" },
  { key: "impacto_financeiro", label: "Impacto financeiro", placeholder: "Qual o impacto financeiro, quando houver?" },
  { key: "grau_urgencia", label: "Grau de urgência", placeholder: "Qual o grau de urgência desta solicitação?" },
  { key: "tipo_solicitacao", label: "Tipo da solicitação", placeholder: "Descreva o tipo desta solicitação." },
  { key: "tipo_correcao", label: "Correção", placeholder: "Detalhe, se aplicável." },
  { key: "tipo_melhoria", label: "Melhoria", placeholder: "Detalhe, se aplicável." },
  { key: "tipo_novo_modulo", label: "Novo módulo", placeholder: "Detalhe, se aplicável." },
  { key: "tipo_integracao", label: "Integração", placeholder: "Detalhe, se aplicável." },
  { key: "tipo_relatorio", label: "Relatório", placeholder: "Detalhe, se aplicável." },
  { key: "tipo_automacao", label: "Automação", placeholder: "Detalhe, se aplicável." },
  { key: "tipo_alteracao_legal", label: "Alteração legal", placeholder: "Detalhe, se aplicável." },
];

export const COMPLEXIDADE_LABEL: Record<string, string> = {
  pequena: "Pequena",
  media: "Média",
  grande: "Grande",
  projeto: "Projeto",
};

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
