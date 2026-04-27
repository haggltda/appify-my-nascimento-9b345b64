import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";

export default function ParecerControladoria() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer da Controladoria"
        breadcrumb={["Licitações", "Análise & Decisão", "Parecer Controladoria"]}
        subtitle="Validação de margens, BDI, tributos, fluxo de caixa e impacto orçamentário do contrato."
      />
      <PareceristaForm
        papel="Controladoria"
        subtitulo="Avalie a viabilidade econômico-financeira, BDI, exposição tributária e premissas de margem."
      />
    </div>
  );
}
