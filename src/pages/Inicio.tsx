import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MinhasReunioesCard } from "@/pages/central-servicos/reunioes/componentes/MinhasReunioesCard";

const QA = [
  { to: "/app/editais",                 icon: "📋", label: "Licitações" },
  { to: "/app/contratos/ativos",        icon: "📄", label: "Contratos" },
  { to: "/app/controladoria",           icon: "📊", label: "Controladoria" },
  { to: "/app/financeiro/contas-pagar", icon: "💰", label: "Financeiro" },
  { to: "/app/rh/colaboradores",        icon: "👥", label: "RH" },
  { to: "/app/suprimentos/requisicoes", icon: "🛒", label: "Suprimentos" },
  { to: "/app/bi",                      icon: "📈", label: "BI" },
  { to: "/app/rh/recrutamento",         icon: "🎯", label: "Recrutamento" },
  { to: "/app/meu-perfil",              icon: "👤", label: "Meu Perfil" },
  { to: "/app/encarregados/minhas-solicitacoes", icon: "📤", label: "Minhas Solicitações" },
];

export default function Inicio() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name || data?.email || user.email || ""));
  }, [user?.id]);

  const firstName = displayName.split(" ")[0] || "bem-vindo";

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "inicio-styles";
    style.textContent = `
      .ini-hero{background:linear-gradient(135deg,#0f3171 0%,#1e4a8a 55%,#2d5fa3 100%);border-radius:20px;padding:40px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(15,49,113,.25);}
      .ini-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,.15) 0%,transparent 70%);pointer-events:none;}
      .ini-hero::after{content:'';position:absolute;bottom:-80px;left:30%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%);pointer-events:none;}
      .ini-hero-title{font-size:2.1rem;font-weight:800;color:#fff;line-height:1.15;letter-spacing:-.02em;}
      .ini-hero-title span{color:#fbbf24;}
      .ini-hero-verse{font-size:.9rem;color:rgba(255,255,255,.72);margin-top:8px;font-style:italic;line-height:1.6;}
      .ini-hero-verse strong{color:rgba(255,255,255,.9);font-style:normal;}
      .ini-hero-badge{flex-shrink:0;text-align:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:18px 22px;backdrop-filter:blur(8px);}
      .ini-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden;margin-bottom:20px;}
      .ini-card-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e2e8f0;}
      .ini-card-hd h3{font-size:.94rem;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:7px;}
      .ini-card-body{padding:16px 20px;}
      .ini-qa{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;}
      .ini-qa-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 10px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;text-decoration:none;color:#0f172a;transition:all .15s;text-align:center;box-shadow:0 1px 4px rgba(15,23,42,.04);}
      .ini-qa-btn:hover{border-color:#0f3171;background:#eef4ff;color:#0f3171;transform:translateY(-2px);box-shadow:0 6px 16px rgba(15,49,113,.1);}
      .ini-qa-btn .icon{font-size:1.3rem;}
      .ini-qa-btn span{font-size:.72rem;font-weight:600;line-height:1.2;}
      .ini-reuniao-lista{display:flex;flex-direction:column;gap:8px;}
      .ini-reuniao-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;transition:all .15s;}
      .ini-reuniao-item:hover{border-color:#0f3171;background:#f8fafc;}
      .ini-reuniao-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-decoration:none;color:inherit;}
      .ini-reuniao-titulo{font-size:.86rem;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .ini-reuniao-meta{font-size:.74rem;color:#64748b;}
      .ini-reuniao-badge{flex-shrink:0;font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid;}
      .ini-reuniao-remover{flex-shrink:0;background:none;border:none;cursor:pointer;font-size:.85rem;opacity:.55;padding:2px;}
      .ini-reuniao-remover:hover{opacity:1;}
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("inicio-styles")?.remove(); };
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px", background: "#f5f7fb" }}>

      {/* ── Hero ── */}
      <div className="ini-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="ini-hero-title">
            Olá, <span>{firstName}</span>!<br />
            Consagre o seu trabalho.
          </div>
          <p className="ini-hero-verse">
            Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.<br />
            <strong>(Provérbios 16:3)</strong>
          </p>
        </div>
        <div className="ini-hero-badge" style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: "rgba(255,255,255,.55)" }}>Versículo do dia</p>
          <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fbbf24", marginTop: 4 }}>Prov. 16:3</p>
        </div>
      </div>

      {/* ── Acesso Rápido ── */}
      <div className="ini-card">
        <div className="ini-card-hd">
          <h3>⚡ Acesso Rápido</h3>
        </div>
        <div className="ini-card-body">
          <div className="ini-qa">
            {QA.map(q => (
              <Link key={q.to} to={q.to} className="ini-qa-btn">
                <span className="icon">{q.icon}</span>
                <span>{q.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Minhas Reuniões ── */}
      <MinhasReunioesCard />

    </div>
  );
}
