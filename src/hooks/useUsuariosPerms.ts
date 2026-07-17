import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";

// =====================================================================
// Capacidades da tela Configuracoes do ERP > Usuarios, por usuario.
// Espelha ADMIN_USUARIOS_ACESSOS (RLS) e o helper public.pode_acao_usuario.
// Admin sempre pode (bypass). Usado so p/ mostrar/esconder botoes — a
// autoridade e a RLS/RPC no banco.
// =====================================================================

export type UsuarioCap = "vincular_usuario" | "ver_detalhe_usuario";

export function useUsuariosPerms() {
  const { user } = useAuth();
  const { roles } = usePermissoes();
  const isAdmin = roles.includes("admin");
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) { setCaps(new Set()); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("ADMIN_USUARIOS_ACESSOS").select("papel").eq("user_id", user.id);
    setCaps(new Set<string>((data ?? []).map((r: any) => r.papel)));
    setLoading(false);
  }, [user]);
  useEffect(() => { carregar(); }, [carregar]);

  const can = (c: UsuarioCap) => isAdmin || caps.has(c);
  return {
    isAdmin,
    podeVincular: can("vincular_usuario"),
    podeVerDetalhe: can("ver_detalhe_usuario"),
    loading,
    reload: carregar,
  };
}
