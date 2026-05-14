import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";

export interface PlanoAcaoRow {
  id: string;
  empresa_id: string;
  id_importacao: string | null;
  ordem: number | null;
  titulo: string | null;
  comite: string | null;
  area: string | null;
  setor: string | null;
  prioridade_normalizada: string | null;
  prioridade_original: string | null;
  problema: string | null;
  acao: string | null;
  responsavel_profile_id: string | null;
  responsavel_nome_origem: string | null;
  lider_comite_nome_origem: string | null;
  lider_setor_nome_origem: string | null;
  data_inicio_planejado_original: string | null;
  data_fim_planejado_original: string | null;
  data_inicio_real_original: string | null;
  data_fim_real_original: string | null;
  status_original: string | null;
  status_normalizado: string;
  comentarios: string | null;
  pendencias_iniciais: string[];
  pendencia_responsavel: boolean;
  pendencia_datas: boolean;
  pendencia_evidencia: boolean;
  custo_previsto: number;
  custo_realizado: number;
  updated_at: string;
  deleted_at: string | null;
}

export function usePlanoAcoes() {
  const { empresaId, loading } = usePermissoes();
  return useQuery({
    queryKey: ["plano_acoes", empresaId],
    enabled: !loading && !!empresaId,
    queryFn: async (): Promise<PlanoAcaoRow[]> => {
      const { data, error } = await supabase
        .from("plano_acao")
        .select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("ordem", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PlanoAcaoRow[];
    },
  });
}
