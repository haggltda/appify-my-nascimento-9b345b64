// =============================================================================
// CATÁLOGOS MESTRES CONGELADOS - Grupo Nascimento
// FASE: front-end mock. Sem backend. Tipagem preparada para mapeamento 1:1
// futuro com empresa_id, contrato_id, centro_custo_id e conta_id.
// REGRA: não inventar contas fora deste catálogo. Não alterar linhas oficiais
// da DRE. 04A é SUBGRUPO_GERENCIAL (PENDENCIA_CONTROLADORIA).
// =============================================================================

// ----------------------------- EMPRESAS DO GRUPO -----------------------------

export type RegimeTributario =
  | "Lucro Real"
  | "Simples Nacional"
  | "Entidade sem fins lucrativos"
  | "A confirmar";

export type PapelEmpresa =
  | "Operacional/faturamento/contratos"
  | "Apoio operacional"
  | "Institucional"
  | "Intercompany/estrutura";

export interface EmpresaGrupo {
  id: string;            // id curto interno (HAGG, SN, NH, CANAA, AGPS, LF)
  sigla: string;
  razao: string;
  cnpj: string;
  regime: RegimeTributario;
  papel: PapelEmpresa | string;
  validacaoDocumentalObrigatoria: boolean;
  observacao?: string;
}

export const empresasGrupo: EmpresaGrupo[] = [
  {
    id: "HAGG",
    sigla: "HAGG",
    razao: "Nascimento Serviços de Limpeza Ltda",
    cnpj: "03.644.009/0001-23",
    regime: "Lucro Real",
    papel: "Operacional/faturamento/contratos",
    validacaoDocumentalObrigatoria: false,
  },
  {
    id: "SN",
    sigla: "SN",
    razao: "SN Serviços de Limpeza e Zeladoria Predial Ltda",
    cnpj: "17.290.783/0001-98",
    regime: "Lucro Real",
    papel: "Operacional/faturamento/contratos",
    validacaoDocumentalObrigatoria: false,
  },
  {
    id: "NH",
    sigla: "NH",
    razao: "NH Prestação de Serviços Ltda",
    cnpj: "18.615.832/0001-88",
    regime: "Simples Nacional",
    papel: "Apoio operacional",
    validacaoDocumentalObrigatoria: true,
  },
  {
    id: "CANAA",
    sigla: "CANAÃ",
    razao: "Instituto de Ensino Canaã",
    cnpj: "24.354.749/0001-03",
    regime: "Entidade sem fins lucrativos",
    papel: "Institucional",
    validacaoDocumentalObrigatoria: false,
  },
  {
    id: "AGPS",
    sigla: "AGPS",
    razao: "AGPS Administradora e Participações Ltda",
    cnpj: "29.722.947/0001-98",
    regime: "A confirmar",
    papel: "Intercompany/estrutura",
    validacaoDocumentalObrigatoria: true,
  },
  {
    id: "LF",
    sigla: "LF",
    razao: "LF Zeladoria Ltda",
    cnpj: "cadastro a validar",
    regime: "A confirmar",
    papel: "aparece em arquivos operacionais",
    validacaoDocumentalObrigatoria: true,
    observacao: "Cadastro pendente de validação documental.",
  },
];

// ------------------------------- LINHAS DA DRE -------------------------------

export type NaturezaResultado = "receita" | "custo" | "despesa" | "balanco";

export interface LinhaDRE {
  codigo: string;          // L01..L14
  descricao: string;
  natureza: NaturezaResultado | "subtotal";
  oficial: boolean;        // sempre true para L01..L14; false para auxiliares
  ordem: number;
}

