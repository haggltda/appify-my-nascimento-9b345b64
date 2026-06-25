import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FASES_ATIVAS = ["À Iniciar", "Iniciado", "Em Andamento"];

export function useGradeAtivaCount(empresaId: string | null) {
  return useQuery({
    queryKey: ["grade_ativa_count", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("grade")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .in("fase", FASES_ATIVAS);
      if (error) throw error;
      return count as number;
    },
    staleTime: 60_000,
  });
}
