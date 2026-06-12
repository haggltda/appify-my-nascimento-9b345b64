import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";

/**
 * Returns the set of menu codes the current user can VIEW.
 * Used to filter the Sidebar and to enforce route-level access.
 *
 * Passes the active empresa to `list_accessible_menus` so that
 * per-empresa overrides in `screen_permission_user` are honored
 * by the menu/route layer (parity with `useScreenAccess`).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useAccessibleMenus(acao: string = "visualizar") {
  const { empresa } = useEmpresaAtiva();
  // Só passa pro banco se for um UUID real — mock IDs como "HAGG" causam erro 400.
  const rawId = empresa?.id ?? null;
  const empresaId = rawId && UUID_RE.test(rawId) ? rawId : null;

  return useQuery({
    queryKey: ["accessible-menus", acao, empresaId],
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { codes: new Set<string>(), routes: new Map<string, string>() };

      const [rpcResult, menusResult] = await Promise.all([
        supabase.rpc("list_accessible_menus", {
          _user: u.user.id,
          _acao: acao,
          _empresa: empresaId,
        }),
        supabase.from("app_menu").select("codigo, rota").eq("ativo", true),
      ]);

      if (rpcResult.error) {
        console.warn("list_accessible_menus error", rpcResult.error);
        return { codes: new Set<string>(), routes: new Map<string, string>() };
      }
      const codes = new Set<string>((rpcResult.data ?? []).map((r: any) => r.menu_codigo));

      const routes = new Map<string, string>();
      (menusResult.data ?? []).forEach((m: any) => {
        if (m.rota) routes.set(m.codigo, m.rota);
      });

      return { codes, routes };
    },
  });
}

/** Best-effort match of a pathname to an app_menu code (longest-prefix). */
export function matchMenuCode(pathname: string, routes: Map<string, string>): string | null {
  let best: { code: string; len: number } | null = null;
  routes.forEach((rota, code) => {
    // Normalize dynamic segments like /:id by comparing only up to the first ":"
    const base = rota.split("/:")[0];
    if (pathname === rota || pathname === base || pathname.startsWith(base + "/")) {
      if (!best || base.length > best.len) best = { code, len: base.length };
    }
  });
  return best?.code ?? null;
}
