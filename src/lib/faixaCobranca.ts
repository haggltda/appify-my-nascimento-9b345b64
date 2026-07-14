// Réplica exata da régua de faixas do sistema de cobranças antigo (main.py: definir_parecer).
// `dias` = dias corridos desde a data de referência da nota (não é o atraso "real" ainda -
// a empresa dá 30 dias de prazo, então só a partir daí a nota está de fato vencida).

export function definirFaixa(dias: number): string {
  const diasAtraso = dias - 30;

  if (diasAtraso <= 0) return "AVISO AMIGÁVEL (PRÉ-VENCIMENTO)";
  if (diasAtraso <= 15) return "FAIXA VERDE (ATÉ 15 DIAS)";
  if (diasAtraso <= 30) return "FAIXA AMARELA (16 A 30 DIAS)";
  if (diasAtraso <= 60) return "FAIXA LARANJA (31 A 60 DIAS)";
  if (diasAtraso <= 90) return "FAIXA VERMELHA (61 A 90 DIAS)";
  if (diasAtraso <= 120) return "FAIXA ROXA (91 A 120 DIAS)";
  return "FAIXA PRETA (+120 DIAS)";
}

export const FAIXA_COR: Record<string, string> = {
  "AVISO AMIGÁVEL (PRÉ-VENCIMENTO)": "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "FAIXA VERDE (ATÉ 15 DIAS)": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "FAIXA AMARELA (16 A 30 DIAS)": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  "FAIXA LARANJA (31 A 60 DIAS)": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "FAIXA VERMELHA (61 A 90 DIAS)": "bg-red-500/10 text-red-700 dark:text-red-300",
  "FAIXA ROXA (91 A 120 DIAS)": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "FAIXA PRETA (+120 DIAS)": "bg-neutral-800/10 text-neutral-900 dark:bg-neutral-200/10 dark:text-neutral-200",
};
