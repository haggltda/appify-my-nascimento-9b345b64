import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";
import { ParecerDetalhadoForm, type ParecerDetalhadoConfig } from "@/components/forms/ParecerDetalhadoForm";

const config: Omit<ParecerDetalhadoConfig, "subtitulo"> = {
  papel: "Diretor Administrativo",
  menuCodigo: "parecer-dir-administrativo",
  tituloCard: "Decisão executiva - alinhamento estratégico",
  cor: "accent",
  chipsExtras: [{ label: "Decisão estratégica", tom: "warning" }],
  checklist: {
    titulo: "Avaliação estratégica e de governança",
    itens: [
      { id: "alinhamento", label: "Alinhamento ao plano estratégico", desc: "Direcionadores institucionais" },
      { id: "capacidade_adm", label: "Capacidade administrativa", desc: "Backoffice, RH, suprimentos, TI" },
      { id: "compliance", label: "Compliance e integridade", desc: "Due diligence do órgão e parceiros" },
      { id: "risco_reputacional", label: "Risco reputacional aceitável", desc: "Histórico do órgão / mídia" },
      { id: "concentracao", label: "Concentração de receita", desc: "% sobre faturamento por órgão/cliente" },
      { id: "exigencias_habil", label: "Atende exigências de habilitação", desc: "Atestados, índices, certidões" },
      { id: "sinergia_carteira", label: "Sinergia com carteira atual", desc: "Geografia, expertise, equipes" },
      { id: "covenants", label: "Impacto em covenants/garantias", desc: "Contratos bancários e seguros" },
    ],
    defaultMarcados: ["alinhamento", "capacidade_adm"],
  },
  campos: [
    {
      id: "prioridade",
      label: "Prioridade estratégica",
      tipo: "select",
      opcoes: ["Baixa", "Média", "Alta", "Estratégica"],
    },
    {
      id: "risco_global",
      label: "Risco global do contrato",
      tipo: "select",
      opcoes: ["Baixo", "Moderado", "Alto", "Crítico"],
    },
    { id: "perc_faturamento", label: "% sobre faturamento anual", tipo: "percentual", placeholder: "Ex.: 4.5" },
    {
      id: "decisao_colegiada",
      label: "Requer Comitê/Conselho?",
      tipo: "select",
      opcoes: ["Não", "Sim - Diretoria", "Sim - Conselho"],
    },
  ],
  recomendacoes: [
    "Aprovar - participar",
    "Aprovar condicionado a Comitê",
    "Postergar decisão",
    "Não participar",
  ],
  labelEnviar: "Enviar decisão administrativa",
  proximaEtapa: { titulo: "Aprovação Presidência", desc: "Homologação final do processo" },
  referenciasLaterais: {
    titulo: "Diretrizes estratégicas",
    itens: ["Plano 2025-2028", "Política de Risco", "Política de Compliance", "Matriz de Alçadas"],
  },
};

export default function ParecerDiretorAdministrativo() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer do Diretor Administrativo"
        breadcrumb={["Licitações", "Análise & Decisão", "Diretor Administrativo"]}
        subtitle="Decisão executiva sobre estrutura administrativa, governança e implicações estratégicas."
      />
      <PareceristaWorkspace
        papel="Diretor Administrativo"
        statusFiltro={["aprovacao_diretoria", "aprovacao_presidencia", "controladoria"]}
        renderDetalhe={(l, voltar) => (
          <ParecerDetalhadoForm
            licitacao={l}
            voltar={voltar}
            config={{
              ...config,
              subtitulo: `${l.numero} · ${l.objeto} - avalie alinhamento estratégico, capacidade administrativa e risco reputacional.`,
            }}
          />
        )}
      />
    </div>
  );
}
