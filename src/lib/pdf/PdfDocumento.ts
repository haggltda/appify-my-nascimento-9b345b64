// Helper compartilhado pra gerar PDFs no padrão visual do app (azul-marinho/
// verde) - usado tanto pelos documentos de Solicitações ERP quanto por Atas
// de Reunião.
import jsPDF from "jspdf";

export const NAVY: [number, number, number] = [21, 49, 105];
export const NAVY_SUAVE: [number, number, number] = [110, 130, 165];
export const VERDE: [number, number, number] = [27, 145, 84];

const MARGEM_X = 15;
const MARGEM_DIREITA = 195;
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function fmtDataHoraPdf(iso: string): string {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = MESES_ABREV[d.getMonth()];
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${dia} ${mes} ${d.getFullYear()} às ${hora}`;
}

export interface Assinante {
  nome: string;
  created_at: string;
}

// Encapsula o cursor "y" e o cabeçalho/rodapé repetido em cada página, pra
// não ter que threadar isso manualmente em cada gerador de PDF novo.
export class PdfDocumento {
  doc: jsPDF;
  y = 38;
  private docId: string;
  private titulo: string;

  constructor(titulo: string, idBase: string) {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.titulo = titulo;
    this.docId = idBase.slice(0, 8);
    this.cabecalho();
  }

  private cabecalho() {
    const doc = this.doc;
    const geradoEm = fmtDataHoraPdf(new Date().toISOString());
    doc.setFontSize(8);
    doc.setTextColor(...NAVY_SUAVE);
    doc.text("Datas e horários em GMT -03:00 Brasília", MARGEM_DIREITA, 14, { align: "right" });
    doc.text(`PDF gerado em ${geradoEm}`, MARGEM_DIREITA, 18.5, { align: "right" });
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(this.titulo, MARGEM_X, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY_SUAVE);
    doc.text(`Documento número #${this.docId}`, MARGEM_X, 21);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.7);
    doc.line(MARGEM_X - 4, 25.5, MARGEM_DIREITA, 25.5);
  }

  novaPagina() {
    this.doc.addPage();
    this.y = 38;
    this.cabecalho();
  }

  garantirEspaco(minimo: number) {
    if (this.y + minimo > 270) this.novaPagina();
  }

  tituloSecao(texto: string, fontSize = 16) {
    this.garantirEspaco(fontSize > 16 ? 24 : 14);
    const doc = this.doc;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(20);
    doc.text(texto, MARGEM_X, this.y);
    this.y += fontSize > 16 ? 12 : 8;
  }

  paragrafo(texto: string, opts?: { negrito?: boolean; tamanho?: number; cor?: [number, number, number]; espacoDepois?: number }) {
    const doc = this.doc;
    const tamanho = opts?.tamanho ?? 9.5;
    doc.setFont("helvetica", opts?.negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(...(opts?.cor ?? [40, 40, 40]));
    const linhas = doc.splitTextToSize(texto, 170) as string[];
    linhas.forEach((linha) => {
      this.garantirEspaco(8);
      doc.text(linha, MARGEM_X, this.y);
      this.y += tamanho * 0.42;
    });
    this.y += opts?.espacoDepois ?? 3;
  }

  // "Assinaturas - <rótulo>" numa caixa com borda - mesmo padrão visual já
  // usado no PDF de assinaturas de Solicitações ERP.
  blocoAssinaturasColuna(rotulo: string, lista: Assinante[]) {
    const doc = this.doc;
    this.garantirEspaco(30);

    const abrirTitulo = () => {
      const boxStartY = this.y - 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text("Assinaturas", MARGEM_X, this.y);
      const largura = doc.getTextWidth("Assinaturas");
      doc.setTextColor(...NAVY_SUAVE);
      doc.text(` - ${rotulo}`, MARGEM_X + largura, this.y);
      this.y += 9;
      return boxStartY;
    };

    let boxStartY = abrirTitulo();

    lista.forEach((a) => {
      if (this.y > 250) {
        this.fecharBox(boxStartY, this.y + 4);
        this.novaPagina();
        boxStartY = abrirTitulo();
      }
      this.desenharCheckCirculo(MARGEM_X + 1.8, this.y - 1.6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(20);
      doc.text(a.nome, MARGEM_X + 6, this.y);
      this.y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Assinou em ${fmtDataHoraPdf(a.created_at)}`, MARGEM_X + 6, this.y);
      this.y += 8;
    });

    if (lista.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Nenhuma assinatura registrada.", MARGEM_X + 6, this.y);
      this.y += 8;
    }

    this.y += 2;
    this.fecharBox(boxStartY, this.y + 3);
    this.y += 11;
  }

  private fecharBox(boxStartY: number, fimY: number) {
    const doc = this.doc;
    doc.setDrawColor(214, 221, 232);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGEM_X - 4, boxStartY, 172, fimY - boxStartY, 2, 2);
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGEM_X - 4, boxStartY, 1.6, fimY - boxStartY, 0.8, 0.8, "F");
  }

  private desenharCheckCirculo(cx: number, cy: number) {
    const doc = this.doc;
    doc.setFillColor(...VERDE);
    doc.circle(cx, cy, 1.8, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.45);
    doc.line(cx - 0.9, cy, cx - 0.2, cy + 0.7);
    doc.line(cx - 0.2, cy + 0.7, cx + 1, cy - 0.9);
  }

  salvar(nomeArquivo: string) {
    const total = this.doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p);
      this.doc.setDrawColor(...NAVY_SUAVE);
      this.doc.setLineWidth(0.2);
      this.doc.line(MARGEM_X - 4, 283, MARGEM_DIREITA, 283);
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...NAVY_SUAVE);
      this.doc.text(`#${this.docId}`, MARGEM_X, 287);
      this.doc.text(`Página ${p} de ${total}`, MARGEM_DIREITA, 287, { align: "right" });
    }
    this.doc.save(nomeArquivo);
  }
}
