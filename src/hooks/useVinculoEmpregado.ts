import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface EmpregadoVinculo {
  id: number;
  nome: string;
  cpf: string;
  cargo: string;
  setor: string;
  perfil: string;
  lider: string;
  situacao: string;
  admissao: string;
  empresa: string;
  filial: string;
  email: string;
}

/**
 * Lê o cadastro EMPREGADOS vinculado ao usuário Auth atual (RPC meu_empregado,
 * que devolve só campos não-sensíveis). `linked=false` → ainda não vinculou.
 */
export function useVinculoEmpregado() {
  const { user, loading: authLoading } = useAuth();
  const [empregado, setEmpregado] = useState<EmpregadoVinculo | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false); // RPC respondeu sem erro (existe/atualizada)

  const refetch = useCallback(async () => {
    if (!user) {
      setEmpregado(null);
      setReady(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("meu_empregado");
    setLoading(false);
    if (error) {
      // RPC ausente (migration não aplicada) ou erro → não trava o app nem mostra card quebrado.
      console.error("[meu_empregado] erro:", error.message);
      setReady(false);
      setEmpregado(null);
      return;
    }
    setReady(true);
    setEmpregado(Array.isArray(data) && data.length ? (data[0] as EmpregadoVinculo) : null);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  return { empregado, linked: !!empregado, loading, ready, refetch };
}

/**
 * Encarregado = colaborador vinculado com Setor_ERP = 'ENCARREGADO'.
 * Esses usuários só podem ver o Início (cards de solicitação).
 */
export function useIsEncarregado() {
  const { empregado, loading } = useVinculoEmpregado();
  const isEncarregado = String(empregado?.setor ?? "").trim().toUpperCase() === "ENCARREGADO";
  return { isEncarregado, loading };
}
