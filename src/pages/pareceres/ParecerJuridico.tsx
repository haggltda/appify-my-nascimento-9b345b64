import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";

export default function ParecerJuridico() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer Jurídico Administrativo"
        breadcrumb={["Licitações", "Análise & Decisão", "Parecer Jurídico"]}
        subtitle="Análise da legalidade do edital, cláusulas administrativas, exigências de habilitação e riscos jurídicos."
      />
      <PareceristaForm
        papel="Jurídico Administrativo"
        subtitulo="Avalie cláusulas, exigências de habilitação, prazos recursais e conformidade legal do edital."
      />
    </div>
  );
}
