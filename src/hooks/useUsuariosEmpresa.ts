import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";

export type UsuarioEmpresaOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

/**
 * Lista usuários elegíveis a serem responsáveis por ações na empresa ativa.
 * Backend (RPC list_usuarios_empresa) valida que o caller possui permissão
 * de criar/editar Plano de Ações na empresa (ou é admin). E-mail só vem
 * preenchido para administradores.
 */
export function useUsuariosEmpresa(options?: { enabled?: boolean }) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;

  return useQuery({
    queryKey: ["usuarios_empresa", empresaId],
    enabled: !!empresaId && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<UsuarioEmpresaOption[]> => {
      const { data, error } = await supabase.rpc("list_usuarios_empresa", {
        _empresa_id: empresaId!,
      });
      if (error) throw error;
      return (data ?? []) as UsuarioEmpresaOption[];
    },
  });
}
