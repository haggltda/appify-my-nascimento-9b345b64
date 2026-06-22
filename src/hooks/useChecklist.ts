import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ChecklistItem {
  id: number;
  row_index: number;
  setor: string;
  categoria: string | null;
  item: string;
  prazo_limite: string | null;
  tipo_resposta: string;
  obs_default: string | null;
  momento: string | null;
  resp_questionamento: string | null;
  plano_acao: string | null;
  responsavel_acao: string | null;
  onde: string | null;
  anotacoes: string | null;
}

export interface ChecklistResposta {
  id: string;
  empresa_id: string;
  contrato_id: string;
  row_index: number;
  resposta: string | null;
  obs: string | null;
}

const QK_ITEMS = ["checklist-items"];
const QK_RESPOSTAS = (contratoId: string) => ["checklist-respostas", contratoId];

export function useChecklistItems() {
  return useQuery({
    queryKey: QK_ITEMS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .order("row_index");
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
    staleTime: Infinity,
  });
}

export function useChecklistRespostas(contratoId: string | null) {
  return useQuery({
    queryKey: QK_RESPOSTAS(contratoId ?? ""),
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select("*")
        .eq("contrato_id", contratoId!);
      if (error) throw error;
      return (data ?? []) as ChecklistResposta[];
    },
  });
}

export function useChecklistSalvar(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contratoId,
      rowIndex,
      resposta,
      obs,
    }: {
      contratoId: string;
      rowIndex: number;
      resposta: string | null;
      obs: string | null;
    }) => {
      const { error } = await supabase.from("checklist_respostas").upsert(
        {
          empresa_id: empresaId,
          contrato_id: contratoId,
          row_index: rowIndex,
          resposta,
          obs: obs || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "contrato_id,row_index" }
      );
      if (error) throw error;
    },
    onSuccess: (_, { contratoId }) => {
      qc.invalidateQueries({ queryKey: QK_RESPOSTAS(contratoId) });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
}
