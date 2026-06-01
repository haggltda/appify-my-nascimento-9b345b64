import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BdiVersaoStatus = Database["public"]["Enums"]["bdi_status"];
export type BdiItemGrupo = Database["public"]["Enums"]["bdi_item_grupo"];
export type BdiItemTipo = Database["public"]["Enums"]["bdi_item_tipo"];

// Cast estrutural controlado: assinaturas RPC marcam parâmetros como obrigatórios,
// mas o servidor aceita NULL para id/uuid/opcionais (DEFAULT NULL).
type FnArgs<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T]["Args"];

function rpcArgs<T extends keyof Database["public"]["Functions"]>(
  args: Record<string, unknown>,
): FnArgs<T> {
  return args as unknown as FnArgs<T>;
}

export interface BdiVersao {
  id: string;
  licitacao_id: string;
  empresa_id: string;
  codigo: string;
  status: BdiVersaoStatus;
  margem_pct: number;
  tributos_pct: number;
  custo_indireto_pct: number;
  totais_cache: Record<string, unknown> | null;
  observacao: string | null;
}

export interface BdiPosto {
  id: string;
  bdi_versao_id: string;
  cargo: string;
  qtd: number;
  local: string | null;
  salario_base: number;
  va: number;
  vt: number;
  uniformes: number;
  epis: number;
  insalubridade_pct: number;
  periculosidade_pct: number;
  ordem: number;
  observacao: string | null;
}

export interface BdiVerbaFolha {
  id: string;
  bdi_versao_id: string;
  rubrica: string;
  percentual: number;
  ordem: number;
  observacao: string | null;
}

export interface BdiItem {
  id: string;
  bdi_versao_id: string;
  grupo: BdiItemGrupo;
  tipo: BdiItemTipo;
  campo_key: string;
  label: string;
  unidade: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  valor: number;
  ordem: number;
  observacao: string | null;
  produto_servico_id: string | null;
}

export interface SalvarPostoArgs {
  id?: string | null;
  cargo: string;
  qtd: number;
  local?: string | null;
  salario_base: number;
  va?: number | null;
  vt?: number | null;
  uniformes?: number | null;
  epis?: number | null;
  insalubridade_pct?: number | null;
  periculosidade_pct?: number | null;
  ordem?: number | null;
  observacao?: string | null;
}

export interface SalvarVerbaArgs {
  id?: string | null;
  rubrica: string;
  percentual: number;
  ordem?: number | null;
  observacao?: string | null;
}

export interface SalvarItemArgs {
  id?: string | null;
  grupo: BdiItemGrupo;
  tipo?: BdiItemTipo | null;
  campo_key: string;
  label: string;
  unidade?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  valor?: number | null;
  ordem?: number | null;
  observacao?: string | null;
  produto_servico_id?: string | null;
}

export interface AtualizarVersaoPayload {
  margem_pct?: number;
  tributos_pct?: number;
  custo_indireto_pct?: number;
}

const POSTO_COLS =
  "id, bdi_versao_id, cargo, qtd, local, salario_base, va, vt, uniformes, epis, insalubridade_pct, periculosidade_pct, ordem, observacao";
const VERBA_COLS =
  "id, bdi_versao_id, rubrica, percentual, ordem, observacao";
const ITEM_COLS =
  "id, bdi_versao_id, grupo, tipo, campo_key, label, unidade, quantidade, valor_unitario_estimado, valor, ordem, observacao, produto_servico_id";

