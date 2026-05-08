// Dados mock corporativos do módulo de Licitações.
// Usado apenas para a camada visual/UX. Nenhuma regra de negócio definitiva.

export type StatusLicitacao =
  | "oportunidade"
  | "em_analise"
  | "parecer_tecnico"
  | "parecer_gerencial"
  | "controladoria"
  | "aprovacao_diretoria"
  | "aprovacao_presidencia"
  | "pregao"
  | "vencida"
  | "perdida"
  | "suspensa";

export type Criticidade = "baixa" | "media" | "alta" | "critica";

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  sigla: string;
}

export interface Licitacao {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  modalidade: string;
  empresa: string;
  responsavel: string;
  status: StatusLicitacao;
  criticidade: Criticidade;
  valorEstimado: number;
  prazo: string;
  abertura: string;
  ultimaAcao: string;
}

export const empresas: Empresa[] = [
  { id: "e1", nome: "Nascimento Engenharia S.A.", cnpj: "12.345.678/0001-90", sigla: "NEN" },
  { id: "e2", nome: "Nascimento Serviços Ltda.", cnpj: "12.345.678/0002-71", sigla: "NSV" },
  { id: "e3", nome: "Nascimento Infraestrutura", cnpj: "12.345.678/0003-52", sigla: "NIF" },
  { id: "e4", nome: "Nascimento Tecnologia", cnpj: "12.345.678/0004-33", sigla: "NTC" },
];

// Carga real (grade de licitações - planilha 2026, 288 itens, empresa HAGG).
import gradeMock from "./licitacoesGradeMock.json";

export const licitacoes: Licitacao[] = (gradeMock as unknown as Licitacao[]);

// Mantemos os mocks legados desativados abaixo para histórico (não exportados).
const _legadoLicitacoes: Licitacao[] = [
  {
    id: "L-2025-0142",
    numero: "PE 142/2025",
    objeto: "Operação e manutenção de unidades de tratamento de esgoto — Lote 03",
    orgao: "SABESP — Companhia de Saneamento",
    modalidade: "Pregão Eletrônico",
    empresa: "NEN",
    responsavel: "Ana Carvalho",
    status: "controladoria",
    criticidade: "alta",
    valorEstimado: 18_420_000,
    prazo: "2025-05-12",
    abertura: "2025-05-19",
    ultimaAcao: "Revisão de margem em andamento",
  },
  {
    id: "L-2025-0137",
    numero: "PE 077/2025",
    objeto: "Construção de via marginal e drenagem urbana — trecho B",
    orgao: "Prefeitura Municipal de Curitiba",
    modalidade: "Pregão Eletrônico",
    empresa: "NIF",
    responsavel: "Juliana Reis",
    status: "aprovacao_diretoria",
    criticidade: "critica",
    valorEstimado: 42_900_000,
    prazo: "2025-05-04",
    abertura: "2025-05-11",
    ultimaAcao: "Encaminhada à diretoria administrativa",
  },
  {
    id: "L-2025-0134",
    numero: "PE 058/2025",
    objeto: "Locação e operação de software de gestão patrimonial",
    orgao: "Tribunal de Contas — TCE-SP",
    modalidade: "Pregão Eletrônico",
    empresa: "NTC",
    responsavel: "Rafael Souza",
    status: "em_analise",
    criticidade: "media",
    valorEstimado: 3_240_000,
    prazo: "2025-05-22",
    abertura: "2025-05-29",
    ultimaAcao: "Triagem por IA concluída",
  },
  {
    id: "L-2025-0131",
    numero: "RDC 012/2025",
    objeto: "Reforma e modernização de estação elevatória — fase 2",
    orgao: "CEDAE",
    modalidade: "RDC",
    empresa: "NEN",
    responsavel: "Ana Carvalho",
    status: "pregao",
    criticidade: "alta",
    valorEstimado: 11_750_000,
    prazo: "2025-04-30",
    abertura: "2025-05-06",
    ultimaAcao: "Sessão pública iniciada",
  },
  {
    id: "L-2025-0128",
    numero: "PE 044/2025",
    objeto: "Serviços de limpeza urbana e coleta seletiva — Lote 1",
    orgao: "Prefeitura de Salvador",
    modalidade: "Pregão Eletrônico",
    empresa: "NSV",
    responsavel: "Marcos Pinto",
    status: "vencida",
    criticidade: "alta",
    valorEstimado: 28_300_000,
    prazo: "2025-04-22",
    abertura: "2025-04-29",
    ultimaAcao: "Pronta para migração ao módulo de contratos",
  },
  {
    id: "L-2025-0125",
    numero: "PE 031/2025",
    objeto: "Fornecimento de uniformes operacionais",
    orgao: "Petrobras Distribuidora",
    modalidade: "Pregão Eletrônico",
    empresa: "NSV",
    responsavel: "Carlos Mendes",
    status: "perdida",
    criticidade: "baixa",
    valorEstimado: 980_000,
    prazo: "2025-04-15",
    abertura: "2025-04-22",
    ultimaAcao: "Resultado registrado",
  },
  {
    id: "L-2025-0122",
    numero: "TP 008/2025",
    objeto: "Projeto executivo de reservatório de água tratada",
    orgao: "Companhia de Águas — CAGECE",
    modalidade: "Tomada de Preços",
    empresa: "NIF",
    responsavel: "Juliana Reis",
    status: "parecer_tecnico",
    criticidade: "media",
    valorEstimado: 2_640_000,
    prazo: "2025-05-25",
    abertura: "2025-06-02",
    ultimaAcao: "Parecer técnico em redação",
  },
  {
    id: "L-2025-0119",
    numero: "PE 022/2025",
    objeto: "Operação assistida de infraestrutura de TI — data center",
    orgao: "BNDES",
    modalidade: "Pregão Eletrônico",
    empresa: "NTC",
    responsavel: "Rafael Souza",
    status: "oportunidade",
    criticidade: "alta",
    valorEstimado: 14_120_000,
    prazo: "2025-06-04",
    abertura: "2025-06-11",
    ultimaAcao: "Edital identificado — aguardando triagem",
  },
  {
    id: "L-2025-0116",
    numero: "PE 015/2025",
    objeto: "Conservação de rodovia federal — trecho 412",
    orgao: "DNIT",
    modalidade: "Pregão Eletrônico",
    empresa: "NIF",
    responsavel: "Juliana Reis",
    status: "suspensa",
    criticidade: "critica",
    valorEstimado: 56_400_000,
    prazo: "2025-05-30",
    abertura: "2025-06-09",
    ultimaAcao: "Suspensa por impugnação",
  },
];

export const statusLabel: Record<StatusLicitacao, string> = {
  oportunidade: "Oportunidade",
  em_analise: "Em análise",
  parecer_tecnico: "Parecer técnico",
  parecer_gerencial: "Parecer gerencial",
  controladoria: "Controladoria",
  aprovacao_diretoria: "Aprov. Diretoria",
  aprovacao_presidencia: "Aprov. Presidência",
  pregao: "Em pregão",
  vencida: "Vencida",
  perdida: "Perdida",
  suspensa: "Suspensa",
};

export const statusOrdem: StatusLicitacao[] = [
  "oportunidade",
  "em_analise",
  "parecer_tecnico",
  "parecer_gerencial",
  "controladoria",
  "aprovacao_diretoria",
  "aprovacao_presidencia",
  "pregao",
  "vencida",
  "perdida",
  "suspensa",
];

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
