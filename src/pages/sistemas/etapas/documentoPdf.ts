// Geração do PDF "tipo print do card" por etapa - compartilhado entre os
// painéis ao vivo (botão direto no card, todas as 13 colunas exceto
// Encerramento) e o modal "Documentos e Assinaturas" (Anexos I-VII).
import {
  APROVACOES_TESTES_INTERNOS, CAMPOS_ABERTURA, COMPLEXIDADE_LABEL, CRITERIO_TRIAGEM_LABEL, ETAPAS,
  GRAU_URGENCIA_LABEL, STATUS_DESENVOLVIMENTO_LABEL, TIPO_SOLICITACAO_LABEL, fmtData, nomeUsuario,
  type Anexo, type Assinatura, type Comentario, type Convidado, type Solicitacao, type Usuario,
} from "./types";
import { PdfDocumento, fmtDataHoraPdf } from "@/lib/pdf/PdfDocumento";

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));

const ETAPA_CAMPO_ANEXO: Record<string, string> = {
  analise_necessidade: "analise_necessidade",
  levantamento_funcional: "levantamento_funcional",
  documentacao_funcional: "documentacao_tecnica",
  analise_tecnica: "analise_tecnica",
  aprovacao_priorizacao: "aprovacao_priorizacao",
  testes_internos: "testes_internos",
  homologacao_area_solicitante: "homologacao_area_solicitante",
  treinamento: "treinamento",
  implantacao: "implantacao",
  acompanhamento_assistido: "acompanhamento",
};

const IMPLANTACAO_LABEL: Record<string, string> = { sim: "Sim", nao: "Não", em_implantacao: "Em Implantação" };

function desenharCamposEtapa(
  pdf: PdfDocumento,
  linhas: string[],
  anexosDoCampo: Anexo[],
  comentariosBloco: Array<{ titulo: string; autor: string; data: string; texto: string }> = [],
) {
  linhas.forEach((l) => pdf.paragrafo(l, { tamanho: 10, espacoDepois: 2 }));

  comentariosBloco.forEach((c) => {
    pdf.paragrafo(`${c.titulo} - ${c.autor} (${c.data})`, { negrito: true, tamanho: 9, espacoDepois: 1 });
    pdf.paragrafo(c.texto, { tamanho: 9, espacoDepois: 3 });
  });
  if (linhas.length === 0 && comentariosBloco.length === 0) {
    pdf.paragrafo("-", { tamanho: 9.5, espacoDepois: 2 });
  }

  pdf.y += 1;
  pdf.paragrafo("Anexos:", { negrito: true, tamanho: 9.5, espacoDepois: 1 });
  if (anexosDoCampo.length === 0) {
    pdf.paragrafo("Nenhum.", { tamanho: 9, espacoDepois: 2 });
  } else {
    anexosDoCampo.forEach((a) => pdf.paragrafo(`• ${a.nome_arquivo}`, { tamanho: 9, espacoDepois: 1 }));
  }
}

