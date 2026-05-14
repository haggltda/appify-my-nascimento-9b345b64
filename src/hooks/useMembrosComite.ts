import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";

export type MembroOrigem = "Líder do comitê" | "Gestor da área" | "Gestor do setor";

export interface MembroComite {
  id: string;
  nome: string;
  email: string | null;
  avatar_url: string | null;
  origem: MembroOrigem;
}

/**
 * Retorna membros sugeridos do comitê selecionado.
 * Fonte: tabelas `comite`, `area`, `setor` (campos gestor_profile_id) + `profiles`.
 * Sem criar tabelas; sem usuários fictícios.
 */
export function useMembrosComite(comiteNome?: string | null) {
  const { empresaId, loading } = usePermissoes();
  return useQuery({
    queryKey: ["membros_comite", empresaId, comiteNome ?? ""],
    enabled: !loading && !!empresaId && !!comiteNome,
    queryFn: async (): Promise<MembroComite[]> => {
      const nome = comiteNome!.trim();
      const { data: comites } = await supabase
        .from("comite")
        .select("id, nome, gestor_profile_id")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .ilike("nome", nome);
      const comite = (comites ?? [])[0];
      if (!comite) return [];

      const { data: areas } = await supabase
        .from("area")
        .select("id, gestor_profile_id")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .eq("comite_id", comite.id);
      const areaIds = (areas ?? []).map((a) => a.id);

      const { data: setores } = areaIds.length
        ? await supabase
            .from("setor")
            .select("id, gestor_profile_id")
            .eq("empresa_id", empresaId!)
            .eq("ativo", true)
            .in("area_id", areaIds)
        : { data: [] as { id: string; gestor_profile_id: string | null }[] };

      const map = new Map<string, MembroOrigem>();
      const setOrig = (id: string | null | undefined, origem: MembroOrigem) => {
        if (!id) return;
        // mantém a origem mais alta (líder > área > setor)
        const ordem: Record<MembroOrigem, number> = {
          "Líder do comitê": 3,
          "Gestor da área": 2,
          "Gestor do setor": 1,
        };
        const atual = map.get(id);
        if (!atual || ordem[origem] > ordem[atual]) map.set(id, origem);
      };

      setOrig(comite.gestor_profile_id, "Líder do comitê");
      for (const a of areas ?? []) setOrig(a.gestor_profile_id, "Gestor da área");
      for (const s of setores ?? []) setOrig(s.gestor_profile_id, "Gestor do setor");

      const ids = Array.from(map.keys());
      if (!ids.length) return [];

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", ids);

      const ordemRender: Record<MembroOrigem, number> = {
        "Líder do comitê": 0,
        "Gestor da área": 1,
        "Gestor do setor": 2,
      };

      return (profs ?? [])
        .map((p) => ({
          id: p.id,
          nome: p.display_name || p.email || "Sem nome",
          email: p.email,
          avatar_url: p.avatar_url,
          origem: map.get(p.id)!,
        }))
        .sort((a, b) => ordemRender[a.origem] - ordemRender[b.origem] || a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
