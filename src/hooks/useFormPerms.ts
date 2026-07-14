import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { useVinculoEmpregado } from "@/hooks/useVinculoEmpregado";

// =====================================================================
// NASCIMENTO FORMULARIOS - capacidades do usuario logado
// Espelha a RLS (public.cs_form_cap): admin faz tudo; 'responder' e o default
// de todos; as demais capacidades vem de CS_FORM_ACESSOS por USUARIO (sem mais
// heranca por setor). Usado so p/ mostrar/esconder botoes - a autoridade
// continua sendo a RLS no banco.
// =====================================================================

export type FormCap =
  | "editar_criar" | "responder" | "encerrar_excluir"
  | "ver_tudo" | "ver_admin" | "ver_op" | "ver_proprias";

const VIEW_CAPS: FormCap[] = ["ver_tudo", "ver_admin", "ver_op", "ver_proprias"];

export function useFormPerms() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const { empregado } = useVinculoEmpregado();
  const setor = empregado?.setor || null;
  const isAdmin = roles.includes("admin");
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) { setCaps(new Set()); setLoading(false); return; }
    // So capacidades concedidas ao PROPRIO usuario (sem heranca por setor).
    const uRes = await (supabase as any).from("CS_FORM_ACESSOS").select("papel").eq("user_id", user.id).neq("papel", "dashboard");
    setCaps(new Set<string>((uRes.data ?? []).map((r: any) => r.papel)));
    setLoading(false);
  }, [user]);
  useEffect(() => { carregar(); }, [carregar]);

  // 'responder' e liberado por padrao p/ todo autenticado.
  const can = (c: FormCap) => isAdmin || c === "responder" || caps.has(c);
  const canVerAlguma = isAdmin || VIEW_CAPS.some((c) => caps.has(c));
  return { isAdmin, can, canVerAlguma, setor, loading, reload: carregar };
}
