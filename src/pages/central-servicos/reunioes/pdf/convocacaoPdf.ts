// PDF de convocação — gerado a partir do agendamento, antes da reunião
// acontecer: dados do encontro + pauta, sem respostas nem assinaturas.
import { PdfDocumento, fmtDataHoraPdf } from "@/lib/pdf/PdfDocumento";
import type { Reuniao, ReuniaoPauta } from "../types";

export function exportarConvocacaoPdf(reuniao: Reuniao, pauta: ReuniaoPauta[]) {
  const pdf = new PdfDocumento(reuniao.titulo, reuniao.id);
  pdf.tituloSecao("Convocação de Reunião", 18);

  pdf.paragrafo(`Data e horário: ${fmtDataHoraPdf(reuniao.data_hora)}`, { negrito: true, tamanho: 10, espacoDepois: 1 });
  pdf.paragrafo(`${reuniao.tipo_local === "presencial" ? "Local" : "Link"}: ${reuniao.local_ou_link}`, { tamanho: 10, espacoDepois: 1 });
  if (reuniao.objetivo) {
    pdf.paragrafo(`Objetivo: ${reuniao.objetivo}`, { tamanho: 10, espacoDepois: 3 });
  }

  pdf.y += 3;
  pdf.tituloSecao("Pauta", 13);
  if (pauta.length === 0) {
    pdf.paragrafo("Nenhum tópico de pauta cadastrado.", { tamanho: 9.5 });
  } else {
    pauta.forEach((p, i) => {
      pdf.paragrafo(`${i + 1}. ${p.titulo_topico}`, { negrito: true, tamanho: 10, espacoDepois: 1 });
      if (p.descricao) pdf.paragrafo(p.descricao, { tamanho: 9.5, espacoDepois: 3 });
      else pdf.y += 2;
    });
  }

  pdf.salvar(`Convocacao-${reuniao.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
}