export const linhasDRE: LinhaDRE[] = [
  { codigo: "L01", descricao: "Receita Bruta de Serviços", natureza: "receita", oficial: true, ordem: 1 },
  { codigo: "L02", descricao: "(-) Deduções da Receita Bruta", natureza: "despesa", oficial: true, ordem: 2 },
  { codigo: "L03", descricao: "(=) Receita Líquida", natureza: "subtotal", oficial: true, ordem: 3 },
  { codigo: "L04", descricao: "(-) Custos Diretos de Pessoal dos Contratos", natureza: "custo", oficial: true, ordem: 4 },
  { codigo: "L05", descricao: "(-) Custos Diretos Operacionais dos Contratos", natureza: "custo", oficial: true, ordem: 5 },
  { codigo: "L06", descricao: "(=) Margem Bruta dos Contratos", natureza: "subtotal", oficial: true, ordem: 6 },
  { codigo: "L07", descricao: "(-) Despesas Administrativas de Pessoal", natureza: "despesa", oficial: true, ordem: 7 },
  { codigo: "L08", descricao: "(-) Despesas Administrativas e Gerais", natureza: "despesa", oficial: true, ordem: 8 },
  { codigo: "L09", descricao: "(-) Despesas Comerciais / Licitações", natureza: "despesa", oficial: true, ordem: 9 },
  { codigo: "L10", descricao: "(=) EBITDA Gerencial", natureza: "subtotal", oficial: true, ordem: 10 },
  { codigo: "L11", descricao: "(+/-) Resultado Financeiro", natureza: "despesa", oficial: true, ordem: 11 },
  { codigo: "L12", descricao: "(=) Resultado Antes de IRPJ/CSLL", natureza: "subtotal", oficial: true, ordem: 12 },
  { codigo: "L13", descricao: "(-) IRPJ / CSLL / provisões do lucro", natureza: "despesa", oficial: true, ordem: 13 },
  { codigo: "L14", descricao: "(=) Resultado Líquido / Superávit ou Déficit", natureza: "subtotal", oficial: true, ordem: 14 },
];

// Subgrupo gerencial auxiliar (NÃO é linha oficial)
export const subgrupoAuxiliar04A = {
  codigo: "04A",
  descricao: "Custos de Mercadorias/Estoques",
  vinculaLinha: "L05",
  status: "PENDENCIA_CONTROLADORIA" as const,
  observacao:
    "Subgrupo gerencial auxiliar. Não promover a linha oficial sem aprovação humana.",
};

// ------------------------- CENTROS DE CUSTO ADMINISTRATIVOS -------------------

export interface CentroCustoADM {
  codigo: string;
  nome: string;
  natureza: "ADM";
}

export const centrosCustoADM: CentroCustoADM[] = [
  { codigo: "ADM.001", nome: "ADMINISTRATIVO GERAL", natureza: "ADM" },
  { codigo: "ADM.002", nome: "FINANCEIRO", natureza: "ADM" },
  { codigo: "ADM.003", nome: "CONTROLADORIA", natureza: "ADM" },
  { codigo: "ADM.004", nome: "CONTÁBIL/FISCAL", natureza: "ADM" },
  { codigo: "ADM.005", nome: "RH ADMINISTRATIVO", natureza: "ADM" },
  { codigo: "ADM.006", nome: "SUPRIMENTOS / COMPRAS", natureza: "ADM" },
  { codigo: "ADM.007", nome: "ALMOXARIFADO / ESTOQUE CENTRAL", natureza: "ADM" },
  { codigo: "ADM.008", nome: "LICITAÇÕES / COMERCIAL", natureza: "ADM" },
  { codigo: "ADM.009", nome: "JURÍDICO", natureza: "ADM" },
  { codigo: "ADM.010", nome: "TECNOLOGIA / SISTEMAS", natureza: "ADM" },
  { codigo: "ADM.011", nome: "DIRETORIA ADMINISTRATIVA", natureza: "ADM" },
  { codigo: "ADM.012", nome: "PRESIDÊNCIA", natureza: "ADM" },
  { codigo: "ADM.013", nome: "SÓCIOS - HELENA", natureza: "ADM" },
  { codigo: "ADM.014", nome: "SÓCIOS - ANTONIO", natureza: "ADM" },
  { codigo: "ADM.015", nome: "SÓCIOS - CARLOS EDUARDO", natureza: "ADM" },
  { codigo: "ADM.016", nome: "SÓCIOS - GUIOMAR", natureza: "ADM" },
  { codigo: "ADM.017", nome: "SÓCIOS - SENILTON", natureza: "ADM" },
  { codigo: "ADM.018", nome: "MOVIMENTAÇÕES FINANCEIRAS", natureza: "ADM" },
  { codigo: "ADM.019", nome: "INTERCOMPANY / MÚTUOS", natureza: "ADM" },
  { codigo: "ADM.020", nome: "CANAA ADMINISTRAÇÃO", natureza: "ADM" },
  { codigo: "ADM.021", nome: "DIRETORIA OPERACIONAL", natureza: "ADM" },
];

