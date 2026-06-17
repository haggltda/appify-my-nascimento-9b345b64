export type TituloStatus = "aberto" | "parcial" | "pago" | "vencido" | "cancelado" | "agendado";
export type MeioCobranca = "boleto" | "pix" | "ted" | "dinheiro" | "deposito" | "cartao" | "outro";
export type ReguaCanal = "email" | "whatsapp" | "sms" | "ligacao" | "protesto" | "serasa" | "negativacao" | "interno";
export type ReguaEtapaStatus = "pendente" | "executada" | "falhou" | "cancelada" | "reagendada";

export interface Titulo {
  id: string;
  empresa_id: string;
  numero: string | null;
  numero_documento: string;
  sacado_nome: string;
  sacado_documento: string | null;
  sacado_email: string | null;
  contrato_id: string | null;
  competencia: string;
  data_emissao: string;
  data_vencimento: string;
  data_recebimento: string | null;
  valor: number;
  valor_recebido: number;
  valor_juros: number;
  valor_multa: number;
  valor_desconto: number;
  status: TituloStatus;
  meio_cobranca: MeioCobranca;
  conta_bancaria_id: string | null;
  centro_custo_id: string | null;
  descricao: string | null;
  observacoes: string | null;
}

export interface Baixa {
  id: string;
  titulo_id: string;
  data_baixa: string;
  valor: number;
  valor_juros: number;
  valor_multa: number;
  valor_desconto: number;
  meio: MeioCobranca;
  conta_bancaria_id: string | null;
  observacoes: string | null;
  created_at: string;
}
