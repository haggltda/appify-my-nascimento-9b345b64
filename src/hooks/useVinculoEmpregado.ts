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
    if (!error) {
      setLoading(false);
      setReady(true);
      setEmpregado(Array.isArray(data) && data.length ? (data[0] as EmpregadoVinculo) : null);
      return;
    }

    // Fallback: RPC indisponível → consulta direta (authenticated lê EMPREGADOS).
    // Mantém o card de vínculo funcionando mesmo se meu_empregado ainda não existir.
    console.warn("[meu_empregado] indisponível, usando fallback direto:", error.message);
    const { data: row, error: e2 } = await (supabase as any)
      .from("EMPREGADOS")
      .select('"ID","Nome","CPF","Título do Cargo","Setor_ERP","Perfil_ERP","LIDER","Situação","Admissão","Nome da Empresa","Nome Filial","email"')
      .eq("auth_user_id", user.id)
      .maybeSingle();
    setLoading(false);
    if (e2) {
      // Sem coluna auth_user_id / sem acesso → não mostra card quebrado.
      console.error("[vinculo] probe direto falhou:", e2.message);
      setReady(false);
      setEmpregado(null);
      return;
    }
    setReady(true);
    setEmpregado(row ? {
      id: row["ID"], nome: row["Nome"] ?? "", cpf: row["CPF"] ?? "",
      cargo: row["Título do Cargo"] ?? "", setor: row["Setor_ERP"] ?? "",
      perfil: row["Perfil_ERP"] ?? "", lider: row["LIDER"] ?? "",
      situacao: row["Situação"] ?? "", admissao: row["Admissão"] ?? "",
      empresa: row["Nome da Empresa"] ?? "", filial: row["Nome Filial"] ?? "",
      email: row["email"] ?? "",
    } as EmpregadoVinculo : null);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  return { empregado, linked: !!empregado, loading, ready, refetch };
}
