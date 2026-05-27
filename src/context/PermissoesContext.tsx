// Arquivo: src/context/PermissoesContext.tsx
// FASE 2 / FRONT-END
// Substituir integralmente para que a UI também reconheça overrides individuais por ação.
// O banco continua sendo a autoridade final via RLS/can_access.

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

interface RolePermission {
  modulo: string;
  acao: Acao;
  menu: string | null;
}

interface UserOverride {
  menu: string;
  acao: Acao;
  allow: boolean;
  empresaId: string | null;
}

interface ScreenProfilePermission {
  menu: string;
  acao: Acao;
  allow: boolean;
}

interface PermissoesCtx {
  role: Role;
  roles: Role[];
  empresaId: string | null;
  loading: boolean;
  can: (acao: Acao, modulo?: string, menu?: string) => boolean;
  setRole: (role: Role) => void;
}

const Ctx = createContext<PermissoesCtx | null>(null);

function findOverride(overrides: UserOverride[], acao: Acao, menu?: string, empresaId?: string | null): UserOverride | null {
  if (!menu) return null;

  const exactCompany = overrides.find(
    (item) =>
      item.menu === menu &&
      item.acao === acao &&
      empresaId !== null &&
      empresaId !== undefined &&
      item.empresaId === empresaId,
  );

  if (exactCompany) return exactCompany;

  return overrides.find(
    (item) =>
      item.menu === menu &&
      item.acao === acao &&
      item.empresaId === null,
  ) ?? null;
}

function hasRolePermission(permissoes: RolePermission[], acao: Acao, modulo?: string, menu?: string): boolean {
  return permissoes.some((permission) => {
    const actionMatches = permission.acao === acao;
    const menuMatches = menu ? permission.menu === menu : permission.menu === null;
    const moduleMatches =
      permission.modulo === "*" ||
      !modulo ||
      permission.modulo === modulo;

    if (!actionMatches) return false;

    if (menu) {
      return (
        (permission.menu === menu && moduleMatches) ||
        (permission.menu === null && moduleMatches)
      );
    }

    return menuMatches && moduleMatches;
  });
}

function hasScreenProfilePermission(permissoes: ScreenProfilePermission[], acao: Acao, menu?: string): boolean {
  if (!menu) return false;
  return permissoes.some(
    (permission) =>
      permission.menu === menu &&
      permission.acao === acao &&
      permission.allow === true,
  );
}

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemoMode();

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermissoes, setRolePermissoes] = useState<RolePermission[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserOverride[]>([]);
  const [screenProfilePermissoes, setScreenProfilePermissoes] = useState<ScreenProfilePermission[]>([]);
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

      if (!user) {
        if (!cancelled) {
          setRoles(isDemo ? [demoRole] : []);
          setRolePermissoes([]);
          setUserOverrides([]);
          setScreenProfilePermissoes([]);
          setEmpresaId(null);
          setLoading(false);
        }
        return;
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = ((rolesData ?? []).map((item) => item.role)) as Role[];

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id, empresa_atual_id")
        .eq("id", user.id)
        .maybeSingle();

      const activeEmpresaId = profile?.empresa_atual_id ?? profile?.empresa_id ?? null;
      const fallbackRoles = userRoles.length ? userRoles : ["usuario" as Role];

      const [rolePermsRes, overridesRes, screenProfileRes] = await Promise.all([
        supabase
          .from("role_permissions")
          .select("modulo, acao, role, menu_codigo")
          .in("role", fallbackRoles),
        supabase
          .from("screen_permission_user")
          .select("menu_codigo, acao, allow, empresa_id")
          .eq("user_id", user.id)
          .or(activeEmpresaId ? `empresa_id.is.null,empresa_id.eq.${activeEmpresaId}` : "empresa_id.is.null"),
        supabase
          .from("screen_permission_profile")
          .select("menu_codigo, acao, allow, role")
          .in("role", fallbackRoles),
      ]);

      if (!cancelled) {
        setRoles(fallbackRoles);
        setEmpresaId(activeEmpresaId);
        setRolePermissoes(
          (rolePermsRes.data ?? []).map((permission: any) => ({
            modulo: permission.modulo,
            acao: permission.acao as Acao,
            menu: permission.menu_codigo ?? null,
          })),
        );
        setUserOverrides(
          (overridesRes.data ?? []).map((permission: any) => ({
            menu: permission.menu_codigo,
            acao: permission.acao as Acao,
            allow: Boolean(permission.allow),
            empresaId: permission.empresa_id ?? null,
          })),
        );
        setScreenProfilePermissoes(
          (screenProfileRes.data ?? []).map((permission: any) => ({
            menu: permission.menu_codigo,
            acao: permission.acao as Acao,
            allow: Boolean(permission.allow),
          })),
        );
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user, isDemo, demoRole]);

  const value = useMemo<PermissoesCtx>(() => ({
    role: roles[0] ?? "usuario",
    roles,
    empresaId,
    loading,
    setRole: (nextRole) => {
      setDemoRole(nextRole);
      try {
        localStorage.setItem("gn:role", nextRole);
      } catch {
        return;
      }
    },
    can: (acao, modulo, menu) => {
      if (roles.includes("admin")) return true;

      if (!user && isDemo) {
        if (demoRole === "admin") return true;
        if (demoRole === "usuario" || demoRole === "visitante") return acao === "visualizar";
        return acao === "visualizar" || acao === "exportar";
      }

      const override = findOverride(userOverrides, acao, menu, empresaId);
      if (override) return override.allow;

      if (hasRolePermission(rolePermissoes, acao, modulo, menu)) return true;
      if (hasScreenProfilePermission(screenProfilePermissoes, acao, menu)) return true;

      return false;
    },
  }), [demoRole, empresaId, isDemo, loading, rolePermissoes, roles, screenProfilePermissoes, user, userOverrides]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissoes() {
  const context = useContext(Ctx);
  if (!context) throw new Error("usePermissoes deve ser usado dentro de PermissoesProvider");
  return context;
}

