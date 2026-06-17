import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Hooks genéricos para tabelas multi-tenant simples (com empresa_id). */
export function useList<T = any>(
  table: string,
  opts?: { orderBy?: string; ascending?: boolean; limit?: number },
) {
  return useQuery<T[]>({
    queryKey: [table, "list", opts?.orderBy, opts?.ascending, opts?.limit],
    queryFn: async () => {
      let q = (supabase as any).from(table).select("*");
      if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? false });
      else q = q.order("created_at", { ascending: false });
      if (opts?.limit) q = q.limit(opts.limit);
      else q = q.limit(5000);
      const { data, error } = await q;
      if (error) throw error;
      return (data as T[]) ?? [];
    },
  });
}

export function useUpsert(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: any) => {
      const { id, ...rest } = row;
      if (id) {
        const { data, error } = await (supabase as any).from(table).update(rest).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await (supabase as any).from(table).insert(rest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Registro salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
}

export function useRemove(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Registro removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });
}
