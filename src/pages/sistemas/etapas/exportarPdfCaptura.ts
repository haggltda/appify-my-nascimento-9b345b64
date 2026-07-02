import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Captura visualmente um elemento DOM e salva como PDF (tipo "print do card").
// Antes de capturar, expande temporariamente qualquer pai com scroll/max-height
// para registrar o conteúdo completo, não apenas a parte visível na tela.
export async function exportarPdfCaptura(
  elementId: string,
  nomeArquivo: string,
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) return;

  // Salva e expande todos os ancestrais com overflow que cortam o conteúdo.
  type SavedStyle = { el: HTMLElement; overflow: string; maxHeight: string; height: string };
  const restaurar: SavedStyle[] = [];
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    const overflowY = cs.overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") {
      restaurar.push({
        el: node as HTMLElement,
        overflow: (node as HTMLElement).style.overflow,
        maxHeight: (node as HTMLElement).style.maxHeight,
        height: (node as HTMLElement).style.height,
      });
      (node as HTMLElement).style.overflow = "visible";
      (node as HTMLElement).style.maxHeight = "none";
      (node as HTMLElement).style.height = "auto";
    }
    node = node.parentElement;
  }

  // html2canvas não renderiza corretamente placeholder de <input> via padding/flex.
  // Injeta CSS temporário para forçar centralização via line-height antes de capturar.
  const pdfStyle = document.createElement("style");
  pdfStyle.textContent = `
    #${elementId} input {
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      line-height: 2.5rem !important;
    }
  `;
  document.head.appendChild(pdfStyle);

  try {
    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: el.scrollHeight + 200,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const MARGEM = 8; // mm em todos os lados
    const pxToMm = 25.4 / 96;
    const larguraMm = canvas.width * pxToMm;
    const alturaMm = canvas.height * pxToMm;
    const pagW = larguraMm + MARGEM * 2;
    const pagH = alturaMm + MARGEM * 2;
    const pdf = new jsPDF({
      orientation: pagH > pagW ? "portrait" : "landscape",
      unit: "mm",
      format: [pagW, pagH],
    });
    pdf.addImage(imgData, "JPEG", MARGEM, MARGEM, larguraMm, alturaMm);
    pdf.save(nomeArquivo);
  } finally {
    pdfStyle.remove();
    restaurar.forEach(({ el: e, overflow, maxHeight, height }) => {
      e.style.overflow = overflow;
      e.style.maxHeight = maxHeight;
      e.style.height = height;
    });
  }
}