// Centros de custo CONTRATUAIS - gerados ao validar contrato.
// Formato: CC.CONTR.<EMPRESA>.<ANO>.<SEQUENCIAL>
export interface CentroCustoContratual {
  codigo: string;
  nome: string;
  empresaId: string;
  contratoNumero: string;
  ano: number;
  sequencial: number;
  status: "ativo" | "encerrado";
}

export const centrosCustoContratuais: CentroCustoContratual[] = [
  {
    codigo: "CC.CONTR.HAGG.2026.001",
    nome: "HAGG - Limpeza Urbana Zona Sul",
    empresaId: "HAGG",
    contratoNumero: "CT 2026/0118",
    ano: 2026,
    sequencial: 1,
    status: "ativo",
  },
  {
    codigo: "CC.CONTR.HAGG.2026.002",
    nome: "HAGG - Conservação Predial DPE",
    empresaId: "HAGG",
    contratoNumero: "CT 2026/0119",
    ano: 2026,
    sequencial: 2,
    status: "ativo",
  },
  {
    codigo: "CC.CONTR.SN.2026.001",
    nome: "SN - Zeladoria Predial Sede TJ",
    empresaId: "SN",
    contratoNumero: "CT 2026/0044",
    ano: 2026,
    sequencial: 1,
    status: "ativo",
  },
  {
    codigo: "CC.CONTR.NH.2026.001",
    nome: "NH - Apoio Operacional Frota",
    empresaId: "NH",
    contratoNumero: "CT 2026/0011",
    ano: 2026,
    sequencial: 1,
    status: "ativo",
  },
];

export const proximoCodigoContratual = (
  empresaId: string,
  ano: number,
): string => {
  const sequenciais = centrosCustoContratuais
    .filter((c) => c.empresaId === empresaId && c.ano === ano)
    .map((c) => c.sequencial);
  const next = (sequenciais.length ? Math.max(...sequenciais) : 0) + 1;
  return `CC.CONTR.${empresaId}.${ano}.${String(next).padStart(3, "0")}`;
};

// --------------------- CLASSIFICADORES GERENCIAIS POR PREFIXO ----------------

export type GrupoGerencial =
  | "RECEITA"
  | "CUSTO_DIRETO_PESSOAL"
  | "CUSTO_DIRETO_OPERACIONAL"
  | "DESPESA_ADMIN_PESSOAL"
  | "DESPESA_ADMIN_GERAL"
  | "DESPESA_COMERCIAL_LICITACOES"
  | "DESPESA_FINANCEIRA"
  | "RECEITA_FINANCEIRA"
  | "TRIBUTOS_NAO_RECUPERAVEIS_OUTRAS_DESPESAS"
  | "MULTAS_CONTINGENCIAS";

export type DiretoIndireto = "direto" | "indireto";
export type FixoVariavel =
  | "variavel_ao_quadro"
  | "variavel_consumo"
  | "predominantemente_fixo"
  | "variavel_pipeline"
  | "variavel_financeira"
  | "eventual";
export type SubgrupoFolhaOperacao = "folha" | "operacao" | "n/a";

export interface ClassificadorGerencial {
  prefixo: string;
  grupoGerencial: GrupoGerencial;
  natureza: NaturezaResultado;
  diretoIndireto: DiretoIndireto;
  fixoVariavel: FixoVariavel;
  subgrupoFolhaOperacao: SubgrupoFolhaOperacao;
  linhaDRE: string; // L01..L14
}

