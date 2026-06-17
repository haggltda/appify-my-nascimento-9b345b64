// Tipos do Builder de Layouts Bancários

export type BancoLayoutTipo =
  | "cnab240_remessa_pagamento"
  | "cnab240_retorno"
  | "cnab400_remessa"
  | "cnab400_retorno"
  | "api_rest_pagamento"
  | "api_rest_consulta"
  | "ofx_extrato"
  | "csv_extrato";

export type CampoTipo = "num" | "alfa" | "data" | "decimal";
export type CampoPadding = "zeros" | "espacos" | "espacos_direita";

export interface CampoLayout {
  nome: string;
  pos_ini: number;
  pos_fim: number;
  tamanho: number;
  tipo: CampoTipo;
  padding: CampoPadding;
  /** Origem: "literal:VALOR" ou "dot.path" do contexto (titulo.valor, fornecedor.cnpj, etc.) */
  origem: string;
  /** Lista de transformações encadeáveis aplicadas em ordem */
  transformacoes?: string[];
  obrigatorio?: boolean;
  descricao?: string;
}

export interface SegmentoLayout {
  codigo: string;
  descricao?: string;
  campos: CampoLayout[];
}

export interface CnabEstrutura {
  tipo: "cnab240" | "cnab400";
  tamanho_registro: number;
  banco_codigo?: string;
  segmentos: SegmentoLayout[];
}

export interface ApiRestEstrutura {
  tipo: "api_rest";
  metodo: "POST" | "PUT" | "GET" | "PATCH";
  endpoint: string;
  headers: Record<string, string>;
  body_template: Record<string, any>;
  response_mapping?: Record<string, string>;
}

export type LayoutEstrutura = CnabEstrutura | ApiRestEstrutura | Record<string, any>;

export interface BancoCatalogo {
  codigo: string;
  nome: string;
  cor: string; // hsl token
}

const DEFAULT_COR = "hsl(220 10% 50%)";
export const BANCOS_CATALOGO: BancoCatalogo[] = [
  // Top do mercado
  { codigo: "001", nome: "Banco do Brasil", cor: "hsl(48 96% 50%)" },
  { codigo: "104", nome: "Caixa Econômica", cor: "hsl(220 90% 40%)" },
  { codigo: "237", nome: "Bradesco", cor: "hsl(0 80% 45%)" },
  { codigo: "341", nome: "Itaú Unibanco", cor: "hsl(28 95% 55%)" },
  { codigo: "033", nome: "Santander", cor: "hsl(0 75% 50%)" },
  { codigo: "756", nome: "Sicoob", cor: "hsl(155 65% 35%)" },
  { codigo: "748", nome: "Sicredi", cor: "hsl(95 55% 40%)" },
  { codigo: "077", nome: "Inter", cor: "hsl(20 90% 50%)" },
  { codigo: "208", nome: "BTG Pactual", cor: "hsl(0 0% 15%)" },
  // Demais (códigos COMPE)
  { codigo: "003", nome: "BASA - Banco da Amazônia", cor: DEFAULT_COR },
  { codigo: "004", nome: "Banco do Nordeste (BNB)", cor: DEFAULT_COR },
  { codigo: "021", nome: "Banestes", cor: DEFAULT_COR },
  { codigo: "025", nome: "Banco Alfa", cor: DEFAULT_COR },
  { codigo: "037", nome: "Banpará", cor: DEFAULT_COR },
  { codigo: "041", nome: "Banrisul", cor: DEFAULT_COR },
  { codigo: "047", nome: "Banese", cor: DEFAULT_COR },
  { codigo: "070", nome: "BRB - Banco de Brasília", cor: DEFAULT_COR },
  { codigo: "082", nome: "Banco Topázio", cor: DEFAULT_COR },
  { codigo: "084", nome: "Uniprime Norte do Paraná", cor: DEFAULT_COR },
  { codigo: "085", nome: "Ailos / Cecred", cor: DEFAULT_COR },
  { codigo: "097", nome: "Credisis - Central de Cooperativas", cor: DEFAULT_COR },
  { codigo: "121", nome: "Agibank", cor: DEFAULT_COR },
  { codigo: "197", nome: "Stone Pagamentos", cor: DEFAULT_COR },
  { codigo: "212", nome: "Banco Original", cor: DEFAULT_COR },
  { codigo: "213", nome: "Banco Arbi", cor: DEFAULT_COR },
  { codigo: "218", nome: "BS2", cor: DEFAULT_COR },
  { codigo: "222", nome: "Crédit Agricole Brasil", cor: DEFAULT_COR },
  { codigo: "224", nome: "Banco Fibra", cor: DEFAULT_COR },
  { codigo: "246", nome: "ABC Brasil", cor: DEFAULT_COR },
  { codigo: "260", nome: "Nubank (Nu Pagamentos)", cor: "hsl(280 60% 45%)" },
  { codigo: "290", nome: "PagBank / PagSeguro", cor: DEFAULT_COR },
  { codigo: "323", nome: "Mercado Pago", cor: DEFAULT_COR },
  { codigo: "335", nome: "Digio", cor: DEFAULT_COR },
  { codigo: "336", nome: "C6 Bank", cor: "hsl(0 0% 10%)" },
  { codigo: "380", nome: "PicPay", cor: DEFAULT_COR },
  { codigo: "389", nome: "Mercantil do Brasil", cor: DEFAULT_COR },
  { codigo: "422", nome: "Safra", cor: DEFAULT_COR },
  { codigo: "453", nome: "Banco Rural", cor: DEFAULT_COR },
  { codigo: "473", nome: "Caixa Geral - Brasil", cor: DEFAULT_COR },
  { codigo: "477", nome: "Citibank N.A.", cor: DEFAULT_COR },
  { codigo: "487", nome: "Deutsche Bank", cor: DEFAULT_COR },
  { codigo: "526", nome: "Ticket / Edenred (conta-pagamento)", cor: DEFAULT_COR },
  { codigo: "600", nome: "Luso Brasileiro", cor: DEFAULT_COR },
  { codigo: "604", nome: "Banco Industrial do Brasil", cor: DEFAULT_COR },
  { codigo: "611", nome: "Banco Paulista", cor: DEFAULT_COR },
  { codigo: "612", nome: "Banco Guanabara", cor: DEFAULT_COR },
  { codigo: "623", nome: "Banco Pan", cor: DEFAULT_COR },
  { codigo: "633", nome: "Banco Rendimento", cor: DEFAULT_COR },
  { codigo: "637", nome: "Sofisa", cor: DEFAULT_COR },
  { codigo: "643", nome: "Banco Pine", cor: DEFAULT_COR },
  { codigo: "707", nome: "Daycoval", cor: DEFAULT_COR },
  { codigo: "735", nome: "Neon Pagamentos", cor: DEFAULT_COR },
  { codigo: "739", nome: "Cetelem", cor: DEFAULT_COR },
  { codigo: "745", nome: "Citibank", cor: DEFAULT_COR },
  { codigo: "746", nome: "Banco Modal", cor: DEFAULT_COR },
  { codigo: "752", nome: "BNP Paribas Brasil", cor: DEFAULT_COR },
  { codigo: "755", nome: "Bank of America Merrill Lynch", cor: DEFAULT_COR },
  { codigo: "757", nome: "KEB Hana do Brasil", cor: DEFAULT_COR },
  // Correspondentes / sem código COMPE oficial (editáveis no admin)
  { codigo: "MENTORE", nome: "Mentore (correspondente)", cor: DEFAULT_COR },
  { codigo: "PROSPERA", nome: "Próspera (correspondente)", cor: DEFAULT_COR },
  // Fallback
  { codigo: "999", nome: "Outro / Customizado", cor: DEFAULT_COR },
];

