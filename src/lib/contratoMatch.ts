// Casamento difuso de nome de contrato (planilha) contra a tabela `contrato`.
// Mesma técnica validada no sistema de cobranças antigo (main.py: normalizar_contrato):
// só arrisca um match automático quando o nome bate exato ou o número final do
// contrato é único entre os candidatos — o resto fica pra revisão manual.

export function normalizarContrato(txt: unknown): string {
  return String(txt ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function numeroFinalContrato(txtNormalizado: string): string {
  const m = txtNormalizado.match(/(\d+)$/);
  return m ? m[1] : "";
}

export interface ContratoCandidato {
  id: string;
  numero: string | null;
  orgao: string | null;
  empresa_id: string;
}

export type TipoMatchContrato = "exato" | "numero_unico" | "sem_match";

export function encontrarContrato(
  candidatos: ContratoCandidato[],
  alvo: string,
): { match: ContratoCandidato | null; tipo: TipoMatchContrato } {
  const chaveAlvo = normalizarContrato(alvo);

  const exato = candidatos.find((c) => normalizarContrato(`${c.orgao ?? ""}${c.numero ?? ""}`) === chaveAlvo);
  if (exato) return { match: exato, tipo: "exato" };

  const numAlvo = numeroFinalContrato(chaveAlvo);
  if (numAlvo) {
    const mesmoNumero = candidatos.filter((c) => numeroFinalContrato(normalizarContrato(c.numero)) === numAlvo);
    if (mesmoNumero.length === 1) return { match: mesmoNumero[0], tipo: "numero_unico" };
  }

  return { match: null, tipo: "sem_match" };
}
