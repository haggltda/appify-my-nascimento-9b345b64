import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";
import type { Draft } from "@/hooks/useCopilotoChat";
import type { PlanoAcaoRow } from "@/hooks/usePlanoAcoes";

export type Severidade = "alta" | "media" | "baixa";

export interface AcaoSimilar {
  acao: PlanoAcaoRow;
  score: number;
  nivel: Severidade;
  motivo: string;
}

const STOPWORDS = new Set([
  "a","o","e","de","da","do","das","dos","em","no","na","nos","nas","para","por",
  "com","sem","um","uma","uns","umas","que","se","ao","aos","à","às","ou","como",
  "the","of","and","to","in","on","for","with","is","are","be","by","at","an","a"
]);

function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string | null | undefined): Set<string> {
  const norm = normalize(text);
  if (!norm) return new Set();
  const out = new Set<string>();
  for (const w of norm.split(" ")) {
    if (w.length >= 3 && !STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

export function useAcoesSimilares() {
  const { empresaId } = usePermissoes();
  const [loading, setLoading] = useState(false);

  const buscar = useCallback(async (draft: Draft): Promise<AcaoSimilar[]> => {
    if (!empresaId) return [];
    setLoading(true);
    try {
      const draftTextoBase = `${draft.titulo ?? ""} ${draft.acao ?? ""} ${draft.problema ?? ""}`;
      const draftTokens = tokens(draftTextoBase);
      if (draftTokens.size === 0) return [];

      const { data, error } = await supabase
        .from("plano_acao")
        .select("*")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const candidatos = (data ?? []) as PlanoAcaoRow[];

      const draftComite = normalize(draft.comite);
      const draftArea = normalize(draft.area);
      const draftSetor = normalize(draft.setor);
      const draftResp = normalize(draft.responsavel_nome);
      const draftPrio = normalize(draft.prioridade_normalizada);

      const result: AcaoSimilar[] = [];

      for (const a of candidatos) {
        const candTokens = tokens(`${a.titulo ?? ""} ${a.acao ?? ""} ${a.problema ?? ""}`);
        const baseSim = jaccard(draftTokens, candTokens);
        if (baseSim === 0) continue;

        let score = baseSim * 0.7;
        const motivos: string[] = [];

        if (draftComite && normalize(a.comite) === draftComite) { score += 0.10; motivos.push("mesmo comitê"); }
        if (draftArea && normalize(a.area) === draftArea) { score += 0.08; motivos.push("mesma área"); }
        if (draftSetor && normalize(a.setor) === draftSetor) { score += 0.06; motivos.push("mesmo setor"); }
        if (draftResp && normalize(a.responsavel_nome_origem) === draftResp) { score += 0.04; motivos.push("mesmo responsável"); }
        if (draftPrio && normalize(a.prioridade_normalizada) === draftPrio) { score += 0.02; motivos.push("mesma prioridade"); }

        score = Math.min(1, score);
        if (score < 0.18) continue;

        const nivel: Severidade = score >= 0.60 ? "alta" : score >= 0.35 ? "media" : "baixa";
        const motivoTxt = `${Math.round(baseSim * 100)}% de termos em comum` + (motivos.length ? ` · ${motivos.join(", ")}` : "");
        result.push({ acao: a, score, nivel, motivo: motivoTxt });
      }

      result.sort((x, y) => y.score - x.score);
      return result.slice(0, 5);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  return { buscar, loading };
}
