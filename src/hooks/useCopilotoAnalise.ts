import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, Draft } from "./useCopilotoChat";

export interface QualificacaoProblema {
  clareza: "Alta" | "Média" | "Baixa";
  problema_original: string;
  problema_sugerido: string;
  pontos_ausentes: string[];
  perguntas_recomendadas: string[];
}

export interface GanttEtapa {
  etapa: string;
  inicio: string;
  fim: string;
  status: string;
}

export interface RiscoAnalise {
  risco: string;
  severidade: "Alta" | "Média" | "Baixa";
  justificativa: string;
  recomendacao: string;
}

export interface AnaliseCopiloto {
  contexto: string[];
  sugestoes: string[];
  qualificacao_problema: QualificacaoProblema;
  gantt_etapas: GanttEtapa[];
  riscos: RiscoAnalise[];
}

export function useCopilotoAnalise() {
  const [data, setData] = useState<AnaliseCopiloto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (draft: Draft, messages: ChatMessage[]) => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("copiloto-acoes-analise", {
        body: { draft, messages },
      });
      if (err) throw new Error(err.message || "Falha ao gerar análise.");
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as AnaliseCopiloto);
      return res as AnaliseCopiloto;
    } catch (e: any) {
      const msg = e?.message || "Não foi possível gerar a análise agora. Revise os campos preenchidos ou tente novamente.";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setData(null); setError(null); }, []);

  return { data, loading, error, run, reset };
}
