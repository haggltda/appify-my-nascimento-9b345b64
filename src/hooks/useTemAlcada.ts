import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Retorna true se o usuário logado é responsável por alguma alçada (qualquer empresa). */
export function useTemAlcada() {
  const q = useQuery({
    queryKey: ["tem-alcada"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { tem: false, pendentes: 0 };
      const [{ count: alcCount }, { count: pendCount }] = await Promise.all([
        (supabase as any)
          .from("alcada_aprovacao")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_user_id", u.user.id)
          .eq("ativo", true),
        (supabase as any)
          .from("financeiro_pagamento_aprovacao")
          .select("id", { count: "exact", head: true })
          .eq("aprovador_id", u.user.id)
          .eq("decisao", "pendente"),
      ]);
      return { tem: (alcCount ?? 0) > 0 || (pendCount ?? 0) > 0, pendentes: pendCount ?? 0 };
    },
    staleTime: 60_000,
  });
  return { temAlcada: q.data?.tem ?? false, pendentes: q.data?.pendentes ?? 0, loading: q.isLoading };
}
