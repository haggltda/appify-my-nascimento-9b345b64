import { ReactNode, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAccessibleMenus, matchMenuCode } from "@/hooks/useAccessibleMenus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Wraps the authenticated app outlet. If the current pathname maps to an
 * app_menu code that the user cannot view, render the access-denied screen
 * and log the attempt to access_audit_log. Admins always pass.
 *
 * Routes that don't map to any app_menu code are allowed by default
 * (legacy / cross-cutting screens) — those should be added to app_menu
 * to be governed.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data, isLoading } = useAccessibleMenus("visualizar");
  const loggedRef = useRef<string>("");

  const menuCode = data ? matchMenuCode(pathname, data.routes) : null;
  const allowed = !data || data.isAdmin || !menuCode || data.codes.has(menuCode);

  useEffect(() => {
    if (isLoading || allowed) return;
    const key = `${pathname}|${menuCode}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("access_audit_log").insert({
        user_id: u.user.id,
        menu_codigo: menuCode,
        rota: pathname,
        acao: "visualizar",
        allowed: false,
        motivo: "route_guard_block",
      });
    })();
  }, [isLoading, allowed, pathname, menuCode]);

  if (isLoading) return null;
  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold">Acesso negado</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Você não tem permissão para visualizar esta tela. Caso precise de acesso,
        solicite ao administrador em <strong>Configurações &gt; Acessos &amp; Permissões</strong>.
      </p>
      <p className="text-xs text-muted-foreground">
        Tela: <code>{menuCode}</code> · Rota: <code>{pathname}</code>
      </p>
      <Button asChild>
        <Link to="/app/painel-executivo">Voltar ao início</Link>
      </Button>
    </div>
  );
}
