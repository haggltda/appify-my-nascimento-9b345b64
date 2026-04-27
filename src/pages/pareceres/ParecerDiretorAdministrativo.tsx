import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";

export default function ParecerDiretorAdministrativo() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer do Diretor Administrativo"
        breadcrumb={["Licitações", "Análise & Decisão", "Diretor Administrativo"]}
        subtitle="Decisão executiva sobre estrutura administrativa, governança e implicações estratégicas."
      />
      <PareceristaForm
        papel="Diretor Administrativo"
        subtitulo="Avalie alinhamento estratégico, capacidade administrativa e risco reputacional."
        cor="accent"
      />
    </div>
  );
}
