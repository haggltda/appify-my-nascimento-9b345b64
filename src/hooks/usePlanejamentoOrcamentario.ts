import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClassificacaoOrcamento {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface PlanejamentoOrcamentarioRow {
  id: string;
  empresa_id: string;
  classificacao_id: string;
  detalhe: string;
  inicio_vigencia: string;
  fim_vigencia: string;
  valor: number;
  created_at: string;
  updated_at: string;
  classificacao: ClassificacaoOrcamento | null;
}

const LIST_KEY = "planejamento_orcamentario";
const CLASSIFICACOES_KEY = "planejamento_orcamentario_classificacao";

// Lista de classificações ativas, pra uso no dropdown do cadastro de
// orçamento — é global (compartilhada entre todas as empresas), não filtra
// por empresa_id.
export function useClassificacoesOrcamento() {
  return useQuery({
    queryKey: [CLASSIFICACOES_KEY, "ativas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planejamento_orcamentario_classificacao")
        .select("id, nome, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClassificacaoOrcamento[];
    },
  });
}

// Lista completa (ativas + inativas), pra tela de administração das
// classificações.
export function useClassificacoesOrcamentoAdmin() {
  return useQuery({
    queryKey: [CLASSIFICACOES_KEY, "todas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planejamento_orcamentario_classificacao")
        .select("id, nome, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClassificacaoOrcamento[];
    },
  });
}

interface SalvarClassificacaoInput {
  id?: string;
  nome: string;
  ativo: boolean;
}

export function useSalvarClassificacaoOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalvarClassificacaoInput) => {
      const payload = { nome: input.nome.trim(), ativo: input.ativo, ...(input.id ? { id: input.id } : {}) };
      const { data, error } = await (supabase as any)
        .from("planejamento_orcamentario_classificacao")
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as ClassificacaoOrcamento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLASSIFICACOES_KEY] }),
  });
}

export function usePlanejamentosOrcamento(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: [LIST_KEY, empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planejamento_orcamentario")
        .select("*, classificacao:classificacao_id(id, nome, ativo)")
        .eq("empresa_id", empresaId)
        .order("inicio_vigencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanejamentoOrcamentarioRow[];
    },
  });
}

interface SalvarPlanejamentoInput {
  empresa_id: string;
  classificacao_id: string;
  detalhe: string;
  inicio_vigencia: string;
  fim_vigencia: string;
  valor: number;
}

export function useSalvarPlanejamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalvarPlanejamentoInput) => {
      const { data, error } = await (supabase as any).rpc("salvar_planejamento_orcamentario", {
        _empresa_id: input.empresa_id,
        _classificacao_id: input.classificacao_id,
        _detalhe: input.detalhe,
        _inicio: input.inicio_vigencia,
        _fim: input.fim_vigencia,
        _valor: input.valor,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}

interface EditarPlanejamentoInput {
  id: string;
  detalhe: string;
  inicio_vigencia: string;
  fim_vigencia: string;
  valor: number;
}

export function useEditarPlanejamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EditarPlanejamentoInput) => {
      const { error } = await (supabase as any).rpc("editar_planejamento_orcamentario", {
        _id: input.id,
        _detalhe: input.detalhe,
        _inicio: input.inicio_vigencia,
        _fim: input.fim_vigencia,
        _valor: input.valor,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LIST_KEY] }),
  });
}