export const classificadores: ClassificadorGerencial[] = [
  {
    prefixo: "03.*",
    grupoGerencial: "RECEITA",
    natureza: "receita",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_pipeline",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L01",
  },
  {
    prefixo: "04.1.3.02.*",
    grupoGerencial: "CUSTO_DIRETO_PESSOAL",
    natureza: "custo",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_ao_quadro",
    subgrupoFolhaOperacao: "folha",
    linhaDRE: "L04",
  },
  {
    prefixo: "04.1.3.03.*",
    grupoGerencial: "CUSTO_DIRETO_OPERACIONAL",
    natureza: "custo",
    diretoIndireto: "direto",
    fixoVariavel: "variavel_consumo",
    subgrupoFolhaOperacao: "operacao",
    linhaDRE: "L05",
  },
  {
    prefixo: "04.2.1.01.*",
    grupoGerencial: "DESPESA_ADMIN_PESSOAL",
    natureza: "despesa",
    diretoIndireto: "indireto",
    fixoVariavel: "predominantemente_fixo",
    subgrupoFolhaOperacao: "folha",
    linhaDRE: "L07",
  },
  {
    prefixo: "04.2.1.03.*",
    grupoGerencial: "DESPESA_ADMIN_GERAL",
    natureza: "despesa",
    diretoIndireto: "indireto",
    fixoVariavel: "predominantemente_fixo",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L08",
  },
  {
    prefixo: "04.2.2.03.*",
    grupoGerencial: "DESPESA_COMERCIAL_LICITACOES",
    natureza: "despesa",
    diretoIndireto: "indireto",
    fixoVariavel: "variavel_pipeline",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L09",
  },
  {
    prefixo: "04.2.3.02.*",
    grupoGerencial: "DESPESA_FINANCEIRA",
    natureza: "despesa",
    diretoIndireto: "indireto",
    fixoVariavel: "variavel_financeira",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L11",
  },
  {
    prefixo: "04.2.3.03.*",
    grupoGerencial: "RECEITA_FINANCEIRA",
    natureza: "receita",
    diretoIndireto: "indireto",
    fixoVariavel: "variavel_financeira",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L11",
  },
  {
    prefixo: "04.2.4.01.*",
    grupoGerencial: "TRIBUTOS_NAO_RECUPERAVEIS_OUTRAS_DESPESAS",
    natureza: "despesa",
    diretoIndireto: "indireto",
    fixoVariavel: "eventual",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L08",
  },
  {
    prefixo: "04.2.4.02.*",
    grupoGerencial: "MULTAS_CONTINGENCIAS",
    natureza: "despesa",
    diretoIndireto: "indireto",
    fixoVariavel: "eventual",
    subgrupoFolhaOperacao: "n/a",
    linhaDRE: "L08",
  },
];

export const classificarPorConta = (
  contaReduzida: string,
): ClassificadorGerencial | undefined => {
  return classificadores.find((c) => {
    const pref = c.prefixo.replace(".*", "");
    return contaReduzida.startsWith(pref);
  });
};

// --------------------------- DRIVERS OBZ PERMITIDOS --------------------------

export type DriverOBZ =
  | "headcount_mensal"
  | "folha_percentual"
  | "beneficio_por_colaborador"
  | "consumo_quantidade_x_preco"
  | "valor_fixo_mensal"
  | "valor_eventual_unico"
  | "percentual_da_receita"
  | "curva_sazonal"
  | "mobilizacao_desmobilizacao";

