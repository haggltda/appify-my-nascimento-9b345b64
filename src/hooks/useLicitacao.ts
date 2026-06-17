import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isUuid } from "@/utils/isUuid";


export type LicitacaoStatus =
  | "rascunho"
  | "oportunidade"
  | "em_andamento"
  | "vencida"
  | "perdida"
  | "cancelada"
  | string;

export interface LicitacaoComposicao {
  id: string;
  empresa_id: string;
  numero: string | null;
  objeto: string | null;
  orgao: string | null;
  status: LicitacaoStatus | null;
  responsavel_user_id: string | null;
  assumido_em: string | null;
  assumido_por: string | null;
}

const COLS =
  "id, empresa_id, numero, objeto, orgao, status, responsavel_user_id, assumido_em, assumido_por";

export function useLicitacao(licitacaoId: string | null) {
  const qc = useQueryClient();

  const query = useQuery<LicitacaoComposicao | null, Error>({
    queryKey: ["licitacao-composicao", licitacaoId],
    enabled: !!licitacaoId && isUuid(licitacaoId),
    queryFn: async () => {
      if (!licitacaoId || !isUuid(licitacaoId)) return null;
      const { data, error } = await supabase
        .from("licitacao")
        .select(COLS)
        .eq("id", licitacaoId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LicitacaoComposicao | null;
    },
  });


  const assumirLicitacao = useMutation<string, Error, void>({
    mutationFn: async () => {
      if (!licitacaoId) throw new Error("licitacaoId ausente");
      const { data, error } = await supabase.rpc("licitacao_assumir", {
        p_licitacao_id: licitacaoId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licitacao-composicao", licitacaoId] });
      qc.invalidateQueries({ queryKey: ["bdi-versao", licitacaoId] });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    assumirLicitacao,
  };
}
