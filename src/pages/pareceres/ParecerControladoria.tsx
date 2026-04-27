import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";

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
        renderDetalhe={(l) => (
          <PareceristaForm
            papel="Controladoria"
            subtitulo={`${l.numero} · ${l.objeto} — avalie viabilidade econômico-financeira, BDI, exposição tributária e premissas de margem.`}
          />
        )}
      />
    </div>
  );
}
