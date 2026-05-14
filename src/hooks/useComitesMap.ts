import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";

export interface ComiteInfo {
  comite: string;
  areas: string[];
  lider: string | null;
}

/**
 * Deriva, a partir do histórico do plano_acao, o mapa:
 *   Comitê → { áreas associadas, líder (nome mais frequente não-nulo) }
 * Não há tabela específica de comitês/áreas; usamos os dados já cadastrados.
 */
export function useComitesMap() {
  const { empresaId, loading } = usePermissoes();
  return useQuery({
    queryKey: ["comites_map", empresaId],
    enabled: !loading && !!empresaId,
    queryFn: async (): Promise<Record<string, ComiteInfo>> => {
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

      const out: Record<string, ComiteInfo> = {};
      for (const [c, v] of Object.entries(map)) {
        const areas = Array.from(v.areas.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
        const lider = Array.from(v.lideres.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        out[c] = { comite: c, areas, lider };
      }
      return out;
    },
  });
}
