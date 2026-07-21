import { useState } from "react";
import { Link } from "react-router-dom";
import { addDays, isSameDay, isWithinInterval, subDays } from "date-fns";
import { useMinhasReunioes, useOcultarReuniaoDaHome } from "../useReunioes";
import { ETAPA_COR, ETAPA_LABEL, salaResumo } from "../types";

type FiltroPeriodo = "hoje" | "proximos_7" | "proximos_30" | "ultimos_7" | "ultimos_30" | "todo_periodo";

const OPCOES_FILTRO: { value: FiltroPeriodo; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "proximos_7", label: "Próximos 7 dias" },
  { value: "proximos_30", label: "Próximos 30 dias" },
  { value: "ultimos_7", label: "Últimos 7 dias" },
  { value: "ultimos_30", label: "Últimos 30 dias" },
  { value: "todo_periodo", label: "Todo o período" },
];

function dentroDoPeriodo(dataHoraIso: string, filtro: FiltroPeriodo, agora: Date): boolean {
  const data = new Date(dataHoraIso);
  switch (filtro) {
    case "hoje": return isSameDay(data, agora);
    case "proximos_7": return isWithinInterval(data, { start: agora, end: addDays(agora, 7) });
    case "proximos_30": return isWithinInterval(data, { start: agora, end: addDays(agora, 30) });
    case "ultimos_7": return isWithinInterval(data, { start: subDays(agora, 7), end: agora });
    case "ultimos_30": return isWithinInterval(data, { start: subDays(agora, 30), end: agora });
    case "todo_periodo": return true;
  }
}

export function MinhasReunioesCard() {
  const { data: reunioes = [], isLoading } = useMinhasReunioes();
  const ocultar = useOcultarReuniaoDaHome();
  const [filtro, setFiltro] = useState<FiltroPeriodo>("hoje");
  const agora = new Date();

  const reunioesFiltradas = reunioes.filter((r) => dentroDoPeriodo(r.data_hora, filtro, agora));

  return (
    <div className="ini-card">
      <div className="ini-card-hd">
        <h3>📅 Minhas Reuniões</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroPeriodo)}
            style={{
              fontSize: ".78rem", fontWeight: 600, color: "#0f172a", background: "#fff",
              border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px", cursor: "pointer",
            }}
          >
            {OPCOES_FILTRO.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Link to="/app/central-servicos/reunioes" style={{ fontSize: ".78rem", fontWeight: 600, color: "#0f3171", textDecoration: "none" }}>
            Ver agenda completa
          </Link>
        </div>
      </div>
      <div className="ini-card-body">
        {isLoading && <p style={{ fontSize: ".82rem", color: "#64748b" }}>Carregando…</p>}
        {!isLoading && reunioesFiltradas.length === 0 && (
          <p style={{ fontSize: ".82rem", color: "#64748b" }}>Nenhuma reunião nesse período.</p>
        )}
        <div className="ini-reuniao-lista">
          {reunioesFiltradas.map((r) => {
            const jaPassou = new Date(r.data_hora).getTime() < agora.getTime();
            return (
              <div key={r.id} className="ini-reuniao-item">
                <Link to={`/app/central-servicos/reunioes/${r.id}`} className="ini-reuniao-info">
                  <span className="ini-reuniao-titulo">{r.titulo}</span>
                  <span className="ini-reuniao-meta">
                    {new Date(r.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {salaResumo(r)}
                  </span>
                </Link>
                <span className={`ini-reuniao-badge ${ETAPA_COR[r.etapa]}`}>{ETAPA_LABEL[r.etapa]}</span>
                {jaPassou && (
                  <button
                    type="button"
                    title="Remover da minha tela inicial"
                    className="ini-reuniao-remover"
                    onClick={() => ocultar.mutate(r.id)}
                  >
                    🗑️
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
