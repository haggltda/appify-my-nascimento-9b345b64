// Hook de leitura real do Pipeline a partir de public.licitacao.
// Somente SELECT. Sem service_role. Filtrado por empresa_id.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Licitacao } from "@/data/licitacoes";
import {
  mapManyDbLicitacaoToPipeline,
  type DbLicitacaoRow,
  type ResponsavelMap,
} from "@/utils/licitacoes/mapDbLicitacaoToPipeline";

export type UseLicitacoesPipelineInput = {
  empresaId: string | null;
};

const SELECT_COLUMNS =
  "id, empresa_id, numero, objeto, orgao, modalidade, valor_estimado, status, abertura, observacoes, local_prestacao, origem_carga, batch_id, responsavel_user_id, assumido_em, assumido_por, updated_at";

const HARD_LIMIT = 2000;

async function fetchLicitacoes(empresaId: string): Promise<Licitacao[]> {
  const { data, error } = await supabase
    .from("licitacao")
    .select(SELECT_COLUMNS)
    .eq("empresa_id", empresaId)
    .order("abertura", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(HARD_LIMIT);

  if (error) throw error;
  const rows = (data ?? []) as DbLicitacaoRow[];

  // Resolver nomes dos responsáveis em 1 query.
  const ids = Array.from(
    new Set(
      rows
        .map((r) => r.responsavel_user_id)
        .filter((x): x is string => !!x),
    ),
  );
  let responsaveis: ResponsavelMap = {};
  if (ids.length > 0) {
    const { data: profs, error: errProf } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ids);
    if (errProf) throw errProf;
    responsaveis = Object.fromEntries(
      (profs ?? []).map((p) => [
        p.id as string,
        {
          nome: (p.display_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
        },
      ]),
    );
  }

  return mapManyDbLicitacaoToPipeline(rows, responsaveis);
}

export function useLicitacoesPipeline({
  empresaId,
}: UseLicitacoesPipelineInput) {
  const q = useQuery({
    queryKey: ["licitacoes-pipeline", empresaId],
    enabled: !!empresaId,
    staleTime: 30_000,
    queryFn: () => fetchLicitacoes(empresaId as string),
  });
  return {
    data: q.data ?? [],
    isLoading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    isFetching: q.isFetching,
  };
}
