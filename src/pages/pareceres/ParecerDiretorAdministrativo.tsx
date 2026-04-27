import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";

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
        renderDetalhe={(l) => (
          <PareceristaForm
            papel="Diretor Administrativo"
            subtitulo={`${l.numero} · ${l.objeto} — avalie alinhamento estratégico, capacidade administrativa e risco reputacional.`}
            cor="accent"
          />
        )}
      />
    </div>
  );
}
