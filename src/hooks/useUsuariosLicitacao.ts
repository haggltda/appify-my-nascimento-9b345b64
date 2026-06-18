import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";

export type UsuarioOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

const MENUS_LICITACAO = ["pipeline", "editais", "grade-licitacoes", "licitacoes-implantacao"];

/**
 * Retorna usuários da empresa que têm permissão em pelo menos um menu de licitações.
 * Usa screen_permission_user (permissões diretas por usuário).
 */
export function useUsuariosLicitacao(options?: { enabled?: boolean }) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;

  return useQuery({
    queryKey: ["usuarios_licitacao", empresaId],
    enabled: !!empresaId && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<UsuarioOption[]> => {
      // Busca user_ids que têm allow=true em algum menu de licitações
      const { data: permRows, error: permErr } = await supabase
        .from("screen_permission_user")
        .select("user_id")
        .in("menu_codigo", MENUS_LICITACAO)
        .eq("allow", true)
        .or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

      if (permErr) throw permErr;

      const userIds = [...new Set((permRows ?? []).map((r: any) => r.user_id as string))];

      if (userIds.length === 0) {
        // Fallback: retorna todos da empresa se não houver permissões configuradas
        const { data, error } = await supabase.rpc("list_usuarios_empresa", {
          _empresa_id: empresaId!,
        });
        if (error) throw error;
        return (data ?? []) as UsuarioOption[];
      }

      // Busca profiles dos usuários filtrados
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds)
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
