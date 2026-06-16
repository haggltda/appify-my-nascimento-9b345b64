import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ChecklistItem {
  id: string;
  setor: string;
  momento: string | null;
  item: string;
  tipo_resposta: string;
  prazo_limite: string | null;
  plano_acao: string | null;
  responsavel_acao: string | null;
  onde: string | null;
  ordem: number;
}

export interface Resposta {
  id: string;
  empresa_id: string;
  contrato_id: string;
  checklist_item_id: string;
  resposta: string | null;
  obs: string | null;
}

export interface ImplantacaoContrato {
  id: string;
  empresa_id: string;
  nome: string;
  capa_id: string | null;
  status: "ativo" | "encerrado";
  data_inicio: string | null;
  abertura: string | null;
  reuniao_alinhamento: string | null;
  data_homologacao: string | null;
  created_at: string;
  updated_at: string;
}

// Calcula prazo dinâmico baseado no prazo_limite do item e nas datas do contrato
export function calcPrazo(item: ChecklistItem, contrato: ImplantacaoContrato): string | null {
  if (!item.prazo_limite) return null;
  const base =
    item.prazo_limite.includes("abertura") ? contrato.abertura :
    item.prazo_limite.includes("inicio")   ? contrato.data_inicio :
    item.prazo_limite.includes("homolog")  ? contrato.data_homologacao :
    item.prazo_limite.includes("reuniao")  ? contrato.reuniao_alinhamento :
    null;
  if (!base) return item.prazo_limite;

  const match = item.prazo_limite.match(/([+-]?\d+)\s*dias?/i);
  if (match) {
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() + parseInt(match[1]));
    return d.toLocaleDateString("pt-BR");
  }
  return item.prazo_limite;
}

// ── Contratos ──────────────────────────────────────────────────────────────

export function useImplantacaoContratos(empresaId: string | null) {
  return useQuery({
    queryKey: ["implantacao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_contrato")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ImplantacaoContrato[];
    },
  });
}

// ── Checklist items (estáticos) ─────────────────────────────────────────────

export function useChecklistItems() {
  return useQuery({
    queryKey: ["checklist-items"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });
}

// ── Respostas por contrato ─────────────────────────────────────────────────

export function useRespostas(contratoId: string | null, empresaId: string | null) {
  return useQuery({
    queryKey: ["respostas", contratoId],
    enabled: !!contratoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("respostas")
        .select("*")
        .eq("contrato_id", contratoId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return (data ?? []) as Resposta[];
    },
  });
}

export function useRespostaUpsert(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contratoId,
      itemId,
      resposta,
      obs,
    }: {
      contratoId: string;
      itemId: string;
      resposta: string;
      obs?: string;
    }) => {
      const { error } = await supabase.from("respostas").upsert(
        {
          empresa_id: empresaId,
          contrato_id: contratoId,
          checklist_item_id: itemId,
          resposta,
          obs: obs ?? null,
        },
        { onConflict: "contrato_id,checklist_item_id" }
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["respostas", vars.contratoId] });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
}
