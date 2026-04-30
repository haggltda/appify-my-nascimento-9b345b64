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

export const BANCOS_CATALOGO: BancoCatalogo[] = [
  { codigo: "001", nome: "Banco do Brasil", cor: "hsl(48 96% 50%)" },
  { codigo: "104", nome: "Caixa Econômica", cor: "hsl(220 90% 40%)" },
  { codigo: "237", nome: "Bradesco", cor: "hsl(0 80% 45%)" },
  { codigo: "341", nome: "Itaú Unibanco", cor: "hsl(28 95% 55%)" },
  { codigo: "033", nome: "Santander", cor: "hsl(0 75% 50%)" },
  { codigo: "756", nome: "Sicoob", cor: "hsl(155 65% 35%)" },
  { codigo: "748", nome: "Sicredi", cor: "hsl(95 55% 40%)" },
  { codigo: "077", nome: "Inter", cor: "hsl(20 90% 50%)" },
  { codigo: "208", nome: "BTG Pactual", cor: "hsl(0 0% 15%)" },
  { codigo: "999", nome: "Outro / Customizado", cor: "hsl(220 10% 50%)" },
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
