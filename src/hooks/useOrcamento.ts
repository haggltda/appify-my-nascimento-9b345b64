import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CicloRow = Database["public"]["Tables"]["orcamento_ciclo"]["Row"];
export type CicloInsert = Database["public"]["Tables"]["orcamento_ciclo"]["Insert"];
export type OrcContratoRow = Database["public"]["Tables"]["orcamento_contrato"]["Row"];
export type OrcLinhaRow = Database["public"]["Tables"]["orcamento_contrato_linha"]["Row"];
export type CronogramaRow = Database["public"]["Tables"]["cronograma_faturamento"]["Row"];
export type FluxoRow = Database["public"]["Tables"]["fluxo_caixa_projetado"]["Row"];

export const cicloStatusLabel: Record<string, string> = {
  aberto: "Aberto",
  em_aprovacao: "Em aprovação",
  aprovado: "Aprovado",
  encerrado: "Encerrado",
};

export function useCiclos() {
  return useQuery({
    queryKey: ["orcamento_ciclos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_ciclo")
        .select("*")
        .order("ano", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CicloInsert) => {
      const { data, error } = await supabase.from("orcamento_ciclo").insert(c).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orcamento_ciclos"] }),
  });
}

export function useOrcamentosDoCiclo(cicloId: string | undefined) {
  return useQuery({
    queryKey: ["orcamento_contratos_ciclo", cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_contrato")
        .select("*, contrato:contrato_id(numero,objeto,faturamento_mensal,vigencia_inicio,vigencia_fim)")
        .eq("ciclo_id", cicloId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrcamentoContratoByContrato(contratoId: string | undefined, cicloId?: string) {
  return useQuery({
    queryKey: ["orcamento_contrato_by", contratoId, cicloId],
    enabled: !!contratoId,
    queryFn: async () => {
      let q = supabase.from("orcamento_contrato").select("*").eq("contrato_id", contratoId!);
      if (cicloId) q = q.eq("ciclo_id", cicloId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useLinhasOrcamento(orcamentoContratoId: string | undefined) {
  return useQuery({
    queryKey: ["orc_linhas", orcamentoContratoId],
    enabled: !!orcamentoContratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_contrato_linha")
        .select("*, dre:dre_linha_id(codigo,descricao,natureza,ordem)")
        .eq("orcamento_contrato_id", orcamentoContratoId!)
        .order("competencia");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCronogramaContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["cronograma_faturamento", contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_faturamento")
        .select("*")
        .eq("contrato_id", contratoId!)
        .order("competencia");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCronogramaTodos() {
  return useQuery({
    queryKey: ["cronograma_faturamento_todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_faturamento")
        .select("*, contrato:contrato_id(numero,faturamento_mensal)")
        .order("competencia");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFluxoContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["fluxo_projetado", contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_caixa_projetado")
        .select("*")
        .eq("contrato_id", contratoId!)
        .order("data_prevista");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGerarOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contrato_id, ciclo_id }: { contrato_id: string; ciclo_id: string }) => {
      const { data, error } = await supabase.rpc("gerar_orcamento_contrato", {
        _contrato_id: contrato_id,
        _ciclo_id: ciclo_id,
      });
      if (error) throw error;
      return data as { orcamento_contrato_id: string; meses_gerados: number; receita_total: number; custo_total: number; margem: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento_contratos_ciclo"] });
      qc.invalidateQueries({ queryKey: ["orc_linhas"] });
      qc.invalidateQueries({ queryKey: ["cronograma_faturamento"] });
      qc.invalidateQueries({ queryKey: ["cronograma_faturamento_todos"] });
      qc.invalidateQueries({ queryKey: ["fluxo_projetado"] });
      qc.invalidateQueries({ queryKey: ["orcamento_contrato_by"] });
    },
  });
}
