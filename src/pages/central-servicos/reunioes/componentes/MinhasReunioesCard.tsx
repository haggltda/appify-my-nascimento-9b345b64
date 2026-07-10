import { Link } from "react-router-dom";
import { useMinhasReunioes, useOcultarReuniaoDaHome } from "../useReunioes";
import { ETAPA_COR, ETAPA_LABEL } from "../types";

export function MinhasReunioesCard() {
  const { data: reunioes = [], isLoading } = useMinhasReunioes();
  const ocultar = useOcultarReuniaoDaHome();
  const agora = Date.now();

  return (
    <div className="ini-card">
      <div className="ini-card-hd">
        <h3>📅 Minhas Reuniões</h3>
        <Link to="/app/central-servicos/reunioes" style={{ fontSize: ".78rem", fontWeight: 600, color: "#0f3171", textDecoration: "none" }}>
          Ver agenda completa
        </Link>
      </div>
      <div className="ini-card-body">
        {isLoading && <p style={{ fontSize: ".82rem", color: "#64748b" }}>Carregando…</p>}
        {!isLoading && reunioes.length === 0 && (
          <p style={{ fontSize: ".82rem", color: "#64748b" }}>Nenhuma reunião envolvendo você no momento.</p>
        )}
        <div className="ini-reuniao-lista">
          {reunioes.map((r) => {
            const jaPassou = new Date(r.data_hora).getTime() < agora;
            return (
              <div key={r.id} className="ini-reuniao-item">
                <Link to={`/app/central-servicos/reunioes/${r.id}`} className="ini-reuniao-info">
                  <span className="ini-reuniao-titulo">{r.titulo}</span>
                  <span className="ini-reuniao-meta">
                    {new Date(r.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {r.tipo_local === "presencial" ? r.local_ou_link : "Online"}
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
