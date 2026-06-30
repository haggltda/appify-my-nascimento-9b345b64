// Geração do PDF "tipo print do card" por etapa — compartilhado entre os
// painéis ao vivo (botão direto no card) e o modal "Documentos e Assinaturas".
import {
  APROVACOES_TESTES_INTERNOS, COMPLEXIDADE_LABEL, ETAPAS, fmtData, nomeUsuario,
  type Anexo, type Assinatura, type Comentario, type Solicitacao, type Usuario,
} from "./types";
import { PdfDocumento, fmtDataHoraPdf } from "./pdfHelpers";

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));

const ETAPA_CAMPO_ANEXO: Record<string, string> = {
  documentacao_funcional: "documentacao_tecnica",
  analise_tecnica: "analise_tecnica",
  aprovacao_priorizacao: "aprovacao_priorizacao",
  testes_internos: "testes_internos",
  homologacao_area_solicitante: "homologacao_area_solicitante",
  implantacao: "implantacao",
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
    pdf.paragrafo(`${c.titulo} — ${c.autor} (${c.data})`, { negrito: true, tamanho: 9, espacoDepois: 1 });
    pdf.paragrafo(c.texto, { tamanho: 9, espacoDepois: 3 });
  });
  if (linhas.length === 0 && comentariosBloco.length === 0) {
    pdf.paragrafo("—", { tamanho: 9.5, espacoDepois: 2 });
  }

  pdf.y += 1;
  pdf.paragrafo("Anexos:", { negrito: true, tamanho: 9.5, espacoDepois: 1 });
  if (anexosDoCampo.length === 0) {
    pdf.paragrafo("Nenhum.", { tamanho: 9, espacoDepois: 2 });
  } else {
    anexosDoCampo.forEach((a) => pdf.paragrafo(`• ${a.nome_arquivo}`, { tamanho: 9, espacoDepois: 1 }));
  }
}

// Gera e baixa o PDF "tipo print do card" de uma etapa específica.
// assinaturas é opcional — quando chamado dos painéis ao vivo, omite pois
// os painéis não têm acesso a esse dado; quando chamado do modal "Documentos
// e Assinaturas", inclui as assinaturas daquela coluna.
export function exportarPdfEtapa(
  etapaKey: string,
  card: Solicitacao,
  anexos: Anexo[],
  comentarios: Comentario[],
  usuarios: Usuario[],
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
    case "documentacao_funcional":
      desenharCamposEtapa(pdf, [
        `Documentação Funcional: ${card.documentacao_tecnica_texto || "—"}`,
        `Prazo: ${fmtData(card.documentacao_tecnica_prazo) ?? "—"}`,
      ], anexosDoCampo);
      break;
    case "analise_tecnica":
      desenharCamposEtapa(pdf, [
        `Análise Técnica: ${card.analise_tecnica_texto || "—"}`,
        `Prazo: ${fmtData(card.analise_tecnica_prazo) ?? "—"}`,
      ], anexosDoCampo);
      break;
    case "aprovacao_priorizacao":
      desenharCamposEtapa(pdf, [
        `Prioridade: ${card.prioridade ?? "—"}`,
        `Responsável: ${nomeUsuario(usuarios, card.responsavel_user_id) ?? "—"}`,
        `Complexidade: ${card.complexidade ? COMPLEXIDADE_LABEL[card.complexidade] ?? card.complexidade : "—"}`,
      ], anexosDoCampo);
      break;
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
    case "implantacao": {
      const comentariosImplantacao = comentarios
        .filter((c) => c.tipo === "implantacao_comentario")
        .map((c) => textoComentario(c, "Comentário de implantação"));
      desenharCamposEtapa(pdf, [
        `Implantado corretamente: ${card.implantacao_status ? IMPLANTACAO_LABEL[card.implantacao_status] ?? card.implantacao_status : "—"}`,
      ], anexosDoCampo, comentariosImplantacao);
      break;
    }
  }

  if (assinaturas && assinaturas.length > 0) {
    pdf.y += 4;
    pdf.blocoAssinaturasColuna(etapaLabel, assinaturas, usuarios);
  }

  pdf.salvar(`${etapaLabel.replace(/[^a-zA-Z0-9]+/g, "_")}-${card.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
}
