import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FormCap } from "@/hooks/useFormPerms";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - painel de permissões (setinha ▾, só admin)
// Substitui a antiga tela "Configurações". Duas partes:
//   1) Quem pode o quê - concede/retira capacidades por usuário
//      (linhas em CS_FORM_ACESSOS.papel).
//   2) Setores - classifica cada Setor_ERP (de EMPREGADOS) como
//      Administrativo ou Operacional (CS_FORM_SETOR_GRUPO). É o que faz o
//      "Visualizar Administrativo/Operacional" filtrar as respostas.
// =====================================================================

interface Perfil { id: string; display_name?: string; email?: string; }

export const CAPS: { papel: FormCap; rotulo: string; desc: string }[] = [
  { papel: "editar_criar",     rotulo: "Editar / Criar",           desc: "Criar e editar formulários" },
  { papel: "responder",        rotulo: "Responder",                desc: "Abrir e enviar respostas" },
  { papel: "encerrar_excluir", rotulo: "Encerrar / Excluir",       desc: "Publicar, encerrar, reabrir e excluir" },
  { papel: "ver_tudo",         rotulo: "Visualizar tudo",          desc: "Ver todas as respostas" },
  { papel: "ver_admin",        rotulo: "Visualizar Administrativo", desc: "Respostas dos setores administrativos" },
  { papel: "ver_op",           rotulo: "Visualizar Operacional",   desc: "Respostas dos setores operacionais" },
  { papel: "ver_proprias",     rotulo: "Só as próprias respostas", desc: "Só o que a própria pessoa enviou" },
];

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const chip = (on: boolean): React.CSSProperties => ({
  padding: "4px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
  border: on ? "1px solid #0f3171" : "1px solid #e2e8f0",
  background: on ? "#0f3171" : "#fff", color: on ? "#fff" : "#64748b",
});

export default function FormulariosPermissoes({ onToast }: { onToast: (m: string, t?: string) => void }) {
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [extras, setExtras] = useState<string[]>([]); // usuários adicionados sem capacidade ainda
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Perfil[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<Record<string, "administrativo" | "operacional">>({});
  const [loading, setLoading] = useState(true);

  const nome = (uid: string) => perfis[uid]?.display_name || perfis[uid]?.email || uid.slice(0, 8);

  const load = useCallback(async () => {
    setLoading(true);
    const [gRes, sgRes, empRes] = await Promise.all([
      (supabase as any).from("CS_FORM_ACESSOS").select("user_id, papel").neq("papel", "dashboard"),
      (supabase as any).from("CS_FORM_SETOR_GRUPO").select("setor, grupo"),
      (supabase as any).from("EMPREGADOS").select('"Setor_ERP"').limit(20000),
    ]);
    const g: Record<string, Set<string>> = {};
    (gRes.data ?? []).forEach((r: any) => { (g[r.user_id] ??= new Set()).add(r.papel); });
    setGrants(g);
    const ids = Object.keys(g);
    if (ids.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id, display_name, email").in("id", ids);
      setPerfis(Object.fromEntries((profs ?? []).map((p: Perfil) => [p.id, p])));
    }
    setGrupos(Object.fromEntries((sgRes.data ?? []).map((r: any) => [r.setor, r.grupo])));
    const sets = [...new Set((empRes.data ?? []).map((r: any) => String(r["Setor_ERP"] ?? "").trim()).filter(Boolean))].sort();
    setSetores(sets as string[]);
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
    if (tem) {
      const { error } = await (supabase as any).from("CS_FORM_ACESSOS").delete().eq("user_id", uid).eq("papel", papel);
      if (error) { onToast(/row-level|permission/i.test(error.message) ? "Só administradores alteram permissões." : "Erro: " + error.message, "err"); return; }
      setGrants(g => { const s = new Set(g[uid]); s.delete(papel); return { ...g, [uid]: s }; });
    } else {
      const { error } = await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel, user_id: uid });
      if (error) { onToast(/row-level|permission/i.test(error.message) ? "Só administradores alteram permissões." : "Erro: " + error.message, "err"); return; }
      setGrants(g => ({ ...g, [uid]: new Set([...(g[uid] ?? []), papel]) }));
    }
  };

  const setGrupo = async (setor: string, grupo: "administrativo" | "operacional" | "") => {
    if (!grupo) {
      const { error } = await (supabase as any).from("CS_FORM_SETOR_GRUPO").delete().eq("setor", setor);
      if (error) { onToast("Erro: " + error.message, "err"); return; }
      setGrupos(x => { const y = { ...x }; delete y[setor]; return y; });
    } else {
      const { error } = await (supabase as any).from("CS_FORM_SETOR_GRUPO").upsert({ setor, grupo, updated_at: new Date().toISOString() }, { onConflict: "setor" });
      if (error) { onToast(/row-level|permission/i.test(error.message) ? "Só administradores classificam setores." : "Erro: " + error.message, "err"); return; }
      setGrupos(x => ({ ...x, [setor]: grupo }));
    }
  };

  const usuarios = [...new Set([...Object.keys(grants), ...extras])];
  const inp: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 11px", fontSize: 13, outline: "none" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>🔐 Permissões dos Formulários</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14 }}>Só administradores. Quem pode cada ação e quais setores são administrativos/operacionais.</div>

      {loading ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>Carregando…</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 1) Quem pode o quê */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Quem pode o quê</div>
            <div style={{ position: "relative", marginBottom: 12, maxWidth: 420 }}>
              <input placeholder="Buscar usuário por nome ou e-mail para adicionar…" value={busca} onChange={e => buscar(e.target.value)} style={inp} />
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
                Ninguém com permissão específica ainda. Administradores já fazem tudo; adicione usuários para dar acesso granular.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {usuarios.map(uid => (
                  <div key={uid} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{nome(uid)} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{perfis[uid]?.email}</span></div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {CAPS.map(c => (
                        <span key={c.papel} title={c.desc} onClick={() => toggleCap(uid, c.papel)} style={chip(!!grants[uid]?.has(c.papel))}>{c.rotulo}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2) Setores → grupo */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>Setores - Administrativo × Operacional</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 8 }}>
              Setores vêm de EMPREGADOS (Setor_ERP). Quem tem “Visualizar Administrativo” vê as respostas dos setores marcados como Administrativo; idem Operacional. A resposta é classificada pela pergunta de setor do formulário (definida no editor).
            </div>
            {setores.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Nenhum setor encontrado em EMPREGADOS.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>
                {setores.map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "7px 10px" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s}>{s}</span>
                    <select value={grupos[s] ?? ""} onChange={e => setGrupo(s, e.target.value as any)}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 6px", fontSize: 11.5, fontWeight: 700, outline: "none",
                        background: grupos[s] === "administrativo" ? "#eef2ff" : grupos[s] === "operacional" ? "#ecfdf5" : "#fff",
                        color: grupos[s] === "administrativo" ? "#4338ca" : grupos[s] === "operacional" ? "#15803d" : "#94a3b8" }}>
                      <option value="">-</option>
                      <option value="administrativo">Administrativo</option>
                      <option value="operacional">Operacional</option>
                    </select>
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
