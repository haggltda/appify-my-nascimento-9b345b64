import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";

export interface ComiteInfo {
  comite: string;
  areas: string[];
  lider: string | null;
}

/**
 * Mapa Comitê → { áreas, líder } por empresa.
 * Fonte primária: tabelas oficiais `comite` / `area` (Estrutura Organizacional).
 * Fallback: histórico de `plano_acao` (legado) — empresas sem cadastro ainda funcionam.
 */
export function useComitesMap() {
  const { empresaId, loading } = usePermissoes();
  return useQuery({
    queryKey: ["comites_map", empresaId],
    enabled: !loading && !!empresaId,
    queryFn: async (): Promise<Record<string, ComiteInfo>> => {
      // 1) Cadastro oficial
      const [cRes, aRes, profRes] = await Promise.all([
        supabase.from("comite").select("id, nome, gestor_profile_id, ativo")
          .eq("empresa_id", empresaId!).eq("ativo", true).order("nome"),
        supabase.from("area").select("id, comite_id, nome, ativo")
          .eq("empresa_id", empresaId!).eq("ativo", true).order("nome"),
        supabase.from("profiles").select("id, display_name").limit(1000),
      ]);

      const comites = (cRes.data ?? []) as { id: string; nome: string; gestor_profile_id: string | null }[];
      const areas = (aRes.data ?? []) as { id: string; comite_id: string; nome: string }[];
      const profiles = (profRes.data ?? []) as { id: string; display_name: string | null }[];
      const profileNome = new Map(profiles.map(p => [p.id, p.display_name ?? ""]));

      const out: Record<string, ComiteInfo> = {};
      for (const c of comites) {
        const lider = c.gestor_profile_id ? (profileNome.get(c.gestor_profile_id) || null) : null;
        out[c.nome] = {
          comite: c.nome,
          areas: areas.filter(a => a.comite_id === c.id).map(a => a.nome),
          lider,
        };
      }

      if (Object.keys(out).length > 0) return out;

      // 2) Fallback legado: deriva do histórico do plano_acao
      const { data, error } = await supabase
        .from("plano_acao")
        .select("comite, area, lider_comite_nome_origem")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .not("comite", "is", null);
      if (error) throw error;

      const map: Record<string, { areas: Map<string, number>; lideres: Map<string, number> }> = {};
      for (const r of (data ?? []) as any[]) {
        const c = (r.comite ?? "").trim();
        if (!c) continue;
        if (!map[c]) map[c] = { areas: new Map(), lideres: new Map() };
        const a = (r.area ?? "").trim();
        if (a) map[c].areas.set(a, (map[c].areas.get(a) ?? 0) + 1);
        const l = (r.lider_comite_nome_origem ?? "").trim();
        if (l) map[c].lideres.set(l, (map[c].lideres.get(l) ?? 0) + 1);
      }
      const fallback: Record<string, ComiteInfo> = {};
      for (const [c, v] of Object.entries(map)) {
        const arr = Array.from(v.areas.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
        const lider = Array.from(v.lideres.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        fallback[c] = { comite: c, areas: arr, lider };
      }
      return fallback;
    },
  });
}
