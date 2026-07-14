import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import type { FormCap } from "@/hooks/useFormPerms";

// =====================================================================
// NASCIMENTO FORMULARIOS - painel de permissoes (so admin, dentro do
// Modulos & Menus). Capacidades SOMENTE POR USUARIO. Por padrao todo
// autenticado ja pode "Responder".
// =====================================================================

interface Perfil { id: string; display_name?: string; email?: string; }

export const CAPS: { papel: FormCap; rotulo: string; desc: string }[] = [
  { papel: "editar_criar",     rotulo: "Editar / Criar",           desc: "Criar e editar formularios" },
  { papel: "responder",        rotulo: "Responder",                desc: "Abrir e enviar respostas (padrao de todos)" },
  { papel: "encerrar_excluir", rotulo: "Encerrar / Excluir",       desc: "Publicar, encerrar, reabrir e excluir" },
  { papel: "ver_tudo",         rotulo: "Visualizar tudo",          desc: "Ver todas as respostas" },
  { papel: "ver_proprias",     rotulo: "So as proprias respostas", desc: "So o que a propria pessoa enviou" },
];

// ─────────────────────────────────────────────────────────────────────────
// Lista de capacidades como linhas com Switch a direita (mesmo padrao dos
// menus em Modulos & Menus). Cada linha aciona o toggle da capacidade.
// ─────────────────────────────────────────────────────────────────────────
function CapToggles({ caps, onToggle }: { caps: Set<string>; onToggle: (papel: FormCap) => void }) {
  return (
    <div className="divide-y divide-border/60">
      {CAPS.map((c) => (
        <div key={c.papel} className="flex items-center gap-3 py-2.5">
          <div className="flex-1">
            <p className="text-sm">{c.rotulo}</p>
            <p className="text-[11px] text-muted-foreground">{c.desc}</p>
          </div>
          <Switch
            checked={caps.has(c.papel)}
            onCheckedChange={() => onToggle(c.papel)}
            aria-label={c.rotulo}
          />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Capacidades de UM usuario (usado na cascata de "Acesso por Usuario", dentro
// de Modulos & Menus). Mostra os toggles do proprio usuario.
// ─────────────────────────────────────────────────────────────────────────
export function FormPermsUsuario({ userId, onToast }: { userId: string; onToast: (m: string, t?: string) => void }) {
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const erroPerm = (m: string) => /row-level|permission|policy/i.test(m) ? "So administradores alteram permissoes." : "Erro: " + m;

  const load = useCallback(async () => {
    setLoading(true);
    const uRes = await (supabase as any).from("CS_FORM_ACESSOS").select("papel").eq("user_id", userId).neq("papel", "dashboard");
    setCaps(new Set<string>((uRes.data ?? []).map((r: any) => r.papel)));
    setLoading(false);
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

  if (loading) return <div className="py-2 text-xs text-muted-foreground">Carregando permissoes...</div>;

  return (
    <div className="py-1">
      <div className="mb-1 text-[11.5px] text-muted-foreground">
        O que <b>este usuario</b> pode fazer nos formularios. <span className="text-muted-foreground/70">Responder ja e liberado a todos.</span>
      </div>
      <CapToggles caps={caps} onToggle={toggle} />
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
  const erroPerm = (m: string) => /row-level|permission|policy/i.test(m) ? "So administradores alteram permissoes." : "Erro: " + m;

  const load = useCallback(async () => {
    setLoading(true);
    const gRes = await (supabase as any).from("CS_FORM_ACESSOS").select("user_id, papel").neq("papel", "dashboard").not("user_id", "is", null);
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

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-sm font-bold text-primary">🔐 Permissoes dos Formularios</div>
      <div className="mb-3.5 text-[11.5px] text-muted-foreground">So administradores. Por padrao todo mundo ja pode <b>Responder</b> - aqui voce libera o resto por usuario.</div>

      {loading ? <div className="py-5 text-center text-xs text-muted-foreground">Carregando...</div> : (
        <div>
          <div className="mb-2 text-xs font-bold text-foreground">Por usuario</div>
          <div className="relative mb-3 max-w-md">
            <input
              placeholder="Buscar usuario por nome ou e-mail para adicionar..."
              value={busca}
              onChange={e => buscar(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {resultados.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {resultados.map(p => (
                  <div key={p.id} onClick={() => addUser(p)} className="cursor-pointer border-b border-border/60 px-3 py-2 hover:bg-muted/50">
                    <div className="text-sm font-semibold text-foreground">{p.display_name || "-"}</div>
                    <div className="text-[11.5px] text-muted-foreground">{p.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {usuarios.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
              Ninguem com permissao especifica por usuario. Admins ja fazem tudo; adicione alguem para dar acesso individual.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {usuarios.map(uid => (
                <div key={uid} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="text-sm font-semibold text-foreground">
                    {nome(uid)} <span className="text-[11px] font-normal text-muted-foreground">{perfis[uid]?.email}</span>
                  </div>
                  <CapToggles caps={grants[uid] ?? new Set()} onToggle={(papel) => toggleCap(uid, papel)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
