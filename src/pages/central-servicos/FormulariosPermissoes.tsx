import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FormCap } from "@/hooks/useFormPerms";

// =====================================================================
// NASCIMENTO FORMULARIOS - painel de permissoes (so admin, dentro do
// Modulos & Menus). Tres partes:
//   1) Quem pode o que - capacidades por USUARIO
//   2) Permissoes por SETOR - capacidades por Setor_ERP (ex.: COMPRAS so
//      responde, SISTEMAS faz tudo) + classificacao Administrativo/Operacional
// Por padrao todo autenticado ja pode "Responder".
// =====================================================================

interface Perfil { id: string; display_name?: string; email?: string; }

export const CAPS: { papel: FormCap; rotulo: string; desc: string }[] = [
  { papel: "editar_criar",     rotulo: "Editar / Criar",           desc: "Criar e editar formularios" },
  { papel: "responder",        rotulo: "Responder",                desc: "Abrir e enviar respostas (padrao de todos)" },
  { papel: "encerrar_excluir", rotulo: "Encerrar / Excluir",       desc: "Publicar, encerrar, reabrir e excluir" },
  { papel: "ver_tudo",         rotulo: "Visualizar tudo",          desc: "Ver todas as respostas" },
  { papel: "ver_admin",        rotulo: "Visualizar Administrativo", desc: "Respostas dos setores administrativos" },
  { papel: "ver_op",           rotulo: "Visualizar Operacional",   desc: "Respostas dos setores operacionais" },
  { papel: "ver_proprias",     rotulo: "So as proprias respostas", desc: "So o que a propria pessoa enviou" },
];

const chip = (on: boolean): React.CSSProperties => ({
  padding: "4px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
  border: on ? "1px solid #0f3171" : "1px solid #e2e8f0",
  background: on ? "#0f3171" : "#fff", color: on ? "#fff" : "#64748b",
});

