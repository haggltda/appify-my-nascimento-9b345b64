import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PostoLocalizacao {
  id: string;
  empresa_id: string;
  planilha_custo_id: string;
  nome: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
  periculosidade: boolean;
  insalubridade: boolean;
  qt_pessoas_orcadas: number;
  qt_pessoas_executadas: number;
  created_at: string;
  updated_at: string;
}

export type PostoLocalizacaoInsert = Omit<PostoLocalizacao, "id" | "created_at" | "updated_at">;
export type PostoLocalizacaoUpdate = Partial<Omit<PostoLocalizacao, "id" | "empresa_id" | "planilha_custo_id" | "created_at" | "updated_at">>;

const QK = (planilhaCustoId: string) => ["posto_localizacao", planilhaCustoId];

export function usePlanilhaPostoLocalizacaoAll(empresaId: string | null) {
  return useQuery({
    queryKey: ["posto_localizacao_all", empresaId ?? ""],
    enabled: !!empresaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planilha_posto_localizacao")
        .select("*")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return (data ?? []) as PostoLocalizacao[];
    },
  });
}

export function usePlanilhaPostoLocalizacao(planilhaCustoId: string | null) {
  return useQuery({
    queryKey: QK(planilhaCustoId ?? ""),
    enabled: !!planilhaCustoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planilha_posto_localizacao")
        .select("*")
        .eq("planilha_custo_id", planilhaCustoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PostoLocalizacao[];
    },
  });
}

export function usePostoLocalizacaoSave(planilhaCustoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string } & PostoLocalizacaoUpdate & Pick<PostoLocalizacaoInsert, "empresa_id" | "planilha_custo_id">) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (supabase as any)
          .from("planilha_posto_localizacao")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("planilha_posto_localizacao")
          .insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK(planilhaCustoId) });
      toast.success("Localização salva.");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });
}

export function usePostoLocalizacaoCoords() {
  return useMutation({
    mutationFn: async ({ id, lat, lng }: { id: string; lat: number; lng: number }) => {
      const { error } = await (supabase as any)
        .from("planilha_posto_localizacao")
        .update({ lat, lng })
        .eq("id", id);
      if (error) throw error;
    },
  });
}

export function usePostoLocalizacaoDelete(planilhaCustoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("planilha_posto_localizacao")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK(planilhaCustoId) });
      toast.success("Localização removida.");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });
}
