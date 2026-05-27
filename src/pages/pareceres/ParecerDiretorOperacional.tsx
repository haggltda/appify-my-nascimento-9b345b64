import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";
import { ParecerDetalhadoForm, type ParecerDetalhadoConfig } from "@/components/forms/ParecerDetalhadoForm";

const config: Omit<ParecerDetalhadoConfig, "subtitulo"> = {
  papel: "Diretor Operacional",
  menuCodigo: "parecer-dir-operacional",
  tituloCard: "Decisão executiva — capacidade operacional",
  cor: "accent",
  chipsExtras: [{ label: "Decisão executiva", tom: "warning" }],
  checklist: {
    titulo: "Avaliação de capacidade de execução",
    itens: [
      { id: "equipe_propria", label: "Equipe própria suficiente", desc: "Disponibilidade de profissionais qualificados" },
      { id: "equipamentos", label: "Equipamentos disponíveis", desc: "Frota, ferramental, máquinas operatrizes" },
      { id: "logistica", label: "Logística e mobilização viáveis", desc: "Distância, infraestrutura, alojamento" },
      { id: "subcontratacao", label: "Subcontratação necessária", desc: "Identificar parceiros estratégicos" },
      { id: "qhsse", label: "Conformidade QHSSE", desc: "Saúde, segurança, meio ambiente" },
      { id: "prazo_execucao", label: "Prazo executável", desc: "Cronograma físico viável" },
      { id: "produtividade", label: "Produtividade alinhada", desc: "Histórico em contratos similares" },
      { id: "contingencia", label: "Plano de contingência", desc: "Riscos operacionais mapeados" },
    ],
    defaultMarcados: ["equipe_propria", "equipamentos"],
  },
  campos: [
    { id: "efetivo", label: "Efetivo direto necessário", tipo: "numero", placeholder: "nº pessoas" },
    {
      id: "mobilizacao",
      label: "Tempo de mobilização",
      tipo: "select",
      opcoes: ["Até 15 dias", "16 a 30 dias", "31 a 60 dias", "Acima de 60 dias"],
    },
    {
      id: "complexidade",
      label: "Complexidade operacional",
      tipo: "select",
      opcoes: ["Baixa", "Média", "Alta", "Crítica"],
    },
    { id: "centros_op", label: "Centros operativos envolvidos", tipo: "numero" },
  ],
  recomendacoes: [
    "Aprovar — capacidade plena",
    "Aprovar com plano de mobilização",
    "Aprovar com subcontratação",
    "Não recomendar",
  ],
  labelEnviar: "Enviar decisão operacional",
  proximaEtapa: { titulo: "Diretor Administrativo", desc: "Decisão estratégica final" },
  referenciasLaterais: {
    titulo: "Histórico operacional",
    itens: ["Contratos ativos", "Frota disponível", "Efetivo total", "Atestados CAT"],
  },
};

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
        renderDetalhe={(l, voltar) => (
          <ParecerDetalhadoForm
            licitacao={l}
            voltar={voltar}
            config={{
              ...config,
              subtitulo: `${l.numero} · ${l.objeto} — avalie capacidade técnica, mobilização de equipes, equipamentos e logística.`,
            }}
          />
        )}
      />
    </div>
  );
}