// ─────────────────────────────────────────────────────────────────────────
// Capacidades de UM usuario (usado na cascata de "Acesso por Usuario", dentro
// de Modulos & Menus). Mostra os toggles do proprio usuario + o padrao herdado
// do setor dele (Setor_ERP), pra dar pra sobrepor o padrao caso a caso.
// Ex.: setor COMPRAS sem nada, mas um usuario de la pode "Editar / Criar".
// ─────────────────────────────────────────────────────────────────────────
export function FormPermsUsuario({ userId, onToast }: { userId: string; onToast: (m: string, t?: string) => void }) {
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [setor, setSetor] = useState<string | null>(null);
  const [setorCaps, setSetorCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const erroPerm = (m: string) => /row-level|permission|policy/i.test(m) ? "So administradores alteram permissoes." : "Erro: " + m;

  const load = useCallback(async () => {
    setLoading(true);
    const [uRes, eRes] = await Promise.all([
      (supabase as any).from("CS_FORM_ACESSOS").select("papel").eq("user_id", userId).neq("papel", "dashboard"),
      (supabase as any).from("EMPREGADOS").select('"Setor_ERP"').eq("auth_user_id", userId).limit(1),
    ]);
    const st = eRes.data?.[0]?.["Setor_ERP"] ? String(eRes.data[0]["Setor_ERP"]).trim() : null;
    let sc = new Set<string>();
    if (st) {
      const sRes = await (supabase as any).from("CS_FORM_ACESSOS").select("papel").eq("setor", st);
      sc = new Set<string>((sRes.data ?? []).map((r: any) => r.papel));
    }
    setCaps(new Set<string>((uRes.data ?? []).map((r: any) => r.papel)));
    setSetor(st); setSetorCaps(sc); setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (papel: FormCap) => {
    const tem = caps.has(papel);
    const { error } = tem
      ? await (supabase as any).from("CS_FORM_ACESSOS").delete().eq("user_id", userId).eq("papel", papel)
      : await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel, user_id: userId });
    if (error) { onToast(erroPerm(error.message), "err"); return; }
    setCaps(c => { const n = new Set(c); tem ? n.delete(papel) : n.add(papel); return n; });
  };

  if (loading) return <div style={{ padding: "8px 2px", fontSize: 12, color: "#94a3b8" }}>Carregando permissoes...</div>;

  return (
    <div style={{ padding: "2px 2px 4px" }}>
      <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 8 }}>
        O que <b>este usuario</b> pode fazer nos formularios{setor ? <> (setor <b>{setor}</b>)</> : ""}. Vale por cima do padrao do setor. <span style={{ color: "#94a3b8" }}>Responder ja e liberado a todos.</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CAPS.map(c => {
          const on = caps.has(c.papel);
          const viaSetor = !on && setorCaps.has(c.papel);
          return (
            <span key={c.papel} title={c.desc + (viaSetor ? " - ja liberado pelo setor" : "")} onClick={() => toggle(c.papel)}
              style={{ ...chip(on), ...(viaSetor ? { borderStyle: "dashed", borderColor: "#22c55e", color: "#15803d" } : {}) }}>
              {c.rotulo}{viaSetor ? " · setor" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function FormulariosPermissoes({ onToast }: { onToast: (m: string, t?: string) => void }) {
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});          // user_id -> papeis
  const [setorGrants, setSetorGrants] = useState<Record<string, Set<string>>>({}); // setor -> papeis
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Perfil[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<Record<string, "administrativo" | "operacional">>({});
  const [loading, setLoading] = useState(true);

  const nome = (uid: string) => perfis[uid]?.display_name || perfis[uid]?.email || uid.slice(0, 8);
  const erroPerm = (m: string) => /row-level|permission|policy/i.test(m) ? "So administradores alteram permissoes." : "Erro: " + m;

  const load = useCallback(async () => {
    setLoading(true);
    const [gRes, sgRes, empRes] = await Promise.all([
      (supabase as any).from("CS_FORM_ACESSOS").select("user_id, setor, papel").neq("papel", "dashboard"),
      (supabase as any).from("CS_FORM_SETOR_GRUPO").select("setor, grupo"),
      (supabase as any).from("EMPREGADOS").select('"Setor_ERP"').limit(20000),
    ]);
    const g: Record<string, Set<string>> = {};
    const sg: Record<string, Set<string>> = {};
    (gRes.data ?? []).forEach((r: any) => {
      if (r.user_id) (g[r.user_id] ??= new Set()).add(r.papel);
      else if (r.setor) (sg[r.setor] ??= new Set()).add(r.papel);
    });
    setGrants(g); setSetorGrants(sg);
    const ids = Object.keys(g);
    if (ids.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id, display_name, email").in("id", ids);
      setPerfis(Object.fromEntries((profs ?? []).map((p: Perfil) => [p.id, p])));
    }
    setGrupos(Object.fromEntries((sgRes.data ?? []).map((r: any) => [r.setor, r.grupo])));
    setSetores([...new Set((empRes.data ?? []).map((r: any) => String(r["Setor_ERP"] ?? "").trim()).filter(Boolean))].sort() as string[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const buscar = async (q: string) => {
    setBusca(q);
    if (q.trim().length < 2) { setResultados([]); return; }
    const { data } = await (supabase as any).from("profiles")
      .select("id, display_name, email")
      .or(`display_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`).limit(8);
    const ja = new Set([...Object.keys(grants), ...extras]);
    setResultados((data ?? []).filter((p: Perfil) => !ja.has(p.id)));
  };
  const addUser = (p: Perfil) => {
    setPerfis(x => ({ ...x, [p.id]: p }));
    setExtras(x => [...new Set([...x, p.id])]);
    setBusca(""); setResultados([]);
  };

  const toggleCap = async (uid: string, papel: FormCap) => {
    const tem = grants[uid]?.has(papel);
    const { error } = tem
      ? await (supabase as any).from("CS_FORM_ACESSOS").delete().eq("user_id", uid).eq("papel", papel)
      : await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel, user_id: uid });
    if (error) { onToast(erroPerm(error.message), "err"); return; }
    setGrants(g => { const s = new Set(g[uid]); tem ? s.delete(papel) : s.add(papel); return { ...g, [uid]: s }; });
  };

  const toggleSetorCap = async (setor: string, papel: FormCap) => {
    const tem = setorGrants[setor]?.has(papel);
    const { error } = tem
      ? await (supabase as any).from("CS_FORM_ACESSOS").delete().eq("setor", setor).eq("papel", papel)
      : await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel, setor });
    if (error) { onToast(erroPerm(error.message), "err"); return; }
    setSetorGrants(g => { const s = new Set(g[setor]); tem ? s.delete(papel) : s.add(papel); return { ...g, [setor]: s }; });
  };

  const setGrupo = async (setor: string, grupo: "administrativo" | "operacional" | "") => {
    if (!grupo) {
      const { error } = await (supabase as any).from("CS_FORM_SETOR_GRUPO").delete().eq("setor", setor);
      if (error) { onToast(erroPerm(error.message), "err"); return; }
      setGrupos(x => { const y = { ...x }; delete y[setor]; return y; });
    } else {
      const { error } = await (supabase as any).from("CS_FORM_SETOR_GRUPO").upsert({ setor, grupo, updated_at: new Date().toISOString() }, { onConflict: "setor" });
      if (error) { onToast(erroPerm(error.message), "err"); return; }
      setGrupos(x => ({ ...x, [setor]: grupo }));
    }
  };

  const usuarios = [...new Set([...Object.keys(grants), ...extras])];
  const inp: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 11px", fontSize: 13, outline: "none" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>🔐 Permissoes dos Formularios</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14 }}>So administradores. Por padrao todo mundo ja pode <b>Responder</b> - aqui voce libera o resto por usuario ou por setor.</div>

      {loading ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>Carregando...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 1) Por usuario */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Por usuario</div>
            <div style={{ position: "relative", marginBottom: 12, maxWidth: 420 }}>
              <input placeholder="Buscar usuario por nome ou e-mail para adicionar..." value={busca} onChange={e => buscar(e.target.value)} style={inp} />
              {resultados.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, marginTop: 4, boxShadow: "0 12px 28px rgba(15,23,42,.14)", zIndex: 20, overflow: "hidden" }}>
                  {resultados.map(p => (
                    <div key={p.id} onClick={() => addUser(p)} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.display_name || "-"}</div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{p.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {usuarios.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", color: "#a16207", fontSize: 12.5, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
                Ninguem com permissao especifica por usuario. Admins ja fazem tudo; adicione alguem para dar acesso individual.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {usuarios.map(uid => (
                  <div key={uid} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{nome(uid)} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{perfis[uid]?.email}</span></div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {CAPS.map(c => <span key={c.papel} title={c.desc} onClick={() => toggleCap(uid, c.papel)} style={chip(!!grants[uid]?.has(c.papel))}>{c.rotulo}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2) Por setor (capacidades + grupo Administrativo/Operacional) */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>Por setor</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 8 }}>
              Setores vem de EMPREGADOS (Setor_ERP). Marque o que cada setor pode (ex.: COMPRAS so Responder, SISTEMAS tudo) e classifique como Administrativo/Operacional (usado pelo "Visualizar Administrativo/Operacional").
            </div>
            {setores.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Nenhum setor encontrado em EMPREGADOS.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {setores.map(s => (
                  <div key={s} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{s}</span>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>Grupo:</span>
                      <select value={grupos[s] ?? ""} onChange={e => setGrupo(s, e.target.value as any)}
                        style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 6px", fontSize: 11.5, fontWeight: 700, outline: "none",
                          background: grupos[s] === "administrativo" ? "#eef2ff" : grupos[s] === "operacional" ? "#ecfdf5" : "#fff",
                          color: grupos[s] === "administrativo" ? "#4338ca" : grupos[s] === "operacional" ? "#15803d" : "#94a3b8" }}>
                        <option value="">-</option>
                        <option value="administrativo">Administrativo</option>
                        <option value="operacional">Operacional</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {CAPS.map(c => <span key={c.papel} title={c.desc} onClick={() => toggleSetorCap(s, c.papel)} style={chip(!!setorGrants[s]?.has(c.papel))}>{c.rotulo}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
