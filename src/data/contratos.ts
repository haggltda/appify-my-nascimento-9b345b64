// Dados mock para o submódulo Contratos (UI only).
// Estrutura preparada para futura integração com Controladoria, Suprimentos e BDI.

export type StatusContrato = "implantacao" | "ativo" | "suspenso" | "encerrado";
export type StatusEmpenho = "vigente" | "parcial" | "exaurido" | "cancelado";

export interface Empenho {
  id: string;
  codigo: string;
  data: string;
  valor: number;
  area: string;
  orgao: string;
  status: StatusEmpenho;
  saldoUtilizado?: number;
}

export interface Posto {
  id: string;
  cargo: string;
  quantidade: number;
  local: string;
  jornada: string;
  salarioBase: number;
  va: number;
  vt: number;
  uniformes: number;
  epis: number;
  insalubridade?: number;
  periculosidade?: number;
  observacoes?: string;
}

export interface Verba {
  rubrica: string;
  percentual: number;
  base: "salario" | "total";
}

export interface ComposicaoCusto {
  postos: Posto[];
  verbasFolha: Verba[];
  custosIndiretos: { item: string; valor: number }[];
  tributos: { rubrica: string; aliquota: number }[];
  margemLucro: number; // percentual desejado
  bdi?: number; // calculado
}

export interface Contrato {
  id: string;
  numero: string;
  origemLicitacao: string;
  objeto: string;
  orgao: string;
  empresa: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  valorTotal: number;
  status: StatusContrato;
  gestor: string;
  empenhos: Empenho[];
  postos: number;
  faturamentoMensal: number;
}

export const contratos: Contrato[] = [
  {
    id: "c1",
    numero: "CT 2025/0118",
    origemLicitacao: "PE 044/2025",
    objeto: "Limpeza urbana e coleta seletiva - Zona Sul",
    orgao: "Prefeitura Municipal - SLU",
    empresa: "NSV",
    vigenciaInicio: "2025-03-01",
    vigenciaFim: "2026-02-28",
    valorTotal: 28_300_000,
    status: "ativo",
    gestor: "Marcos R. Tavares",
    postos: 184,
    faturamentoMensal: 2_358_333,
    empenhos: [
      { id: "e1", codigo: "2025NE000128", data: "2025-02-20", valor: 14_150_000, area: "Secretaria de Limpeza Urbana", orgao: "PMSP", status: "parcial", saldoUtilizado: 6_120_000 },
      { id: "e2", codigo: "2025NE000412", data: "2025-08-12", valor: 14_150_000, area: "Secretaria de Limpeza Urbana", orgao: "PMSP", status: "vigente", saldoUtilizado: 0 },
    ],
  },
  {
    id: "c2",
    numero: "CT 2025/0094",
    origemLicitacao: "RDC 008/2025",
    objeto: "Conservação de rodovia BR-XXX - Lote 3",
    orgao: "DNIT - Superintendência Regional",
    empresa: "NEN",
    vigenciaInicio: "2025-01-15",
    vigenciaFim: "2027-01-14",
    valorTotal: 47_900_000,
    status: "implantacao",
    gestor: "Rita C. Albuquerque",
    postos: 92,
    faturamentoMensal: 1_995_833,
    empenhos: [
      { id: "e3", codigo: "2025NE000061", data: "2025-01-10", valor: 23_950_000, area: "Coord. de Manutenção Rodoviária", orgao: "DNIT", status: "vigente" },
    ],
  },
  {
    id: "c3",
    numero: "CT 2024/0076",
    origemLicitacao: "PE 091/2024",
    objeto: "Vigilância patrimonial armada - Edifícios Sede",
    orgao: "Tribunal de Contas Estadual",
    empresa: "NSV",
    vigenciaInicio: "2024-06-01",
    vigenciaFim: "2025-05-31",
    valorTotal: 8_640_000,
    status: "encerrado",
    gestor: "André L. Pacheco",
    postos: 36,
    faturamentoMensal: 720_000,
    empenhos: [
      { id: "e4", codigo: "2024NE001088", data: "2024-05-28", valor: 8_640_000, area: "Diretoria Administrativa", orgao: "TCE", status: "exaurido", saldoUtilizado: 8_640_000 },
    ],
  },
];

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const statusContratoLabel: Record<StatusContrato, string> = {
  implantacao: "Implantação",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const statusEmpenhoLabel: Record<StatusEmpenho, string> = {
  vigente: "Vigente",
  parcial: "Parcial",
  exaurido: "Exaurido",
  cancelado: "Cancelado",
};
