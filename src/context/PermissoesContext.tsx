import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/context/DemoModeContext";

export type Role =
  | "admin"
  | "controladoria"
  | "comercial"
  | "operacional"
  | "juridico"
  | "sst"
  | "diretor_adm"
  | "diretor_op"
  | "presidencia"
  | "usuario"
  | "visitante"
  | "comprador"
  | "almoxarife"
  | "gestor_cc"
  | "fiscal_recebedor"
  | "financeiro"
  | "fiscal";

export type Acao =
  | "visualizar"
  | "incluir"
  | "alterar"
  | "excluir"
  | "aprovar"
  | "exportar"
  | "executar_ia";

interface PermissoesCtx {
  /** Role principal (a primeira retornada). */
  role: Role;
  /** Todas as roles do usuário. */
  roles: Role[];
  /** Empresa do usuário (do profile). */
  empresaId: string | null;
  /** True se carregando. */
  loading: boolean;
  /** Verifica permissão localmente. Se `menu` for informado, aceita também permissões específicas de menu. */
  can: (acao: Acao, modulo?: string, menu?: string) => boolean;
  /** Define manualmente o role (usado no modo demo). */
  setRole: (r: Role) => void;
}

const Ctx = createContext<PermissoesCtx | null>(null);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemoMode();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissoes, setPermissoes] = useState<Array<{ modulo: string; acao: Acao; menu: string | null }>>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "admin";
    return ((localStorage.getItem("gn:role") as Role) ?? "admin");
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      // Modo demo (visitante sem login): aplica role do localStorage
      if (!user) {
        if (!cancelled) {
          setRoles(isDemo ? [demoRole] : []);
          setPermissoes([]);
          setEmpresaId(null);
          setLoading(false);
        }
        return;
      }

      // 1) Roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = ((rolesData ?? []).map((r) => r.role)) as Role[];

      // 2) Empresa
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      // 3) Permissões matriz
      const { data: permsData } = await supabase
        .from("role_permissions")
        .select("modulo, acao, role, menu_codigo")
        .in("role", userRoles.length ? userRoles : ["usuario"]);

      if (!cancelled) {
        setRoles(userRoles.length ? userRoles : ["usuario"]);
        setEmpresaId(profile?.empresa_id ?? null);
        setPermissoes(
          (permsData ?? []).map((p: any) => ({ modulo: p.modulo, acao: p.acao as Acao, menu: p.menu_codigo ?? null })),
        );
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user, isDemo, demoRole]);

  const value = useMemo<PermissoesCtx>(() => ({
    role: roles[0] ?? "usuario",
    roles,
    empresaId,
    loading,
    setRole: (r) => {
      setDemoRole(r);
      try { localStorage.setItem("gn:role", r); } catch { /* noop */ }
    },
    can: (acao, modulo, menu) => {
      // Admin sempre pode
      if (roles.includes("admin")) return true;

      // Modo demo sem login: usa demoRole local
      if (!user && isDemo) {
        if (demoRole === "admin") return true;
        if (demoRole === "usuario" || demoRole === "visitante") return acao === "visualizar";
        return acao === "visualizar" || acao === "exportar";
      }

      // Verifica matriz vinda do Supabase.
      // Permissão de módulo (menu = null) cobre todas as telas.
      // Permissão de menu cobre apenas aquele menu.
      return permissoes.some((p) => {
        if (p.acao !== acao) return false;
        if (p.modulo === "*") return true;
        if (p.modulo !== modulo) return false;
        if (p.menu === null) return true; // módulo inteiro
        return menu !== undefined && p.menu === menu;
      });
    },
  }), [roles, empresaId, loading, permissoes, user, isDemo, demoRole]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissoes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissoes deve ser usado dentro de PermissoesProvider");
  return ctx;
}
