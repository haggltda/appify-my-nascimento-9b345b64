// =============================================================================
// MOCK do Planejador Orçamentário OBZ
// Cada linha contempla TODAS as dimensões obrigatórias da especificação.
// Origem "baseline_licitacao" implica bloqueado_origem=true e exige fluxo de
// destravamento sob senha para sofrer revisão.
// =============================================================================

import type { DriverOBZ, GrupoGerencial, NaturezaResultado, DiretoIndireto, FixoVariavel, SubgrupoFolhaOperacao } from "./controladoria";

export type OrigemOrcamento =
  | "baseline_licitacao"
  | "obz"
  | "forecast"
  | "revisao_controladoria";

export type StatusAprovacao =
  | "rascunho"
  | "em_aprovacao"
  | "aprovado"
  | "reprovado";

export type RegimeOrcamentario = "competencia" | "caixa";

export type TipoConta = "analitica" | "sintetica";

export interface LinhaOrcamento {
  id: string;

  // dimensões organizacionais
  empresaId: string;
  contratoId: string | null;
  centroCustoId: string;
  areaId: string;
  departamentoId: string;
  gestorId: string;
  diretorId: string;
  presidenciaFlag: boolean;

  // conta
  contaReduzida: string;
  classificacaoContabil: string;
  descricaoConta: string;
  tipoConta: TipoConta;
  naturezaConta: NaturezaResultado;
  linhaDRE: string;

  // gerencial
  naturezaResultado: NaturezaResultado;
  grupoGerencial: GrupoGerencial;
  diretoIndireto: DiretoIndireto;
  fixoVariavel: FixoVariavel;
  subgrupoFolhaOperacao: SubgrupoFolhaOperacao;

  // tempo
  regimeOrcamentario: RegimeOrcamentario;
  competenciaYYYYMM: string; // "2026-01"
  dataCaixaPrevista: string; // ISO

  // driver
  driverTipo: DriverOBZ;
  driverQtd: number;
  driverValorUnitario: number;
  driverPercentual: number;

  // valores
  valorOrcado: number;
  valorCaixa: number;

  // governança
  origemOrcamento: OrigemOrcamento;
  versaoOrcamento: string;
  bloqueadoOrigem: boolean;
  statusAprovacao: StatusAprovacao;
  aprovadorAtual: string;
  justificativa: string;
  evidencias: string[];
  revisaoSobSenha: boolean;
  usuarioUltimaRevisao: string;
  timestampUltimaRevisao: string; // ISO
}

