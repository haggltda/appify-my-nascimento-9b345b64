import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaForm } from "@/components/forms/PareceristaForm";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";

export default function ParecerDiretorOperacional() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer do Diretor Operacional"
        breadcrumb={["Licitações", "Análise & Decisão", "Diretor Operacional"]}
        subtitle="Decisão executiva sobre capacidade operacional, mobilização e execução do contrato."
      />
      <PareceristaWorkspace
        papel="Diretor Operacional"
        statusFiltro={["aprovacao_diretoria", "controladoria", "parecer_gerencial"]}
        renderDetalhe={(l) => (
          <PareceristaForm
            papel="Diretor Operacional"
            subtitulo={`${l.numero} · ${l.objeto} — avalie capacidade técnica, mobilização de equipes, equipamentos e logística.`}
            cor="accent"
          />
        )}
      />
    </div>
  );
}
