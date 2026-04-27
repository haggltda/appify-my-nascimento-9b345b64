import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";

export default function ParecerDiretorOperacional() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer do Diretor Operacional"
        breadcrumb={["Licitações", "Análise & Decisão", "Diretor Operacional"]}
        subtitle="Decisão executiva sobre capacidade operacional, mobilização e execução do contrato."
      />
      <PareceristaForm
        papel="Diretor Operacional"
        subtitulo="Avalie capacidade técnica, mobilização de equipes, equipamentos e logística operacional."
        cor="accent"
      />
    </div>
  );
}
