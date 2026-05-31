import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GradeImportRow } from "@/utils/licitacoes/mapGradeToImportRows";

export type ImportacaoErro = {
  linha?: number;
  erro?: string;
  campo?: string;
  mensagem?: string;
};

export type PendenciaResponsavel = {
  linha?: number;
  texto?: string;
  responsavel_texto?: string;
};

export type LoteImportacaoResumo = {
  id: string;
  total_linhas?: number;
  total_erros?: number;
  erros_json?: ImportacaoErro[];
  pendencias_responsavel?: PendenciaResponsavel[];
  status?: string;
};

export type AnexarResult = {
  linhas_recebidas?: number;
  linhas_validas?: number;
  linhas_invalidas?: number;
  erros?: ImportacaoErro[];
  pendencias_responsavel?: PendenciaResponsavel[];
  status_lote?: string;
  lote?: LoteImportacaoResumo;
};

export type ConfirmarResult = {
  lote?: string;
  inseridas?: number;
  atualizadas?: number;
  ignoradas?: number;
  pendencias_responsavel?: number;
  erros?: number;
};

/** H17 — normalização de qualquer formato de erro do backend. */
export function normalizeError(e: unknown, fallback: string): string {
  if (!e) return fallback;
  if (typeof e === "string") return e || fallback;
  if (typeof e === "object") {
    const o = e as { message?: string; error?: string; details?: string; hint?: string };
    return o.message || o.error || o.details || o.hint || fallback;
  }
  return fallback;
}

function explainError(e: unknown, fallback: string): string {
  const msg = normalizeError(e, fallback);
  if (/permission|denied|admin|role|policy|RLS/i.test(msg)) {
    return "Apenas administradores podem importar a Grade.";
  }
  return msg;
}

/** Busca o lote para enriquecer o preview (H10/H7). */
export async function obterLote(lote: string): Promise<LoteImportacaoResumo | null> {
  const { data, error } = await supabase
    .from("licitacao_importacao_lote")
    .select("id,total_linhas,total_erros,erros_json,pendencias_responsavel,status")
    .eq("id", lote)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as LoteImportacaoResumo | null) ?? null;
}

export function useLicitacaoImportacao() {
  const qc = useQueryClient();

  const criarLote = useMutation<
    string,
    Error,
    { empresaId: string; arquivoNome?: string; arquivoHash?: string }
  >({
    mutationFn: async ({ empresaId, arquivoNome, arquivoHash }) => {
      const { data, error } = await supabase.rpc("licitacao_importacao_criar_lote", {
        p_empresa: empresaId,
        p_arquivo_nome: arquivoNome ?? "grade.json",
        p_arquivo_hash: arquivoHash ?? "",
      });
      if (error) throw new Error(explainError(error, "Falha ao criar lote."));
      return data as string;
    },
  });

  const anexarLinhas = useMutation<
    AnexarResult,
    Error,
    { lote: string; linhas: GradeImportRow[] }
  >({
    mutationFn: async ({ lote, linhas }) => {
      const { data, error } = await supabase.rpc("licitacao_importacao_anexar_linhas", {
        p_lote: lote,
        p_linhas: linhas as unknown as never,
      });
      if (error) throw new Error(explainError(error, "Falha ao anexar linhas."));
      const base = ((data ?? {}) as unknown) as AnexarResult;
      const detalhe = await obterLote(lote);
      return {
        ...base,
        erros: base.erros ?? detalhe?.erros_json ?? [],
        pendencias_responsavel:
          base.pendencias_responsavel ?? detalhe?.pendencias_responsavel ?? [],
        status_lote: detalhe?.status ?? base.status_lote,
        lote: detalhe ?? undefined,
      };
    },
  });

  const confirmarLote = useMutation<ConfirmarResult, Error, { lote: string }>({
    mutationFn: async ({ lote }) => {
      const { data, error } = await supabase.rpc("licitacao_importacao_confirmar", {
        p_lote: lote,
      });
      if (error) throw new Error(explainError(error, "Falha ao confirmar lote."));
      return ((data ?? {}) as unknown) as ConfirmarResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licitacoes"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  const cancelarLote = useMutation<void, Error, { lote: string }>({
    mutationFn: async ({ lote }) => {
      const { error } = await supabase.rpc("licitacao_importacao_cancelar", {
        p_lote: lote,
      });
      if (error) throw new Error(explainError(error, "Falha ao cancelar lote."));
    },
  });

  const isCreating = criarLote.isPending;
  const isUploading = anexarLinhas.isPending;
  const isConfirming = confirmarLote.isPending;
  const isCanceling = cancelarLote.isPending;
  const isBusy = isCreating || isUploading || isConfirming || isCanceling;

  return {
    criarLote,
    anexarLinhas,
    confirmarLote,
    cancelarLote,
    obterLote,
    isCreating,
    isUploading,
    isConfirming,
    isCanceling,
    isBusy,
  };
}
