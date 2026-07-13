import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";

export interface AreaInfo {
  nome: string;
  gestor: string | null;
  setores: string[];
}

export interface ComiteInfo {
  comite: string;
  areas: AreaInfo[];
  /** Compat: lista plana de nomes das áreas */
  areasNomes: string[];
  lider: string | null;
  /** profile_id real do líder, quando o gestor do comitê está vinculado a uma conta */
  liderProfileId: string | null;
}

/**
 * Mapa Comitê → { áreas (com gestor + setores), líder } por empresa.
 * Fonte: tabelas oficiais `comite` / `area` / `setor`.
 * Fallback: histórico de `plano_acao` quando nenhuma estrutura está cadastrada.
 */
export function useComitesMap() {
  const { empresaId, loading } = usePermissoes();
  return useQuery({
    queryKey: ["comites_map_v2", empresaId],
    enabled: !loading && !!empresaId,
    queryFn: async (): Promise<Record<string, ComiteInfo>> => {
      const [cRes, aRes, sRes, profRes] = await Promise.all([
        supabase.from("comite").select("id, nome, descricao, gestor_profile_id, ativo")
          .eq("empresa_id", empresaId!).eq("ativo", true).order("nome"),
        supabase.from("area").select("id, comite_id, nome, descricao, gestor_profile_id, ativo")
          .eq("empresa_id", empresaId!).eq("ativo", true).order("nome"),
        supabase.from("setor").select("id, area_id, nome, ativo")
          .eq("empresa_id", empresaId!).eq("ativo", true).order("nome"),
        supabase.from("profiles").select("id, display_name").limit(2000),
      ]);

      const comites = (cRes.data ?? []) as { id: string; nome: string; descricao: string | null; gestor_profile_id: string | null }[];
      const areas = (aRes.data ?? []) as { id: string; comite_id: string; nome: string; descricao: string | null; gestor_profile_id: string | null }[];
      const setores = (sRes.data ?? []) as { id: string; area_id: string; nome: string }[];
      const profiles = (profRes.data ?? []) as { id: string; display_name: string | null }[];
      const profileNome = new Map(profiles.map(p => [p.id, p.display_name ?? ""]));

      const liderFrom = (gid: string | null, descricao: string | null): string | null => {
        if (gid && profileNome.get(gid)) return profileNome.get(gid)!;
        const m = (descricao ?? "").match(/^(?:l[ií]der|gestor)\s*:\s*(.+)$/i);
        return m ? m[1].trim() : null;
      };

      // Igual a liderFrom, mas também expõe o profile_id real — só existe
      // quando o gestor está de fato vinculado a uma conta (gestor_profile_id),
      // nunca quando o nome vem só do texto livre em "descricao".
      const liderInfo = (gid: string | null, descricao: string | null): { nome: string | null; profileId: string | null } => {
        if (gid && profileNome.get(gid)) return { nome: profileNome.get(gid)!, profileId: gid };
        const m = (descricao ?? "").match(/^(?:l[ií]der|gestor)\s*:\s*(.+)$/i);
        return m ? { nome: m[1].trim(), profileId: null } : { nome: null, profileId: null };
      };

      const setoresPorArea = new Map<string, string[]>();
      for (const s of setores) {
        const arr = setoresPorArea.get(s.area_id) ?? [];
        arr.push(s.nome);
        setoresPorArea.set(s.area_id, arr);
      }

      const out: Record<string, ComiteInfo> = {};
      for (const c of comites) {
        const liderComite = liderInfo(c.gestor_profile_id, c.descricao);
        const myAreas = areas
          .filter(a => a.comite_id === c.id)
          .map<AreaInfo>(a => ({
            nome: a.nome,
            gestor: liderFrom(a.gestor_profile_id, a.descricao),
            setores: (setoresPorArea.get(a.id) ?? []).sort((x, y) => x.localeCompare(y, "pt-BR")),
          }));
        out[c.nome] = {
          comite: c.nome,
          areas: myAreas,
          areasNomes: myAreas.map(a => a.nome),
          lider: liderComite.nome,
          liderProfileId: liderComite.profileId,
        };
      }

      if (Object.keys(out).length > 0) return out;

      // Fallback legado: usa RPC SECURITY DEFINER para contornar a RLS de
      // visibilidade do plano_acao — retorna apenas nomes de comitê/área.
      const { data, error } = await (supabase as any).rpc(
        "plano_acao_comites_lista",
        { _empresa_id: empresaId! },
      );
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
        fallback[c] = {
          comite: c,
          areas: arr.map(n => ({ nome: n, gestor: null, setores: [] })),
          areasNomes: arr,
          lider,
          liderProfileId: null,
        };
      }
      return fallback;
    },
  });
}
