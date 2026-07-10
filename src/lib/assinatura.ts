// Gera uma "assinatura" a partir do nome digitado, renderizado num canvas em
// letra cursiva/emendada (não é desenho à mão) — usado tanto em Solicitações
// ERP quanto em Atas de Reunião.
export const FONTE_ASSINATURA = "'Dancing Script', cursive";

export async function gerarPngAssinatura(nome: string): Promise<string> {
  await document.fonts.load(`700 64px ${FONTE_ASSINATURA}`);
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 220;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1e293b";
  ctx.font = `700 72px ${FONTE_ASSINATURA}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(nome, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}
