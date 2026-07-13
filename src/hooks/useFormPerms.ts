import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - capacidades do usuário logado
// Espelha a RLS (public.cs_form_cap): admin faz tudo; os demais dependem
// das linhas em CS_FORM_ACESSOS (papel). Usado só para mostrar/esconder
// botões - a autoridade continua sendo a RLS no banco.
// =====================================================================

export type FormCap =
  | "editar_criar" | "responder" | "encerrar_excluir"
  | "ver_tudo" | "ver_admin" | "ver_op" | "ver_proprias";

const VIEW_CAPS: FormCap[] = ["ver_tudo", "ver_admin", "ver_op", "ver_proprias"];

export function useFormPerms() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const isAdmin = roles.includes("admin");
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) { setCaps(new Set()); setLoading(false); return; }
    const { data } = await (supabase as any).from("CS_FORM_ACESSOS")
      .select("papel").eq("user_id", user.id).neq("papel", "dashboard");
    setCaps(new Set((data ?? []).map((r: any) => r.papel)));
    setLoading(false);
  }, [user]);
  useEffect(() => { carregar(); }, [carregar]);

  const can = (c: FormCap) => isAdmin || caps.has(c);
  const canVerAlguma = isAdmin || VIEW_CAPS.some((c) => caps.has(c));
  return { isAdmin, can, canVerAlguma, loading, reload: carregar };
}
