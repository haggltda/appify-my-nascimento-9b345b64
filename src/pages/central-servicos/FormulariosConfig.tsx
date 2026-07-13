import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — ⚙ Configurações
// Define QUEM PODE CRIAR formulários (lista de gestores). Lista vazia =
// qualquer usuário autenticado pode criar. A RLS é a autoridade: só quem
// está na lista (ou qualquer um, se vazia) consegue criar formulários e
// mexer nesta configuração.
// Quem pode VER cada formulário é definido no próprio formulário
// (builder → Visibilidade).
// =====================================================================

interface Gestor { id: number; user_id: string; created_at: string; }
interface Perfil { id: string; display_name?: string; email?: string; }

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });

export default function FormulariosConfig() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);
  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 4200); };
  const nome = (uid: string) => { const p = perfis[uid]; return p?.display_name || p?.email || uid.slice(0, 8); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("CS_FORM_ACESSOS").select("id, user_id, created_at").eq("papel", "gestor").order("created_at");
    const gs: Gestor[] = data ?? [];
    setGestores(gs);
    if (gs.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id, display_name, email").in("id", gs.map(g => g.user_id));
      setPerfis(Object.fromEntries((profs ?? []).map((p: Perfil) => [p.id, p])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const buscar = async (q: string) => {
    setBusca(q);
    if (q.trim().length < 2) { setResultados([]); return; }
    const { data } = await (supabase as any).from("profiles")
      .select("id, display_name, email")
      .or(`display_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`).limit(10);
    const ja = new Set(gestores.map(g => g.user_id));
    setResultados((data ?? []).filter((p: Perfil) => !ja.has(p.id)));
  };

  const adicionar = async (p: Perfil) => {
    const { error } = await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel: "gestor", user_id: p.id });
    if (error) { toast(/row-level security/i.test(error.message) ? "Você não tem permissão para alterar esta configuração." : "Erro: " + error.message, "err"); return; }
    setPerfis(x => ({ ...x, [p.id]: p }));
    setBusca(""); setResultados([]);
    toast(`${p.display_name || p.email} agora pode criar formulários.`, "ok");
    load();
  };

  const remover = async (g: Gestor) => {
    if (g.user_id === user?.id && gestores.length > 1 && !confirm("Remover a si mesmo? Você perderá o poder de criar formulários e mexer nesta configuração.")) return;
    const { error } = await (supabase as any).from("CS_FORM_ACESSOS").delete().eq("id", g.id);
    if (error) { toast(/row-level security/i.test(error.message) ? "Você não tem permissão para alterar esta configuração." : "Erro: " + error.message, "err"); return; }
    toast(`${nome(g.user_id)} removido.`, "ok");
    load();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>⚙️ Configurações — Nascimento Formulários</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Quem pode criar formulários. A visibilidade de cada formulário é definida dentro dele (builder → Visibilidade).</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 40px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>Quem pode criar formulários</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, marginBottom: 12 }}>
              {gestores.length === 0
                ? "Lista vazia: QUALQUER usuário do ERP pode criar formulários. Adicione alguém para restringir a criação (e esta configuração) só à lista."
                : "Somente as pessoas abaixo podem criar formulários e alterar esta configuração."}
            </div>

            <div style={{ position: "relative", marginBottom: 14 }}>
              <input placeholder="Buscar usuário por nome ou e-mail..." value={busca} onChange={e => buscar(e.target.value)}
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 11px", fontSize: 13, outline: "none" }} />
              {resultados.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, marginTop: 4, boxShadow: "0 12px 28px rgba(15,23,42,.14)", zIndex: 10, overflow: "hidden" }}>
                  {resultados.map(p => (
                    <div key={p.id} onClick={() => adicionar(p)} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.display_name || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{p.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>Carregando...</div>
            ) : gestores.length === 0 ? (
              <div style={{ padding: "14px", textAlign: "center", color: "#a16207", fontSize: 12.5, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
                🔓 Criação aberta a todos. Busque um usuário acima para restringir.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {gestores.map(g => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#0f3171", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {nome(g.user_id).slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{nome(g.user_id)}{g.user_id === user?.id ? " (você)" : ""}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{perfis[g.user_id]?.email}</div>
                    </div>
                    <button onClick={() => remover(g)} style={btn("rgba(220,38,38,.08)", "#dc2626", "1px solid rgba(220,38,38,.25)")}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 18, right: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.t === "err" ? "#fee2e2" : t.t === "ok" ? "#dcfce7" : "#e0f2fe", color: t.t === "err" ? "#b91c1c" : t.t === "ok" ? "#15803d" : "#0369a1", padding: "10px 16px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, boxShadow: "0 8px 24px rgba(15,23,42,.15)", maxWidth: 380 }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
