export const STATUS_LABELS: Record<string, string> = {
  a_definir: "A definir",
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  aguardando_validacao: "Aguardando validação",
  atrasada: "Atrasada",
  concluida_pendente_evidencia: "Concluída — pend. evidência",
  concluida_validada: "Concluída validada",
  cancelada: "Cancelada",
};

export const STATUS_ORDEM = [
  "a_definir",
  "nao_iniciada",
  "em_andamento",
  "aguardando_validacao",
  "atrasada",
  "concluida_pendente_evidencia",
  "concluida_validada",
  "cancelada",
] as const;

export type StatusNorm = (typeof STATUS_ORDEM)[number];

/** Cores tonais para badges/colunas — tudo via tokens semânticos */
export const STATUS_COR: Record<string, string> = {
  a_definir: "bg-muted text-muted-foreground border-border",
  nao_iniciada: "bg-muted/60 text-muted-foreground border-border",
  em_andamento: "bg-primary/10 text-primary border-primary/30",
  aguardando_validacao: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  atrasada: "bg-destructive/10 text-destructive border-destructive/30",
  concluida_pendente_evidencia: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  concluida_validada: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  cancelada: "bg-muted text-muted-foreground line-through",
};

export const PRIORIDADES = ["emergencial", "alta", "media", "baixa", "nao_informada"] as const;

export const PRIORIDADE_LABEL: Record<string, string> = {
  emergencial: "Emergencial",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  nao_informada: "Não informada",
};

export const PRIORIDADE_COR: Record<string, string> = {
  emergencial: "bg-destructive/10 text-destructive border-destructive/30",
  alta: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  media: "bg-primary/10 text-primary border-primary/30",
  baixa: "bg-muted text-muted-foreground border-border",
  nao_informada: "bg-muted/40 text-muted-foreground border-border",
};

export const PERMISSOES_FLAGS = [
  "visualizar","dashboard","criar","editar","excluir","importar","aprovar","administrar","ver_todas",
] as const;
export type PermissaoFlag = (typeof PERMISSOES_FLAGS)[number];

export const VISIBILIDADE_OPTIONS = ["privado", "publico", "especifico"] as const;
export type VisibilidadeType = (typeof VISIBILIDADE_OPTIONS)[number];

export const VISIBILIDADE_LABEL: Record<VisibilidadeType, string> = {
  privado: "Somente o responsável / criador",
  publico: "Todos podem ver",
  especifico: "Pessoas específicas",
};

export const EMPRESA_HAGG_ID = "5a61c769-21d8-4e61-b9bb-506b8db0bce8";
