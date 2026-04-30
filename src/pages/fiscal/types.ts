export type NfTipo = "nfse" | "nfe" | "nfce";
export type NfStatus = "rascunho" | "emitida" | "autorizada" | "cancelada" | "rejeitada" | "denegada";
export type NfOrigem = "titulo" | "medicao" | "avulsa" | "manual";
export type NfAmbiente = "homologacao" | "producao";
export type RegimeTributario = "simples_nacional" | "lucro_presumido" | "lucro_real";
export type ImpostoTipo = "iss" | "pis" | "cofins" | "irpj" | "csll" | "das" | "inss" | "irrf";
export type ApuracaoStatus = "aberta" | "calculada" | "fechada" | "pago" | "atrasado";

export interface NotaFiscal {
  id: string;
  empresa_id: string;
  tipo: NfTipo;
  origem: NfOrigem;
  numero: number | null;
  serie: string | null;
  status: NfStatus;
  ambiente: NfAmbiente;
  data_emissao: string | null;
  competencia: string;
  tomador_nome: string;
  tomador_documento: string;
  tomador_email: string | null;
  titulo_receber_id: string | null;
  contrato_id: string | null;
  valor_servicos: number;
  valor_produtos: number;
  base_calculo: number;
  valor_iss: number;
  valor_pis: number;
  valor_cofins: number;
  valor_total: number;
  valor_liquido: number;
  codigo_servico: string | null;
  discriminacao: string | null;
  protocolo: string | null;
  link_pdf: string | null;
  link_xml: string | null;
  cancelamento_motivo: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface EmpresaFiscalConfig {
  id: string;
  empresa_id: string;
  regime: RegimeTributario;
  ambiente: NfAmbiente;
  cnae_principal: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  nfse_serie: string;
  nfse_proximo_numero: number;
  nfse_provedor: string | null;
  nfe_serie: string;
  nfe_proximo_numero: number;
  aliq_iss: number;
  aliq_pis: number;
  aliq_cofins: number;
  aliq_irpj_presuncao: number;
  aliq_csll_presuncao: number;
  anexo_simples: string | null;
  faixa_simples: number | null;
  aliq_simples_efetiva: number | null;
}

export interface ApuracaoImposto {
  id: string;
  empresa_id: string;
  competencia: string;
  imposto: ImpostoTipo;
  regime: RegimeTributario;
  base_calculo: number;
  aliquota: number;
  valor_devido: number;
  valor_a_pagar: number;
  vencimento: string | null;
  data_pagamento: string | null;
  valor_pago: number | null;
  status: ApuracaoStatus;
  observacoes: string | null;
  calculado_em: string | null;
}

export const STATUS_LABEL: Record<NfStatus, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  autorizada: "Autorizada",
  cancelada: "Cancelada",
  rejeitada: "Rejeitada",
  denegada: "Denegada",
};

export const STATUS_COLOR: Record<NfStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  emitida: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  autorizada: "bg-green-500/10 text-green-700 dark:text-green-400",
  cancelada: "bg-destructive/10 text-destructive",
  rejeitada: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  denegada: "bg-destructive/20 text-destructive",
};

export const IMPOSTO_LABEL: Record<ImpostoTipo, string> = {
  iss: "ISS", pis: "PIS", cofins: "COFINS",
  irpj: "IRPJ", csll: "CSLL", das: "DAS Simples",
  inss: "INSS", irrf: "IRRF",
};

export const REGIME_LABEL: Record<RegimeTributario, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};
