import { supabase } from "@/integrations/supabase/client";

/** Grava uma entrada na aba Histórico. Silencioso em erro - nunca deve travar a ação principal que já aconteceu. */
export async function registrarLog(reuniaoId: string, acao: string, detalhe: string) {
  try {
    await (supabase as any).from("reuniao_log").insert({ reuniao_id: reuniaoId, acao, detalhe });
  } catch {
    // best-effort
  }
}
