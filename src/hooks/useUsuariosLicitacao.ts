import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";

export type UsuarioOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export function useUsuariosLicitacao(options?: { enabled?: boolean }) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;

  return useQuery({
    queryKey: ["usuarios_licitacao", empresaId],
    enabled: !!empresaId && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<UsuarioOption[]> => {
      const { data, error } = await supabase.rpc("list_usuarios_comercial_empresa", {
        _empresa_id: empresaId!,
      });
      if (error) throw error;
      return (data ?? []) as UsuarioOption[];
    },
  });
}
