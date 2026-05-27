import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";
import { ParecerDetalhadoForm, type ParecerDetalhadoConfig } from "@/components/forms/ParecerDetalhadoForm";

const config: Omit<ParecerDetalhadoConfig, "subtitulo"> = {
  papel: "Jurídico Administrativo",
  menuCodigo: "parecer-juridico",
  tituloCard: "Análise jurídico-administrativa do edital",
  chipsExtras: [{ label: "Análise legal", tom: "info" }],
  checklist: {
    titulo: "Checklist de conformidade legal",
    itens: [
      { id: "habil_juridica", label: "Habilitação jurídica", desc: "Atos constitutivos, procurações, registros" },
      { id: "habil_fiscal", label: "Regularidade fiscal e trabalhista", desc: "CNDs federais, FGTS, CNDT" },
      { id: "habil_tecnica", label: "Qualificação técnica", desc: "Atestados, CAT, vínculos profissionais" },
      { id: "habil_economica", label: "Qualificação econômico-financeira", desc: "Balanço, índices, capital mínimo" },
      { id: "garantia", label: "Garantia da proposta/contratual", desc: "Modalidade, percentual, prazos" },
      { id: "prazos_recursais", label: "Prazos recursais e impugnação", desc: "Lei 14.133/21 art. 165" },
      { id: "subcontratacao", label: "Permissão de subcontratação", desc: "Limites e responsabilidade solidária" },
      { id: "clausulas_abusivas", label: "Cláusulas restritivas/abusivas", desc: "Direcionamento, exigências excessivas" },
    ],
    defaultMarcados: ["habil_juridica", "habil_fiscal"],
  },
  campos: [
    {
      id: "modalidade_recurso",
      label: "Necessidade de impugnação",
      tipo: "select",
      opcoes: ["Não há", "Pedido de esclarecimento", "Impugnação parcial", "Impugnação integral"],
    },
    { id: "prazo_recursal", label: "Prazo limite (dias úteis)", tipo: "numero", placeholder: "Ex.: 3" },
    {
      id: "risco_juridico",
      label: "Nível de risco jurídico",
      tipo: "select",
      opcoes: ["Baixo", "Médio", "Alto", "Crítico"],
    },
  ],
  recomendacoes: [
    "Prosseguir — edital regular",
    "Prosseguir com ressalvas",
    "Solicitar esclarecimento",
    "Impugnar edital",
    "Não prosseguir",
  ],
  labelEnviar: "Enviar parecer jurídico",
  proximaEtapa: { titulo: "Parecer SST", desc: "Avaliação de saúde e segurança do trabalho" },
  referenciasLaterais: {
    titulo: "Bases legais frequentes",
    itens: ["Lei 14.133/21", "Lei 8.666/93", "Decreto 10.024/19", "IN 5/17 SEGES", "Súmulas TCU"],
  },
};

export default function ParecerJuridico() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer Jurídico Administrativo"
        breadcrumb={["Licitações", "Análise & Decisão", "Parecer Jurídico"]}
        subtitle="Análise da legalidade do edital, cláusulas administrativas, exigências de habilitação e riscos jurídicos."
      />
      <PareceristaWorkspace
        papel="Jurídico Administrativo"
        statusFiltro={["em_analise", "parecer_tecnico", "parecer_gerencial"]}
        renderDetalhe={(l, voltar) => (
          <ParecerDetalhadoForm
            licitacao={l}
            voltar={voltar}
            config={{
              ...config,
              subtitulo: `${l.numero} · ${l.objeto} — avalie cláusulas, exigências de habilitação, prazos recursais e conformidade legal.`,
            }}
          />
        )}
      />
    </div>
  );
}