export function useBdi(licitacaoId: string | null) {
  const qc = useQueryClient();
  const versaoKey = ["bdi-versao", licitacaoId] as const;

  const versaoQuery = useQuery<BdiVersao | null, Error>({
    queryKey: versaoKey,
    enabled: !!licitacaoId,
    queryFn: async () => {
      if (!licitacaoId) return null;
      const { data, error } = await supabase.rpc("bdi_obter_versao", {
        p_licitacao_id: licitacaoId,
      });
      if (error) throw error;
      if (!data) return null;
      const raw = data as unknown as Record<string, unknown>;
      const tc = raw.totais_cache;
      return {
        id: String(raw.id),
        licitacao_id: String(raw.licitacao_id ?? ""),
        empresa_id: String(raw.empresa_id ?? ""),
        codigo: String(raw.codigo ?? ""),
        status: raw.status as BdiVersaoStatus,
        margem_pct: Number(raw.margem_pct ?? 0),
        tributos_pct: Number(raw.tributos_pct ?? 0),
        custo_indireto_pct: Number(raw.custo_indireto_pct ?? 0),
        totais_cache:
          tc && typeof tc === "object"
            ? (tc as Record<string, unknown>)
            : null,
        observacao: (raw.observacao as string | null) ?? null,
      };
    },
  });

  const versaoId = versaoQuery.data?.id ?? null;
  const childKey = (kind: string) => ["bdi-child", kind, versaoId] as const;

  const postosQuery = useQuery<BdiPosto[], Error>({
    queryKey: childKey("postos"),
    enabled: !!versaoId,
    queryFn: async () => {
      if (!versaoId) return [];
      const { data, error } = await supabase
        .from("bdi_posto")
        .select(POSTO_COLS)
        .eq("bdi_versao_id", versaoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BdiPosto[];
    },
  });

  const verbasQuery = useQuery<BdiVerbaFolha[], Error>({
    queryKey: childKey("verbas"),
    enabled: !!versaoId,
    queryFn: async () => {
      if (!versaoId) return [];
      const { data, error } = await supabase
        .from("bdi_verba_folha")
        .select(VERBA_COLS)
        .eq("bdi_versao_id", versaoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BdiVerbaFolha[];
    },
  });

  const itensQuery = useQuery<BdiItem[], Error>({
    queryKey: childKey("itens"),
    enabled: !!versaoId,
    queryFn: async () => {
      if (!versaoId) return [];
      const { data, error } = await supabase
        .from("bdi_item")
        .select(ITEM_COLS)
        .eq("bdi_versao_id", versaoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BdiItem[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: versaoKey });
    if (versaoId) {
      qc.invalidateQueries({ queryKey: childKey("postos") });
      qc.invalidateQueries({ queryKey: childKey("verbas") });
      qc.invalidateQueries({ queryKey: childKey("itens") });
    }
  };

  const requireLic = () => {
    if (!licitacaoId) throw new Error("licitacaoId ausente");
    return licitacaoId;
  };
  const requireVer = () => {
    if (!versaoId) throw new Error("versão BDI ausente");
    return versaoId;
  };

  const criarVersao = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("bdi_criar_versao", {
        p_licitacao_id: requireLic(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const atualizarVersao = useMutation<unknown, Error, AtualizarVersaoPayload>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.rpc("bdi_atualizar_versao", {
        p_versao_id: requireVer(),
        p_payload: JSON.stringify(payload),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const salvarPosto = useMutation<unknown, Error, SalvarPostoArgs>({
    mutationFn: async (p) => {
      const { data, error } = await supabase.rpc(
        "bdi_salvar_posto",
        rpcArgs<"bdi_salvar_posto">({
          p_versao_id: requireVer(),
          p_posto_id: p.id ?? null,
          p_cargo: p.cargo,
          p_qtd: p.qtd,
          p_local: p.local ?? null,
          p_salario_base: p.salario_base,
          p_va: p.va ?? null,
          p_vt: p.vt ?? null,
          p_uniformes: p.uniformes ?? null,
          p_epis: p.epis ?? null,
          p_insalub_pct: p.insalubridade_pct ?? null,
          p_pericul_pct: p.periculosidade_pct ?? null,
          p_ordem: p.ordem ?? null,
          p_observacao: p.observacao ?? null,
        }),
      );
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const excluirPosto = useMutation<unknown, Error, string>({
    mutationFn: async (postoId) => {
      const { data, error } = await supabase.rpc("bdi_excluir_posto", {
        p_posto_id: postoId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const salvarVerba = useMutation<unknown, Error, SalvarVerbaArgs>({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc(
        "bdi_salvar_verba",
        rpcArgs<"bdi_salvar_verba">({
          p_versao_id: requireVer(),
          p_verba_id: v.id ?? null,
          p_rubrica: v.rubrica,
          p_percentual: v.percentual,
          p_ordem: v.ordem ?? null,
          p_observacao: v.observacao ?? null,
        }),
      );
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const excluirVerba = useMutation<unknown, Error, string>({
    mutationFn: async (verbaId) => {
      const { data, error } = await supabase.rpc("bdi_excluir_verba", {
        p_verba_id: verbaId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const salvarItem = useMutation<unknown, Error, SalvarItemArgs>({
    mutationFn: async (it) => {
      const { data, error } = await supabase.rpc(
        "bdi_salvar_item",
        rpcArgs<"bdi_salvar_item">({
          p_versao_id: requireVer(),
          p_item_id: it.id ?? null,
          p_grupo: it.grupo,
          p_tipo: it.tipo ?? null,
          p_campo_key: it.campo_key,
          p_label: it.label,
          p_unidade: it.unidade ?? null,
          p_quantidade: it.quantidade ?? null,
          p_vunit_est: it.valor_unitario_estimado ?? null,
          p_valor: it.valor ?? null,
          p_ordem: it.ordem ?? null,
          p_observacao: it.observacao ?? null,
          p_produto_servico_id: it.produto_servico_id ?? null,
        }),
      );
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const excluirItem = useMutation<unknown, Error, string>({
    mutationFn: async (itemId) => {
      const { data, error } = await supabase.rpc("bdi_excluir_item", {
        p_item_id: itemId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const recalcular = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("bdi_recalcular", {
        p_versao_id: requireVer(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const submeter = useMutation<unknown, Error, string | null>({
    mutationFn: async (justificativa) => {
      const { data, error } = await supabase.rpc("bdi_submeter", {
        p_versao_id: requireVer(),
        p_justificativa: justificativa ?? "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  // Mantido para uso futuro; sem botão na UI nesta REV.
  const cancelar = useMutation<unknown, Error, string>({
    mutationFn: async (justificativa) => {
      const { data, error } = await supabase.rpc("bdi_cancelar", {
        p_versao_id: requireVer(),
        p_justificativa: justificativa,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  return {
    versao: versaoQuery.data ?? null,
    versaoLoading: versaoQuery.isLoading,
    versaoError: versaoQuery.error,
    postos: postosQuery.data ?? [],
    verbas: verbasQuery.data ?? [],
    itens: itensQuery.data ?? [],
    isLoading:
      versaoQuery.isLoading ||
      postosQuery.isLoading ||
      verbasQuery.isLoading ||
      itensQuery.isLoading,
    criarVersao,
    atualizarVersao,
    salvarPosto,
    excluirPosto,
    salvarVerba,
    excluirVerba,
    salvarItem,
    excluirItem,
    recalcular,
    submeter,
    cancelar,
  };
}
