import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EmitirArgs = {
  cronograma_id: string;
  meio_cobranca?: string;
  conta_bancaria_id?: string | null;
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["cronograma_faturamento"] });
  qc.invalidateQueries({ queryKey: ["cronograma_faturamento_todos"] });
  qc.invalidateQueries({ queryKey: ["cronograma-pendentes"] });
  qc.invalidateQueries({ queryKey: ["faturados-contrato"] });
  qc.invalidateQueries({ queryKey: ["titulos-receber"] });
}

export function useEmitirTituloDeCronograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cronograma_id, meio_cobranca = "boleto", conta_bancaria_id }: EmitirArgs) => {
      const { data, error } = await (supabase as any).rpc("emitir_titulo_de_cronograma", {
        _cronograma_id: cronograma_id,
        _meio_cobranca: meio_cobranca,
        _conta_bancaria_id: conta_bancaria_id ?? null,
      });
      if (error) throw error;
      return data as { titulo_id: string; numero: string; cronograma_id: string };
    },
    onSuccess: (d) => {
      toast.success(`Título ${d.numero} emitido`);
      invalidateAll(qc);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao emitir título"),
  });
}

export function useEmitirTitulosLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      meio_cobranca = "boleto",
      conta_bancaria_id,
    }: { ids: string[]; meio_cobranca?: string; conta_bancaria_id?: string | null }) => {
      const { data, error } = await (supabase as any).rpc("emitir_titulos_cronograma_lote", {
        _ids: ids,
        _meio_cobranca: meio_cobranca,
        _conta_bancaria_id: conta_bancaria_id ?? null,
      });
      if (error) throw error;
      return data as { ok: number; fail: number; detalhes: any[] };
    },
    onSuccess: (d) => {
      if (d.fail === 0) toast.success(`${d.ok} título(s) emitido(s)`);
      else toast.warning(`${d.ok} emitido(s) · ${d.fail} falha(s)`);
      invalidateAll(qc);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro na emissão em lote"),
  });
}
