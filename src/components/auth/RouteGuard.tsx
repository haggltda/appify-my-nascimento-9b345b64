import { ReactNode, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAccessibleMenus, matchMenuCode } from "@/hooks/useAccessibleMenus";
import { usePermissoes } from "@/context/PermissoesContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/lib/featureFlags";

/**
 * Bloco V3 — Rotas governadas por feature flag soberana de fase.
 * Quando a flag está desativada, o RouteGuard nega acesso mesmo para admin
 * e mesmo que a rota esteja em app_menu / permissões. Reativação exige
 * flip explícito da flag (Fase 1 = desativada por padrão).
 */
const PHASE_FLAGGED_ROUTES: { prefix: string; flag: "triagemIA" }[] = [
  { prefix: "/app/triagem", flag: "triagemIA" },
];

/**
 * Rotas privilegiadas que sempre são liberadas para admin, controladoria e
 * presidência, mesmo que ainda não estejam mapeadas em screen_permission_*.
 */
const PRIVILEGED_ROUTES = ["/app/admin/permissoes"];
const PRIVILEGED_ROLES = ["admin", "controladoria", "presidencia"];

/**
 * B2 — Allowlist técnica.
 * Rotas que NÃO precisam estar em `app_menu` para serem acessadas, por serem
 * técnicas (perfil próprio, índice do app) ou ainda pendentes de cadastro na
 * matriz do ERP (decisão temporária — devem migrar para `app_menu` no futuro).
 * Suporta match exato OU prefixo (`/app/ajuda/qualquer-coisa` casa com `/app/ajuda`).
 */
const TECHNICAL_ALLOWLIST = [
  "/app",                            // Início (index do AppShell)
  "/app/meu-perfil",                 // Perfil do próprio usuário logado
  "/app/co/orcamento-completo",      // TODO B2.x: cadastrar em app_menu
  "/app/contabil/razao-detalhado",   // TODO B2.x: cadastrar em app_menu
];

/** Rotas técnicas restritas a um role específico (sem registro em app_menu). */
const ROLE_RESTRICTED_ROUTES: { route: string; roles: string[] }[] = [
  { route: "/app/admin/smoke-helena", roles: ["admin"] },
];

function inAllowlist(pathname: string): boolean {
  return TECHNICAL_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function checkRoleRestricted(pathname: string, roles: string[]): boolean | null {
  const match = ROLE_RESTRICTED_ROUTES.find(
    (r) => pathname === r.route || pathname.startsWith(r.route + "/"),
  );
  if (!match) return null; // não é rota role-restricted
  return roles.some((r) => match.roles.includes(r));
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data, isLoading } = useAccessibleMenus("visualizar");
  const { roles } = usePermissoes();
  const loggedRef = useRef<string>("");

  // Bloco V3 — checagem soberana de fase via feature flag.
  // Se a flag de fase estiver desativada, a rota é negada mesmo para
  // admin / menu liberado / permissão liberada.
  const [triagemIAEnabled] = useFeatureFlag("triagemIA", false);
  const phaseFlagged = PHASE_FLAGGED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  const phaseFlagEnabled = phaseFlagged
    ? (phaseFlagged.flag === "triagemIA" ? triagemIAEnabled : false)
    : true;

  const menuCode = data ? matchMenuCode(pathname, data.routes) : null;
  const isPrivilegedRoute = PRIVILEGED_ROUTES.some((r) => pathname.startsWith(r));
  const hasPrivilegedRole = roles.some((r) => PRIVILEGED_ROLES.includes(r));
  const privilegedBypass = isPrivilegedRoute && hasPrivilegedRole;
  const roleRestricted = checkRoleRestricted(pathname, roles);

  // B2 — deny-by-default: rota sem menuCode e fora da allowlist é negada
  // (admin sempre passa pelo bypass `data.isAdmin`).
  // V3 — flag soberana de fase prevalece sobre qualquer bypass.
  const allowed =
    phaseFlagEnabled &&
    (!data ||
      data.isAdmin ||
      privilegedBypass ||
      (roleRestricted !== null
        ? roleRestricted
        : (menuCode ? data.codes.has(menuCode) : inAllowlist(pathname))));




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
        motivo: !phaseFlagEnabled
          ? `route_guard_phase_flag_off:${phaseFlagged?.flag}`
          : (menuCode ? "route_guard_block" : "route_guard_block_no_menu"),
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