export const CAMPOS_SISTEMA_DISPONIVEIS = [
  { path: "empresa.cnpj", label: "Empresa: CNPJ", tipo: "num" as const },
  { path: "empresa.razao_social", label: "Empresa: Razão Social", tipo: "alfa" as const },
  { path: "conta.codigo_banco", label: "Conta: Código Banco", tipo: "num" as const },
  { path: "conta.agencia", label: "Conta: Agência", tipo: "num" as const },
  { path: "conta.conta", label: "Conta: Número", tipo: "num" as const },
  { path: "conta.cnab_convenio", label: "Conta: Convênio CNAB", tipo: "alfa" as const },
  { path: "titulo.id", label: "Título: ID", tipo: "alfa" as const },
  { path: "titulo.numero_documento", label: "Título: Nº Documento", tipo: "alfa" as const },
  { path: "titulo.valor", label: "Título: Valor", tipo: "decimal" as const },
  { path: "titulo.data_pagamento", label: "Título: Data Pagamento", tipo: "data" as const },
  { path: "titulo.data_vencimento", label: "Título: Vencimento", tipo: "data" as const },
  { path: "titulo.nosso_numero", label: "Título: Nosso Número", tipo: "alfa" as const },
  { path: "fornecedor.documento", label: "Fornecedor: CNPJ/CPF", tipo: "num" as const },
  { path: "fornecedor.nome_razao", label: "Fornecedor: Nome/Razão", tipo: "alfa" as const },
  { path: "fornecedor.banco_codigo", label: "Fornecedor: Banco", tipo: "num" as const },
  { path: "fornecedor.agencia", label: "Fornecedor: Agência", tipo: "num" as const },
  { path: "fornecedor.conta", label: "Fornecedor: Conta", tipo: "num" as const },
  { path: "fornecedor.pix_chave", label: "Fornecedor: Chave PIX", tipo: "alfa" as const },
];

export const TRANSFORMACOES_DISPONIVEIS = [
  { id: "removerPontuacao", label: "Remover pontuação", desc: "Remove . - / ( ) espaços" },
  { id: "padLeftZeros", label: "Preencher zeros à esquerda", desc: "Até atingir o tamanho" },
  { id: "padRightSpaces", label: "Preencher espaços à direita", desc: "" },
  { id: "uppercase", label: "Maiúsculas", desc: "" },
  { id: "removerAcentos", label: "Remover acentos", desc: "ção → cao" },
  { id: "multiplicar:100", label: "× 100 (centavos)", desc: "R$ 1234,56 → 123456" },
  { id: "formatDate:DDMMYYYY", label: "Data DDMMAAAA", desc: "31122025" },
  { id: "formatDate:YYYY-MM-DD", label: "Data ISO", desc: "2025-12-31" },
  { id: "formatDate:DDMMYY", label: "Data DDMMAA", desc: "311225" },
  { id: "truncar", label: "Truncar até tamanho", desc: "" },
];