export const driversOBZ: { id: DriverOBZ; label: string; descricao: string }[] = [
  { id: "headcount_mensal", label: "Headcount mensal", descricao: "Quantidade de colaboradores × custo unitário." },
  { id: "folha_percentual", label: "Folha (%)", descricao: "Percentual aplicado sobre a folha base." },
  { id: "beneficio_por_colaborador", label: "Benefício por colaborador", descricao: "Valor unitário × headcount." },
  { id: "consumo_quantidade_x_preco", label: "Consumo (qtd × preço)", descricao: "Quantidade física × preço unitário." },
  { id: "valor_fixo_mensal", label: "Valor fixo mensal", descricao: "Lançamento mensal fixo independente de driver." },
  { id: "valor_eventual_unico", label: "Valor eventual único", descricao: "Lançamento único na competência selecionada." },
  { id: "percentual_da_receita", label: "% da receita", descricao: "Percentual aplicado sobre a receita líquida." },
  { id: "curva_sazonal", label: "Curva sazonal", descricao: "Distribuição sazonal informada por mês." },
  { id: "mobilizacao_desmobilizacao", label: "Mobilização/Desmobilização", descricao: "Picos pontuais de início ou encerramento de contrato." },
];

// ------------------------- CATÁLOGO DE CONTAS (mock) -------------------------

export interface ContaContabil {
  reduzida: string;
  descricao: string;
  tipo: "analitica" | "sintetica";
  natureza: NaturezaResultado;
}

export const contasContabeis: ContaContabil[] = [
  { reduzida: "03.01.001", descricao: "Receita de Serviços de Limpeza Urbana", tipo: "analitica", natureza: "receita" },
  { reduzida: "03.01.002", descricao: "Receita de Zeladoria Predial", tipo: "analitica", natureza: "receita" },
  { reduzida: "04.1.3.02.001", descricao: "Salários - Postos Operacionais", tipo: "analitica", natureza: "custo" },
  { reduzida: "04.1.3.02.002", descricao: "Encargos Sociais (INSS/FGTS) - Operação", tipo: "analitica", natureza: "custo" },
  { reduzida: "04.1.3.02.003", descricao: "Vale Transporte / Vale Refeição - Operação", tipo: "analitica", natureza: "custo" },
  { reduzida: "04.1.3.03.001", descricao: "Uniformes e EPIs", tipo: "analitica", natureza: "custo" },
  { reduzida: "04.1.3.03.002", descricao: "Materiais de Limpeza", tipo: "analitica", natureza: "custo" },
  { reduzida: "04.1.3.03.003", descricao: "Combustível e Manutenção de Frota", tipo: "analitica", natureza: "custo" },
  { reduzida: "04.2.1.01.001", descricao: "Salários - Administrativo", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.1.01.002", descricao: "Encargos - Administrativo", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.1.03.001", descricao: "Aluguel da Sede", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.1.03.002", descricao: "Energia / Água / Internet - Sede", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.1.03.003", descricao: "Honorários Contábeis e Jurídicos", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.2.03.001", descricao: "Custos de Participação em Licitações", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.3.02.001", descricao: "Juros e Tarifas Bancárias", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.3.03.001", descricao: "Rendimentos de Aplicações", tipo: "analitica", natureza: "receita" },
  { reduzida: "04.2.4.01.001", descricao: "Tributos Não Recuperáveis", tipo: "analitica", natureza: "despesa" },
  { reduzida: "04.2.4.02.001", descricao: "Multas e Contingências", tipo: "analitica", natureza: "despesa" },
];

// ------------------------------ HELPERS DE UI --------------------------------

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatBRLExato = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const labelGrupoGerencial: Record<GrupoGerencial, string> = {
  RECEITA: "Receita",
  CUSTO_DIRETO_PESSOAL: "Custo Direto - Pessoal",
  CUSTO_DIRETO_OPERACIONAL: "Custo Direto - Operação",
  DESPESA_ADMIN_PESSOAL: "Despesa Admin. - Pessoal",
  DESPESA_ADMIN_GERAL: "Despesa Admin. - Geral",
  DESPESA_COMERCIAL_LICITACOES: "Despesa Comercial / Licitações",
  DESPESA_FINANCEIRA: "Despesa Financeira",
  RECEITA_FINANCEIRA: "Receita Financeira",
  TRIBUTOS_NAO_RECUPERAVEIS_OUTRAS_DESPESAS: "Tributos / Outras Despesas",
  MULTAS_CONTINGENCIAS: "Multas / Contingências",
};
