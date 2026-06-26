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
  status_desenvolvimento: string | null;
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
  pesquisa_atendeu_necessidade: number | null;
  pesquisa_levantamento_claro: number | null;
  pesquisa_conducao_ti: number | null;
  pesquisa_treinamento_suporte: number | null;
  pesquisa_avaliacao_geral: number | null;
  pesquisa_pode_encerrar: boolean | null;
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

export const STATUS_DESENVOLVIMENTO_LABEL: Record<string, string> = {
  em_desenvolvimento: "Em Desenvolvimento",
  em_validacao: "Em Validação",
  em_correcao: "Em Correção",
  finalizado: "Finalizado",
};

export const STATUS_DESENVOLVIMENTO_COR: Record<string, string> = {
  em_desenvolvimento: "bg-info/15 text-info border-info/30",
  em_validacao: "bg-warning/15 text-warning-foreground border-warning/30",
  em_correcao: "bg-destructive/15 text-destructive border-destructive/30",
  finalizado: "bg-success/15 text-success border-success/30",
};

// Pesquisa de Avaliação da Demanda — respondida na etapa Encerramento por quem
// criou, convidados, ou Controladoria. As 5 primeiras são escala 1-5; a última
// é sim/não e só tem caráter informativo (não bloqueia o "Finalizar demanda").
export const PESQUISA_ENCERRAMENTO: Array<{
  key: "pesquisa_atendeu_necessidade" | "pesquisa_levantamento_claro" | "pesquisa_conducao_ti" | "pesquisa_treinamento_suporte" | "pesquisa_avaliacao_geral";
  pergunta: string;
  opcoes: string[];
}> = [
  {
    key: "pesquisa_atendeu_necessidade",
    pergunta: "A solução implantada atendeu à necessidade que originou a solicitação?",
    opcoes: ["Não atendeu", "Atendeu pouco", "Atendeu parcialmente", "Atendeu", "Atendeu completamente"],
  },
  {
    key: "pesquisa_levantamento_claro",
    pergunta: "O levantamento da necessidade foi realizado de forma clara, permitindo que sua demanda fosse corretamente compreendida?",
    opcoes: ["Muito insatisfatório", "Insatisfatório", "Regular", "Bom", "Excelente"],
  },
  {
    key: "pesquisa_conducao_ti",
    pergunta: "Como você avalia a condução do processo pela equipe de TI e Processos (comunicação, acompanhamento e suporte durante o desenvolvimento)?",
    opcoes: ["Muito insatisfeito", "Insatisfeito", "Regular", "Satisfeito", "Muito satisfeito"],
  },
  {
    key: "pesquisa_treinamento_suporte",
    pergunta: "Como você avalia o treinamento e o suporte prestado durante a implantação da solução?",
    opcoes: ["Muito insatisfatório", "Insatisfatório", "Regular", "Bom", "Excelente"],
  },
  {
    key: "pesquisa_avaliacao_geral",
    pergunta: "De forma geral, como você avalia todo o processo de atendimento da sua demanda, desde a solicitação até a implantação?",
    opcoes: ["Muito insatisfeito", "Insatisfeito", "Regular", "Satisfeito", "Muito satisfeito"],
  },
];

export const PESQUISA_PODE_ENCERRAR_PERGUNTA = "Você considera que esta demanda pode ser encerrada?";
export const PESQUISA_PODE_ENCERRAR_OPCOES = {
  sim: "Sim, a demanda foi plenamente atendida.",
  nao: "Não, ainda existem ajustes necessários.",
};

// Comentários "tipados" (justificativa/ressalva/reprovação/etc.) ganham borda própria.
export const TIPO_COMENTARIO_LABEL: Record<string, string> = {
  justificativa_retorno: "Justificativa de retorno de etapa",
  aprovado_ressalva: "Aprovado com ressalva",
  reprovado: "Reprovado",
  faltou_funcoes: "Faltou função",
  encontrado_bug: "Bug encontrado",
  implantacao_comentario: "Comentário de implantação",
  encerramento_comentario: "Comentário de conclusão",
};

export const TIPO_COMENTARIO_BORDA: Record<string, string> = {
  justificativa_retorno: "border-l-warning",
  aprovado_ressalva: "border-l-warning",
  reprovado: "border-l-destructive",
  faltou_funcoes: "border-l-warning",
  encontrado_bug: "border-l-destructive",
  implantacao_comentario: "border-l-muted-foreground",
  encerramento_comentario: "border-l-success",
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
