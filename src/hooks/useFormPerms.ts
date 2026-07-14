import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { useVinculoEmpregado } from "@/hooks/useVinculoEmpregado";

// =====================================================================
// NASCIMENTO FORMULARIOS - capacidades do usuario logado
// Espelha a RLS (public.cs_form_cap): 'responder' e o default de todo
// autenticado; as demais capacidades vem de CS_FORM_ACESSOS por USUARIO -
// SEM bypass de admin (admin tambem depende dos grants aqui). Usado so p/
// mostrar/esconder botoes - a autoridade continua sendo a RLS no banco.
// =====================================================================

export type FormCap =
  | "editar_criar" | "responder" | "encerrar_excluir"
  | "ver_tudo" | "ver_proprias";

const VIEW_CAPS: FormCap[] = ["ver_tudo", "ver_proprias"];

export function useFormPerms() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const { empregado } = useVinculoEmpregado();
  const setor = empregado?.setor || null;  // usado por Formularios (setores_acesso), nao por permissao
  const isAdmin = roles.includes("admin");
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) { setCaps(new Set()); setLoading(false); return; }
    const uRes = await (supabase as any).from("CS_FORM_ACESSOS")
      .select("papel").eq("user_id", user.id).neq("papel", "dashboard");
    setCaps(new Set<string>((uRes.data ?? []).map((r: any) => r.papel)));
    setLoading(false);
  }, [user]);
  useEffect(() => { carregar(); }, [carregar]);

  // Formularios e governado 100% pelos grants POR USUARIO - inclusive admin.
  // 'responder' segue liberado por padrao a todo autenticado (Abrir/responder).
  const can = (c: FormCap) => c === "responder" || caps.has(c);
  const canVerAlguma = VIEW_CAPS.some((c) => caps.has(c));
  return { isAdmin, can, canVerAlguma, setor, loading, reload: carregar };
}
