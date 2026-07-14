import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import type { FormCap } from "@/hooks/useFormPerms";

// =====================================================================
// NASCIMENTO FORMULARIOS - permissoes por USUARIO (so admin).
// Admin faz tudo; 'responder' e o default de todos; o resto e liberado
// por usuario aqui. Sem heranca por setor.
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

const erroPerm = (m: string) => /row-level|permission|policy/i.test(m) ? "So administradores alteram permissoes." : "Erro: " + m;

// ─────────────────────────────────────────────────────────────────────────
// Capacidades de UM usuario, no padrao dos switches azuis (usado na cascata de
// "Acesso por Usuario", dentro de Modulos & Menus). Desmarcar tudo aqui deixa o
// usuario so com 'responder' (e admin, se for). Sem heranca de setor.
// ─────────────────────────────────────────────────────────────────────────
export function FormPermsUsuario({ userId, onToast }: { userId: string; onToast: (m: string, t?: string) => void }) {
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const uRes = await (supabase as any).from("CS_FORM_ACESSOS").select("papel").eq("user_id", userId).neq("papel", "dashboard");
    setCaps(new Set<string>((uRes.data ?? []).map((r: any) => r.papel)));
    setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (papel: FormCap, next: boolean) => {
    const { error } = next
      ? await (supabase as any).from("CS_FORM_ACESSOS").insert({ papel, user_id: userId })
      : await (supabase as any).from("CS_FORM_ACESSOS").delete().eq("user_id", userId).eq("papel", papel);
    if (error) { onToast(erroPerm(error.message), "err"); return; }
    setCaps(c => { const n = new Set(c); next ? n.add(papel) : n.delete(papel); return n; });
  };

  if (loading) return <p className="px-12 py-3 text-sm text-muted-foreground">Carregando permissões…</p>;

  return (
    <div>
      <p className="px-12 pt-2 pb-1 text-[11px] text-muted-foreground">
        O que <b>este usuário</b> pode fazer nos formulários. <span className="opacity-70">Responder já é liberado a todos.</span>
      </p>
      <div className="divide-y divide-border/60">
        {CAPS.map((c) => (
          <div key={c.papel} className="flex items-center gap-2 px-12 py-2.5 hover:bg-muted/40">
            <div className="flex-1">
              <p className="text-sm">{c.rotulo}</p>
              <p className="text-[11px] text-muted-foreground">{c.desc}</p>
            </div>
            <Switch checked={caps.has(c.papel)} onCheckedChange={(v) => toggle(c.papel, v)} aria-label={c.rotulo} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FormulariosPermissoes({ onToast }: { onToast: (m: string, t?: string) => void }) {
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});          // user_id -> papeis
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);

  const nome = (uid: string) => perfis[uid]?.display_name || perfis[uid]?.email || uid.slice(0, 8);

  const load = useCallback(async () => {
    setLoading(true);
    const gRes = await (supabase as any).from("CS_FORM_ACESSOS").select("user_id, papel").not("user_id", "is", null).neq("papel", "dashboard");
    const g: Record<string, Set<string>> = {};
    (gRes.data ?? []).forEach((r: any) => { if (r.user_id) (g[r.user_id] ??= new Set()).add(r.papel); });
    setGrants(g);
    const ids = Object.keys(g);
    if (ids.length) {
      const { data: profs } = await (supabase as any).from("profiles").select("id, display_name, email").in("id", ids);
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

  const usuarios = [...new Set([...Object.keys(grants), ...extras])];
  const inp: React.CSSProperties = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 11px", fontSize: 13, outline: "none" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>🔐 Permissoes dos Formularios</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14 }}>So administradores. Por padrao todo mundo ja pode <b>Responder</b> - aqui voce libera o resto por usuario.</div>

      {loading ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>Carregando...</div> : (
        <div>
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
      )}
    </div>
  );
}
