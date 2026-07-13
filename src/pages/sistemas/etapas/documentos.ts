// Os 9 "documentos oficiais" da aba "Documentos e Assinaturas" - mapeamento
// definido pela planilha do CEO (NOVAS RERAS KANBAN.xlsx).
import type { Anexo, Comentario, Convidado, Solicitacao } from "./types";

export interface DocumentoOficial {
  numero: string;
  nome: string;
  sigla: string;
  tipo: "anexos_gerais" | "anexo_etapa" | "pesquisa" | "encerramento_completo";
  etapaOrigem: string;
  campoAnexo?: string;
}

export const DOCUMENTOS_OFICIAIS: DocumentoOficial[] = [
  { numero: "I", nome: "Formulário de Solicitação de Demanda", sigla: "FSD", tipo: "anexo_etapa", etapaOrigem: "solicitacao_demanda" },
  { numero: "II", nome: "Documento Funcional da Demanda", sigla: "DFD", tipo: "anexo_etapa", etapaOrigem: "documentacao_funcional", campoAnexo: "documentacao_tecnica" },
  { numero: "III", nome: "Parecer Técnico de Viabilidade", sigla: "PTV", tipo: "anexo_etapa", etapaOrigem: "analise_tecnica", campoAnexo: "analise_tecnica" },
  { numero: "IV", nome: "Ata de Aprovação e Priorização", sigla: "AAP", tipo: "anexo_etapa", etapaOrigem: "aprovacao_priorizacao", campoAnexo: "aprovacao_priorizacao" },
  { numero: "V", nome: "Relatório de Testes Internos", sigla: "RTI", tipo: "anexo_etapa", etapaOrigem: "testes_internos", campoAnexo: "testes_internos" },
  { numero: "VI", nome: "Termo de Homologação da Área", sigla: "THA", tipo: "anexo_etapa", etapaOrigem: "homologacao_area_solicitante", campoAnexo: "homologacao_area_solicitante" },
  { numero: "VII", nome: "Registro de Implantação", sigla: "RIP", tipo: "anexo_etapa", etapaOrigem: "implantacao", campoAnexo: "implantacao" },
  { numero: "VIII", nome: "Pesquisa de Avaliação da Demanda", sigla: "PAD", tipo: "pesquisa", etapaOrigem: "encerramento" },
  { numero: "IX", nome: "Relatório de Encerramento da Demanda", sigla: "RED", tipo: "encerramento_completo", etapaOrigem: "encerramento" },
];

// Só aparece na lista quando já tem dado disponível - cresce conforme o card
// avança (não mostra os 9 sempre com "pendente").
export function documentoDisponivel(
  doc: DocumentoOficial,
  card: Solicitacao,
  anexos: Anexo[],
  comentarios: Comentario[],
  convidados: Convidado[],
): boolean {
  switch (doc.tipo) {
    case "anexos_gerais":
      return anexos.some((a) => !a.campo);
    case "anexo_etapa": {
      const ETAPAS_ORDEM = [
        "solicitacao_demanda", "triagem_inicial", "analise_necessidade", "levantamento_funcional",
        "documentacao_funcional", "analise_tecnica", "aprovacao_priorizacao", "desenvolvimento",
        "testes_internos", "homologacao_area_solicitante", "treinamento", "implantacao",
        "acompanhamento_assistido", "encerramento",
      ];
      const cardIdx = ETAPAS_ORDEM.indexOf(card.etapa);
      const unlockIdx = ETAPAS_ORDEM.indexOf(doc.etapaOrigem);
      return cardIdx >= unlockIdx && unlockIdx >= 0;
    }
    case "pesquisa":
      return (
        card.pesquisa_atendeu_necessidade != null ||
        card.pesquisa_levantamento_claro != null ||
        card.pesquisa_conducao_ti != null ||
        card.pesquisa_treinamento_suporte != null ||
        card.pesquisa_avaliacao_geral != null
      );
    case "encerramento_completo":
      return card.etapa === "encerramento" || card.finalizado;
    default:
      return false;
  }
}
