// Catálogo da Base de Conhecimento.
// Para adicionar um novo artigo: crie um .md em src/content/ajuda/<modulo>/ e registre aqui.

import programacaoPagamentos from "./financeiro/programacao-pagamentos.md?raw";

export type ArtigoMeta = {
  slug: string;
  modulo: string;
  moduloLabel: string;
  titulo: string;
  resumo: string;
  tags: string[];
  rotasRelacionadas: string[]; // prefixos de rota onde este artigo deve aparecer no painel contextual
  updatedAt: string;
  conteudo: string;
};

export const MODULOS: { id: string; label: string; descricao: string }[] = [
  { id: "financeiro", label: "Financeiro", descricao: "Contas a pagar/receber, fluxo, conciliação e integração bancária." },
  { id: "contabil", label: "Contábil", descricao: "Plano de contas, lançamentos, balancete e DRE." },
  { id: "rh", label: "RH", descricao: "Colaboradores, alocações e folha." },
  { id: "suprimentos", label: "Suprimentos", descricao: "Fornecedores, requisições, pedidos e estoque." },
  { id: "plano-acoes", label: "Plano de Ações", descricao: "Importação, kanban, aprovações e copiloto IA." },
  { id: "integracao", label: "Integração & Migração", descricao: "Carregamento de lotes FCR, aliases e reprocessamento." },
  { id: "admin", label: "Administração", descricao: "Usuários, perfis, permissões e parâmetros." },
];

export const ARTIGOS: ArtigoMeta[] = [
  {
    slug: "programacao-pagamentos",
    modulo: "financeiro",
    moduloLabel: "Financeiro",
    titulo: "Programação de Pagamentos",
    resumo: "Como selecionar títulos, gerar malotes, aprovar e enviar para o banco.",
    tags: ["pagamentos", "malote", "aprovação", "cnab", "api"],
    rotasRelacionadas: ["/app/financeiro/programacao-pagamentos", "/app/financeiro/contas-pagar"],
    updatedAt: "2026-05-18",
    conteudo: programacaoPagamentos,
  },
];

export function getArtigo(modulo: string, slug: string): ArtigoMeta | undefined {
  return ARTIGOS.find((a) => a.modulo === modulo && a.slug === slug);
}

export function getArtigosPorModulo(modulo: string): ArtigoMeta[] {
  return ARTIGOS.filter((a) => a.modulo === modulo);
}

export function getArtigosPorRota(pathname: string): ArtigoMeta[] {
  return ARTIGOS.filter((a) => a.rotasRelacionadas.some((r) => pathname.startsWith(r)));
}

export function buscarArtigos(termo: string): ArtigoMeta[] {
  const t = termo.trim().toLowerCase();
  if (!t) return ARTIGOS;
  return ARTIGOS.filter(
    (a) =>
      a.titulo.toLowerCase().includes(t) ||
      a.resumo.toLowerCase().includes(t) ||
      a.tags.some((tag) => tag.includes(t)) ||
      a.moduloLabel.toLowerCase().includes(t),
  );
}
