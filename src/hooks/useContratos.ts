import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ContratoRow = Database["public"]["Tables"]["contrato"]["Row"];
export type ContratoInsert = Database["public"]["Tables"]["contrato"]["Insert"];
export type PostoRow = Database["public"]["Tables"]["contrato_posto"]["Row"];
export type PostoInsert = Database["public"]["Tables"]["contrato_posto"]["Insert"];
export type DissidioRow = Database["public"]["Tables"]["contrato_dissidio"]["Row"];
export type DissidioInsert = Database["public"]["Tables"]["contrato_dissidio"]["Insert"];
export type ComprovacaoRow = Database["public"]["Tables"]["contrato_comprovacao"]["Row"];
export type ComprovacaoInsert = Database["public"]["Tables"]["contrato_comprovacao"]["Insert"];
export type BaseDissidioRow = Database["public"]["Tables"]["base_dissidio_categoria"]["Row"];

export const formatBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const statusLabel: Record<string, string> = {
  implantacao: "Implantação",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export function useContratos() {
  return useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: ["contrato", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("contrato").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useContratoPostos(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["contrato_postos", contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_posto")
        .select("*, base_dissidio_categoria(id,codigo,nome,sindicato)")
        .eq("contrato_id", contratoId!)
        .order("cargo");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContratoDissidios(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["contrato_dissidios", contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_dissidio")
        .select("*, contrato_posto(id,cargo), base_dissidio_categoria(id,codigo,nome)")
        .eq("contrato_id", contratoId!)
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContratoComprovacoes(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["contrato_comprovacoes", contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato_comprovacao")
        .select("*")
        .eq("contrato_id", contratoId!)
        .order("data_documento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBaseDissidioCategorias() {
  return useQuery({
    queryKey: ["base_dissidio_categoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("base_dissidio_categoria")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddPosto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (posto: PostoInsert) => {
      const { data, error } = await supabase.from("contrato_posto").insert(posto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["contrato_postos", row.contrato_id] }),
  });
}

export function useAddDissidio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DissidioInsert) => {
      const { data, error } = await supabase.from("contrato_dissidio").insert(d).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["contrato_dissidios", row.contrato_id] }),
  });
}

export function useAddComprovacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ComprovacaoInsert) => {
      const { data, error } = await supabase.from("contrato_comprovacao").insert(c).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["contrato_comprovacoes", row.contrato_id] }),
  });
}
