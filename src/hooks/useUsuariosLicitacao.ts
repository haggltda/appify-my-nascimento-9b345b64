import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";

export type UsuarioOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

/**
 * Retorna usuários com perfil 'comercial' (= equipe de licitações) vinculados à empresa ativa.
 * Fallback: todos da empresa se não houver nenhum com esse perfil.
 *
 * Nota: o perfil foi nomeado 'comercial' pelo desenvolvedor original — representa licitações.
 */
export function useUsuariosLicitacao(options?: { enabled?: boolean }) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;

  return useQuery({
    queryKey: ["usuarios_licitacao", empresaId],
    enabled: !!empresaId && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<UsuarioOption[]> => {
      // Busca user_ids com perfil 'comercial' que estão na empresa ativa
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "comercial");

      if (roleErr) throw roleErr;

      const userIds = (roleRows ?? []).map((r: any) => r.user_id as string);

      if (userIds.length === 0) {
        // Fallback: retorna todos da empresa
        const { data, error } = await supabase.rpc("list_usuarios_empresa", {
          _empresa_id: empresaId!,
        });
        if (error) throw error;
        return (data ?? []) as UsuarioOption[];
      }

      // Filtra apenas os que estão vinculados à empresa ativa
      const { data: ueRows, error: ueErr } = await supabase
        .from("user_empresa")
        .select("user_id")
        .eq("empresa_id", empresaId!)
        .in("user_id", userIds);

      if (ueErr) throw ueErr;

      const userIdsNaEmpresa = (ueRows ?? []).map((r: any) => r.user_id as string);

      if (userIdsNaEmpresa.length === 0) {
        const { data, error } = await supabase.rpc("list_usuarios_empresa", {
          _empresa_id: empresaId!,
        });
        if (error) throw error;
        return (data ?? []) as UsuarioOption[];
      }

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIdsNaEmpresa)
        .order("display_name");

      if (profErr) throw profErr;

      return (profiles ?? []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
      }));
    },
  });
}
