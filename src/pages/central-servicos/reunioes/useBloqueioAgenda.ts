import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { BloqueioAgenda, MotivoBloqueioAgenda, TipoBloqueioAgenda } from "./types";

const BLOQUEIO_COLUNAS = "id, user_id, tipo, data_inicio, data_fim, dia_inteiro, hora_inicio, hora_fim, motivo, motivo_outro, created_at";

export function useMeusBloqueiosAgenda() {
  return useQuery({
    queryKey: ["reuniao_bloqueio_agenda"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_bloqueio_agenda")
        .select(BLOQUEIO_COLUNAS)
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BloqueioAgenda[];
    },
  });
}

interface NovoBloqueio {
  tipo: TipoBloqueioAgenda;
  data_inicio: string;
  data_fim: string;
  dia_inteiro: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: MotivoBloqueioAgenda;
  motivo_outro: string | null;
}

export function useCriarBloqueioAgenda() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (novo: NovoBloqueio) => {
      const { error } = await (supabase as any).from("reuniao_bloqueio_agenda").insert(novo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reuniao_bloqueio_agenda"] });
      toast({ title: "Agenda bloqueada" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao bloquear agenda", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoverBloqueioAgenda() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("reuniao_bloqueio_agenda").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reuniao_bloqueio_agenda"] });
      toast({ title: "Bloqueio removido" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover bloqueio", description: error.message, variant: "destructive" });
    },
  });
}
