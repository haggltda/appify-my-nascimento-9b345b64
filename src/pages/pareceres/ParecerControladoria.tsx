import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";
import { ParecerDetalhadoForm, type ParecerDetalhadoConfig } from "@/components/forms/ParecerDetalhadoForm";

const config: Omit<ParecerDetalhadoConfig, "subtitulo"> = {
  papel: "Controladoria",
  tituloCard: "Validação econômico-financeira",
  chipsExtras: [{ label: "Análise financeira", tom: "info" }],
  checklist: {
    titulo: "Validações financeiras",
    itens: [
      { id: "bdi", label: "BDI dentro da política", desc: "Acórdão 2.622/13 TCU · faixas por tipo de obra" },
      { id: "margem_minima", label: "Margem operacional ≥ mínima", desc: "Política institucional vigente" },
      { id: "tributos", label: "Carga tributária aderente", desc: "Regime, ISS, PIS/COFINS, INSS sobre folha" },
      { id: "fluxo_caixa", label: "Fluxo de caixa positivo", desc: "Considerar prazos de medição/pagamento" },
      { id: "capital_giro", label: "Capital de giro disponível", desc: "Necessidade vs. linhas aprovadas" },
      { id: "orcamento", label: "Aderência ao orçamento OBZ", desc: "Centro de custo / unidade gerencial" },
      { id: "risco_inadimplencia", label: "Risco de inadimplência do órgão", desc: "Histórico CAUC / SIAFI" },
      { id: "garantias_custo", label: "Custo das garantias provisionado", desc: "Carta fiança, seguro, caução" },
    ],
    defaultMarcados: ["bdi", "margem_minima"],
  },
  campos: [
    { id: "bdi_valor", label: "BDI proposto (%)", tipo: "percentual", placeholder: "Ex.: 23.5" },
    { id: "margem_liquida", label: "Margem líquida prevista (%)", tipo: "percentual", placeholder: "Ex.: 8.0" },
    { id: "necessidade_giro", label: "Necessidade de giro (R$)", tipo: "moeda", placeholder: "0,00" },
    { id: "prazo_medicao", label: "Prazo de medição (dias)", tipo: "numero" },
    { id: "prazo_pagamento", label: "Prazo de pagamento (dias)", tipo: "numero" },
    {
      id: "regime_tributario",
      label: "Regime tributário",
      tipo: "select",
      opcoes: ["Lucro Real", "Lucro Presumido", "Simples Nacional"],
    },
  ],
  recomendacoes: [
    "Aprovar — viável",
    "Aprovar com ressalvas",
    "Rever precificação",
    "Reprovar — inviável",
  ],
  labelEnviar: "Enviar parecer da controladoria",
  proximaEtapa: { titulo: "Diretor Operacional", desc: "Avaliação da capacidade operacional" },
  referenciasLaterais: {
    titulo: "Indicadores de referência",
    itens: ["BDI 20-25%", "Margem ≥ 6%", "ROIC > 12%", "Liq. corrente > 1,2", "DSO < 60d"],
  },
};

export default function ParecerControladoria() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer da Controladoria"
        breadcrumb={["Licitações", "Análise & Decisão", "Parecer Controladoria"]}
        subtitle="Validação de margens, BDI, tributos, fluxo de caixa e impacto orçamentário do contrato."
      />
      <PareceristaWorkspace
        papel="Controladoria"
        statusFiltro={["controladoria", "parecer_gerencial", "em_analise"]}
        renderDetalhe={(l, voltar) => (
          <ParecerDetalhadoForm
            licitacao={l}
            voltar={voltar}
            config={{
              ...config,
              subtitulo: `${l.numero} · ${l.objeto} — avalie viabilidade econômico-financeira, BDI, exposição tributária e premissas de margem.`,
            }}
          />
        )}
      />
    </div>
  );
}
