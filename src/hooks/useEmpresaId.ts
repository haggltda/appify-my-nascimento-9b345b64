import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve o empresa_id do usuário autenticado a partir da tabela profiles.
 * Em modo demo (sem usuário), retorna null e o consumidor deve tratar.
 */
export function useEmpresaId() {
  return useQuery({
    queryKey: ["empresa_id_atual"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.empresa_id as string | null) ?? null;
    },
  });
}