export const linhasOrcamento: LinhaOrcamento[] = [
  {
    id: "orc-001",
    empresaId: "HAGG",
    contratoId: "CT 2026/0118",
    centroCustoId: "CC.CONTR.HAGG.2026.001",
    areaId: "OPERACOES",
    departamentoId: "LIMPEZA_URBANA",
    gestorId: "marcos.tavares",
    diretorId: "diretoria.operacional",
    presidenciaFlag: false,
    contaReduzida: "04.1.3.02.001",
    classificacaoContabil: "Custo / Pessoal Operacional",
    descricaoConta: "Salários — Postos Operacionais",
    tipoConta: "analitica",
    naturezaConta: "custo",
    linhaDRE: "L04",
    naturezaResultado: "custo",
    grupoGerencial: "CUSTO_DIRETO_PESSOAL",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_ao_quadro",
    subgrupoFolhaOperacao: "folha",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-02-05",
    driverTipo: "headcount_mensal",
    driverQtd: 184,
    driverValorUnitario: 2_650,
    driverPercentual: 0,
    valorOrcado: 487_600,
    valorCaixa: 487_600,
    origemOrcamento: "baseline_licitacao",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: true,
    statusAprovacao: "aprovado",
    aprovadorAtual: "controladoria",
    justificativa: "Baseline gerada pela proposta vencedora PE 044/2025.",
    evidencias: ["PE 044/2025", "Composição BDI v1"],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "sistema",
    timestampUltimaRevisao: "2025-12-20T14:30:00Z",
  },
  {
    id: "orc-002",
    empresaId: "HAGG",
    contratoId: "CT 2026/0118",
    centroCustoId: "CC.CONTR.HAGG.2026.001",
    areaId: "OPERACOES",
    departamentoId: "LIMPEZA_URBANA",
    gestorId: "marcos.tavares",
    diretorId: "diretoria.operacional",
    presidenciaFlag: false,
    contaReduzida: "04.1.3.02.002",
    classificacaoContabil: "Custo / Encargos Operacionais",
    descricaoConta: "Encargos Sociais (INSS/FGTS) — Operação",
    tipoConta: "analitica",
    naturezaConta: "custo",
    linhaDRE: "L04",
    naturezaResultado: "custo",
    grupoGerencial: "CUSTO_DIRETO_PESSOAL",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_ao_quadro",
    subgrupoFolhaOperacao: "folha",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-02-20",
    driverTipo: "folha_percentual",
    driverQtd: 0,
    driverValorUnitario: 0,
    driverPercentual: 36.8,
    valorOrcado: 179_437,
    valorCaixa: 179_437,
    origemOrcamento: "baseline_licitacao",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: true,
    statusAprovacao: "aprovado",
    aprovadorAtual: "controladoria",
    justificativa: "Aderente ao percentual aprovado na composição.",
    evidencias: ["Composição BDI v1"],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "sistema",
    timestampUltimaRevisao: "2025-12-20T14:30:00Z",
  },
  {
    id: "orc-003",
    empresaId: "HAGG",
    contratoId: "CT 2026/0118",
    centroCustoId: "CC.CONTR.HAGG.2026.001",
    areaId: "OPERACOES",
    departamentoId: "LIMPEZA_URBANA",
    gestorId: "marcos.tavares",
    diretorId: "diretoria.operacional",
    presidenciaFlag: false,
    contaReduzida: "04.1.3.03.001",
    classificacaoContabil: "Custo / Insumos",
    descricaoConta: "Uniformes e EPIs",
    tipoConta: "analitica",
    naturezaConta: "custo",
    linhaDRE: "L05",
    naturezaResultado: "custo",
    grupoGerencial: "CUSTO_DIRETO_OPERACIONAL",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_consumo",
    subgrupoFolhaOperacao: "operacao",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-01-25",
    driverTipo: "consumo_quantidade_x_preco",
    driverQtd: 184,
    driverValorUnitario: 145,
    driverPercentual: 0,
    valorOrcado: 26_680,
    valorCaixa: 26_680,
    origemOrcamento: "baseline_licitacao",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: true,
    statusAprovacao: "aprovado",
    aprovadorAtual: "controladoria",
    justificativa: "Cota mensal por colaborador conforme edital.",
    evidencias: ["Anexo III — Edital"],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "sistema",
    timestampUltimaRevisao: "2025-12-20T14:30:00Z",
  },
  {
    id: "orc-004",
    empresaId: "HAGG",
    contratoId: null,
    centroCustoId: "ADM.003",
    areaId: "ADMINISTRATIVO",
    departamentoId: "CONTROLADORIA",
    gestorId: "controladoria",
    diretorId: "diretoria.administrativa",
    presidenciaFlag: false,
    contaReduzida: "04.2.1.01.001",
    classificacaoContabil: "Despesa / Pessoal ADM",
    descricaoConta: "Salários — Administrativo",
    tipoConta: "analitica",
    naturezaConta: "despesa",
    linhaDRE: "L07",
    naturezaResultado: "despesa",
    grupoGerencial: "DESPESA_ADMIN_PESSOAL",
    diretoIndireto: "indireto",
    fixoVariavel: "predominantemente_fixo",
    subgrupoFolhaOperacao: "folha",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-02-05",
    driverTipo: "headcount_mensal",
    driverQtd: 6,
    driverValorUnitario: 9_800,
    driverPercentual: 0,
    valorOrcado: 58_800,
    valorCaixa: 58_800,
    origemOrcamento: "obz",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: false,
    statusAprovacao: "em_aprovacao",
    aprovadorAtual: "diretoria.administrativa",
    justificativa: "OBZ recosturado para 2026.",
    evidencias: [],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "ana.carvalho",
    timestampUltimaRevisao: "2026-01-08T10:14:00Z",
  },
  {
    id: "orc-005",
    empresaId: "HAGG",
    contratoId: null,
    centroCustoId: "ADM.001",
    areaId: "ADMINISTRATIVO",
    departamentoId: "ADM_GERAL",
    gestorId: "diretoria.administrativa",
    diretorId: "diretoria.administrativa",
    presidenciaFlag: false,
    contaReduzida: "04.2.1.03.001",
    classificacaoContabil: "Despesa / Geral",
    descricaoConta: "Aluguel da Sede",
    tipoConta: "analitica",
    naturezaConta: "despesa",
    linhaDRE: "L08",
    naturezaResultado: "despesa",
    grupoGerencial: "DESPESA_ADMIN_GERAL",
    diretoIndireto: "indireto",
    fixoVariavel: "predominantemente_fixo",
    subgrupoFolhaOperacao: "n/a",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-01-10",
    driverTipo: "valor_fixo_mensal",
    driverQtd: 1,
    driverValorUnitario: 38_500,
    driverPercentual: 0,
    valorOrcado: 38_500,
    valorCaixa: 38_500,
    origemOrcamento: "obz",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: false,
    statusAprovacao: "rascunho",
    aprovadorAtual: "controladoria",
    justificativa: "",
    evidencias: [],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "ana.carvalho",
    timestampUltimaRevisao: "2026-01-09T17:02:00Z",
  },
  {
    id: "orc-006",
    empresaId: "SN",
    contratoId: "CT 2026/0044",
    centroCustoId: "CC.CONTR.SN.2026.001",
    areaId: "OPERACOES",
    departamentoId: "ZELADORIA",
    gestorId: "rita.albuquerque",
    diretorId: "diretoria.operacional",
    presidenciaFlag: false,
    contaReduzida: "04.1.3.02.001",
    classificacaoContabil: "Custo / Pessoal Operacional",
    descricaoConta: "Salários — Postos Operacionais",
    tipoConta: "analitica",
    naturezaConta: "custo",
    linhaDRE: "L04",
    naturezaResultado: "custo",
    grupoGerencial: "CUSTO_DIRETO_PESSOAL",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_ao_quadro",
    subgrupoFolhaOperacao: "folha",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-02-05",
    driverTipo: "headcount_mensal",
    driverQtd: 92,
    driverValorUnitario: 2_400,
    driverPercentual: 0,
    valorOrcado: 220_800,
    valorCaixa: 220_800,
    origemOrcamento: "baseline_licitacao",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: true,
    statusAprovacao: "aprovado",
    aprovadorAtual: "controladoria",
    justificativa: "Baseline RDC 008/2025.",
    evidencias: ["RDC 008/2025"],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "sistema",
    timestampUltimaRevisao: "2025-12-22T11:00:00Z",
  },
  {
    id: "orc-007",
    empresaId: "SN",
    contratoId: null,
    centroCustoId: "ADM.008",
    areaId: "COMERCIAL",
    departamentoId: "LICITACOES",
    gestorId: "comercial.licit",
    diretorId: "diretoria.administrativa",
    presidenciaFlag: false,
    contaReduzida: "04.2.2.03.001",
    classificacaoContabil: "Despesa / Comercial",
    descricaoConta: "Custos de Participação em Licitações",
    tipoConta: "analitica",
    naturezaConta: "despesa",
    linhaDRE: "L09",
    naturezaResultado: "despesa",
    grupoGerencial: "DESPESA_COMERCIAL_LICITACOES",
    diretoIndireto: "indireto",
    fixoVariavel: "variavel_pipeline",
    subgrupoFolhaOperacao: "n/a",
    regimeOrcamentario: "caixa",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-01-15",
    driverTipo: "valor_eventual_unico",
    driverQtd: 1,
    driverValorUnitario: 12_400,
    driverPercentual: 0,
    valorOrcado: 12_400,
    valorCaixa: 12_400,
    origemOrcamento: "forecast",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: false,
    statusAprovacao: "rascunho",
    aprovadorAtual: "controladoria",
    justificativa: "Pipeline previsto para Q1.",
    evidencias: [],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "ana.carvalho",
    timestampUltimaRevisao: "2026-01-09T17:02:00Z",
  },
  {
    id: "orc-008",
    empresaId: "NH",
    contratoId: "CT 2026/0011",
    centroCustoId: "CC.CONTR.NH.2026.001",
    areaId: "OPERACOES",
    departamentoId: "FROTA",
    gestorId: "andre.pacheco",
    diretorId: "diretoria.operacional",
    presidenciaFlag: false,
    contaReduzida: "04.1.3.03.003",
    classificacaoContabil: "Custo / Operação",
    descricaoConta: "Combustível e Manutenção de Frota",
    tipoConta: "analitica",
    naturezaConta: "custo",
    linhaDRE: "L05",
    naturezaResultado: "custo",
    grupoGerencial: "CUSTO_DIRETO_OPERACIONAL",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_consumo",
    subgrupoFolhaOperacao: "operacao",
    regimeOrcamentario: "competencia",
    competenciaYYYYMM: "2026-01",
    dataCaixaPrevista: "2026-02-10",
    driverTipo: "consumo_quantidade_x_preco",
    driverQtd: 14_500,
    driverValorUnitario: 6.18,
    driverPercentual: 0,
    valorOrcado: 89_610,
    valorCaixa: 89_610,
    origemOrcamento: "baseline_licitacao",
    versaoOrcamento: "v1.0",
    bloqueadoOrigem: true,
    statusAprovacao: "aprovado",
    aprovadorAtual: "controladoria",
    justificativa: "Consumo mensal estimado (litros × preço).",
    evidencias: ["Estudo Logístico v3"],
    revisaoSobSenha: false,
    usuarioUltimaRevisao: "sistema",
    timestampUltimaRevisao: "2025-12-22T11:00:00Z",
  },
];

export const labelOrigem: Record<OrigemOrcamento, string> = {
  baseline_licitacao: "Baseline (Licitação)",
  obz: "OBZ",
  forecast: "Forecast",
  revisao_controladoria: "Revisão Controladoria",
};

export const labelStatus: Record<StatusAprovacao, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Em aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export const labelDriver: Record<DriverOBZ, string> = {
  headcount_mensal: "Headcount mensal",
  folha_percentual: "Folha (%)",
  beneficio_por_colaborador: "Benefício/colab.",
  consumo_quantidade_x_preco: "Qtd × Preço",
  valor_fixo_mensal: "Fixo mensal",
  valor_eventual_unico: "Eventual único",
  percentual_da_receita: "% da receita",
  curva_sazonal: "Curva sazonal",
  mobilizacao_desmobilizacao: "Mobil./Desmob.",
};