// Gera e baixa o PDF "tipo print do card" de uma etapa específica (qualquer
// uma das 13 colunas exceto Encerramento, que continua com o histórico
// acumulado completo). assinaturas é opcional - quando chamado dos painéis
// ao vivo, omite (os painéis não têm acesso a esse dado); quando chamado do
// modal "Documentos e Assinaturas", inclui as assinaturas daquela coluna.
export function exportarPdfEtapa(
  etapaKey: string,
  card: Solicitacao,
  anexos: Anexo[],
  comentarios: Comentario[],
  usuarios: Usuario[],
  convidados: Convidado[] = [],
  assinaturas?: Assinatura[],
) {
  const etapaLabel = ETAPA_LABEL[etapaKey] ?? etapaKey;
  const campoAnexo = ETAPA_CAMPO_ANEXO[etapaKey];
  const anexosDoCampo = campoAnexo ? anexos.filter((a) => a.campo === campoAnexo) : [];
  const pdf = new PdfDocumento(card.titulo, card.id);
  pdf.tituloSecao(etapaLabel, 18);

  const textoComentario = (c: Comentario, titulo: string) => ({
    titulo,
    autor: nomeUsuario(usuarios, c.autor_id) ?? "Usuário",
    data: fmtDataHoraPdf(c.created_at),
    texto: c.texto,
  });

  switch (etapaKey) {
    case "solicitacao_demanda": {
      const linhas = [
        ...CAMPOS_ABERTURA.map((c) => `${c.label}: ${(card[c.key] as string | null) || "-"}`),
        `Grau de urgência: ${card.grau_urgencia ? GRAU_URGENCIA_LABEL[card.grau_urgencia] ?? card.grau_urgencia : "-"}`,
        `Tipo da solicitação: ${card.tipo_solicitacao ? TIPO_SOLICITACAO_LABEL[card.tipo_solicitacao] ?? card.tipo_solicitacao : "-"}`,
        `Convidados: ${convidados.length > 0 ? convidados.map((c) => nomeUsuario(usuarios, c.user_id) ?? c.user_id).join(", ") : "-"}`,
      ];
      desenharCamposEtapa(pdf, linhas, anexos.filter((a) => !a.campo));
      break;
    }
    case "triagem_inicial":
      desenharCamposEtapa(pdf, [
        `Critério: ${card.criterio_triagem ? CRITERIO_TRIAGEM_LABEL[card.criterio_triagem] ?? card.criterio_triagem : "-"}`,
      ], []);
      break;
    case "analise_necessidade":
      desenharCamposEtapa(pdf, [
        `Análise da Necessidade: ${card.analise_necessidade_texto || "-"}`,
        `Prazo: ${fmtData(card.analise_necessidade_prazo) ?? "-"}`,
      ], anexosDoCampo);
      break;
    case "levantamento_funcional":
      desenharCamposEtapa(pdf, [
        `Levantamento Funcional: ${card.levantamento_funcional_texto || "-"}`,
        `Prazo: ${fmtData(card.levantamento_funcional_prazo) ?? "-"}`,
      ], anexosDoCampo);
      break;
    case "documentacao_funcional":
      desenharCamposEtapa(pdf, [
        `Documentação Funcional: ${card.documentacao_tecnica_texto || "-"}`,
        `Prazo: ${fmtData(card.documentacao_tecnica_prazo) ?? "-"}`,
      ], anexosDoCampo);
      break;
    case "analise_tecnica":
      desenharCamposEtapa(pdf, [
        `Análise Técnica: ${card.analise_tecnica_texto || "-"}`,
        `Prazo: ${fmtData(card.analise_tecnica_prazo) ?? "-"}`,
      ], anexosDoCampo);
      break;
    case "aprovacao_priorizacao":
      desenharCamposEtapa(pdf, [
        `Prioridade: ${card.prioridade ?? "-"}`,
        `Responsável: ${nomeUsuario(usuarios, card.responsavel_user_id) ?? "-"}`,
        `Complexidade: ${card.complexidade ? COMPLEXIDADE_LABEL[card.complexidade] ?? card.complexidade : "-"}`,
      ], anexosDoCampo);
      break;
    case "desenvolvimento": {
      const comentariosDev = comentarios
        .filter((c) => c.tipo === "interromper_desenvolvimento" || c.tipo === "erro_documental")
        .map((c) => textoComentario(c, c.tipo === "erro_documental" ? "Erro documental" : "Interrupção do desenvolvimento"));
      desenharCamposEtapa(pdf, [
        `Progresso: ${card.progresso_pct}%`,
        `Prazo: ${fmtData(card.data_fim) ?? "-"}`,
        `Status de Desenvolvimento: ${card.status_desenvolvimento ? STATUS_DESENVOLVIMENTO_LABEL[card.status_desenvolvimento] ?? card.status_desenvolvimento : "-"}`,
      ], [], comentariosDev);
      break;
    }
    case "testes_internos": {
      const linhas = (Object.entries(APROVACOES_TESTES_INTERNOS) as Array<[keyof Solicitacao, string]>).map(
        ([campo, nome]) => `${card[campo] ? "[X]" : "[ ]"} ${nome}`,
      );
      desenharCamposEtapa(pdf, linhas, anexosDoCampo);
      break;
    }
    case "homologacao_area_solicitante": {
      const comentariosHomolog = comentarios
        .filter((c) => c.tipo === "aprovado_ressalva" || c.tipo === "reprovado")
        .map((c) => textoComentario(c, c.tipo === "reprovado" ? "Reprovado" : "Aprovado com ressalva"));
      desenharCamposEtapa(pdf, [], anexosDoCampo, comentariosHomolog);
      break;
    }
    case "treinamento": {
      const comentariosTreinamento = comentarios
        .filter((c) => c.tipo === "faltou_funcoes" || c.tipo === "encontrado_bug")
        .map((c) => textoComentario(c, c.tipo === "encontrado_bug" ? "Bug encontrado" : "Faltou função"));
      desenharCamposEtapa(pdf, [
        `Data do treinamento: ${fmtData(card.treinamento_data) ?? "-"}`,
      ], anexosDoCampo, comentariosTreinamento);
      break;
    }
    case "implantacao": {
      const comentariosImplantacao = comentarios
        .filter((c) => c.tipo === "implantacao_comentario")
        .map((c) => textoComentario(c, "Comentário de implantação"));
      desenharCamposEtapa(pdf, [
        `Implantado corretamente: ${card.implantacao_status ? IMPLANTACAO_LABEL[card.implantacao_status] ?? card.implantacao_status : "-"}`,
      ], anexosDoCampo, comentariosImplantacao);
      break;
    }
    case "acompanhamento_assistido":
      desenharCamposEtapa(pdf, [], anexosDoCampo);
      break;
  }

  if (assinaturas && assinaturas.length > 0) {
    pdf.y += 4;
    pdf.blocoAssinaturasColuna(
      `Coluna: ${etapaLabel}`,
      assinaturas.map((a) => ({ nome: nomeUsuario(usuarios, a.user_id) ?? "Usuário", created_at: a.created_at })),
    );
  }

  pdf.salvar(`${etapaLabel.replace(/[^a-zA-Z0-9]+/g, "_")}-${card.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
}
