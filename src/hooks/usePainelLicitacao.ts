import { useMemo } from "react";
import { useGrade } from "@/hooks/useGrade";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";

function parseValor(v: string | null): number {
  if (!v) return 0;
  const s = v.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function aberturaUrgencia(d: string | null): "critica" | "proxima" | "normal" | null {
  if (!d) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const abertura = new Date(d + "T00:00:00");
  const dias = Math.ceil((abertura.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return null;
  if (dias <= 3) return "critica";
  if (dias <= 7) return "proxima";
  return "normal";
}

export function usePainelLicitacao() {
  const { empresa } = useEmpresaAtiva();
  const { data: items = [], isLoading } = useGrade(empresa?.id ?? null);

  const stats = useMemo(() => {
    const ativas = items.filter((i) => ["À Iniciar", "Iniciado", "Em Andamento"].includes(i.fase));
    const finalizadas = items.filter((i) => i.fase === "Finalizada");
    const ganhas = finalizadas.filter((i) => i.posicao === 1);
    const perdidas = finalizadas.filter((i) => i.posicao !== 1);
    const valorPipeline = ativas.reduce((s, i) => s + parseValor(i.valor_global), 0);

    // Por responsável
    const respMap = new Map<string, { responsavel: string; qtd: number; valor: number; vitorias: number; perdidas: number }>();
    items.forEach((i) => {
      const key = i.responsavel || "Sem responsável";
      const cur = respMap.get(key) ?? { responsavel: key, qtd: 0, valor: 0, vitorias: 0, perdidas: 0 };
      cur.qtd++;
      cur.valor += parseValor(i.valor_global);
      if (i.fase === "Finalizada" && i.posicao === 1) cur.vitorias++;
      if (i.fase === "Finalizada" && i.posicao !== 1) cur.perdidas++;
      respMap.set(key, cur);
    });
    const porResponsavel = Array.from(respMap.values())
      .map((r) => ({
        ...r,
        taxa: r.vitorias + r.perdidas > 0 ? (r.vitorias / (r.vitorias + r.perdidas)) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // Por fase (funil)
    const fases = ["À Iniciar", "Iniciado", "Em Andamento", "Finalizada", "Não Participado", "Suspenso", "Revogado"] as const;
    const porFase = fases
      .map((fase) => ({ etapa: fase, qtd: items.filter((i) => i.fase === fase).length }))
      .filter((f) => f.qtd > 0);

    // Evolução mensal (últimos 6 meses por created_at)
    const agora = new Date();
    const evolucaoMensal = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(agora.getFullYear(), agora.getMonth() - (5 - idx), 1);
      const mesNome = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const mesItems = items.filter((i) => {
        const c = new Date(i.created_at);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      });
      return {
        mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
        valor: mesItems.reduce((s, i) => s + parseValor(i.valor_global), 0),
        processos: mesItems.length,
      };
    });

    // Alertas: itens com abertura próxima
    const alertas = items
      .filter((i) => i.data && aberturaUrgencia(i.data) !== null && ["À Iniciar", "Iniciado", "Em Andamento"].includes(i.fase))
      .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))
      .slice(0, 10);

    return {
      total: items.length,
      ativas: ativas.length,
      finalizadas: finalizadas.length,
      ganhas: ganhas.length,
      perdidas: perdidas.length,
      valorPipeline,
      taxaVitoria: ganhas.length + perdidas.length > 0
        ? (ganhas.length / (ganhas.length + perdidas.length)) * 100
        : 0,
      porResponsavel,
      porFase,
      evolucaoMensal,
      alertas,
    };
  }, [items]);

  return { stats, isLoading, items };
}
