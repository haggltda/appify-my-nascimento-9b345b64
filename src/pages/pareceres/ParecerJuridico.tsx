import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";

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
        renderDetalhe={(l) => (
          <PareceristaForm
            papel="Jurídico Administrativo"
            subtitulo={`${l.numero} · ${l.objeto} — avalie cláusulas, exigências de habilitação, prazos recursais e conformidade legal.`}
          />
        )}
      />
    </div>
  );
}
