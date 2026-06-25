import { ReactNode, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAccessibleMenus, matchMenuCode } from "@/hooks/useAccessibleMenus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/lib/featureFlags";

/**
 * Bloco V3 — Rotas governadas por feature flag soberana de fase.
 * Quando a flag está desativada, o RouteGuard nega acesso mesmo que a rota
 * esteja em app_menu / permissões. Reativação exige flip explícito da flag.
 */
const PHASE_FLAGGED_ROUTES: { prefix: string; flag: "triagemIA" }[] = [
  // Triagem IA — desativada permanentemente (decisão de negócio 2026-05-28).
  { prefix: "/app/triagem", flag: "triagemIA" },
  // Copiloto IA (plano de ações) — desativado permanentemente sob a mesma flag
  // soberana de IA. Decisão de negócio 2026-05-28: nenhum usuário final do ERP
  // deve acessar funcionalidades de IA da Fase 1.
  { prefix: "/app/plano-acoes/copiloto", flag: "triagemIA" },
];

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
  "/app/sistemas/solicitacoes-erp",  // Liberado a qualquer autenticado — sem permissão por usuário
];

function inAllowlist(pathname: string): boolean {
  return TECHNICAL_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data, isLoading } = useAccessibleMenus("visualizar");
  const loggedRef = useRef<string>("");

  // Bloco V3 — checagem soberana de fase via feature flag.
  // Se a flag de fase estiver desativada, a rota é negada independente de qualquer permissão.
  const [triagemIAEnabled] = useFeatureFlag("triagemIA", false);
  const phaseFlagged = PHASE_FLAGGED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  const phaseFlagEnabled = phaseFlagged
    ? (phaseFlagged.flag === "triagemIA" ? triagemIAEnabled : false)
    : true;

  const menuCode = data ? matchMenuCode(pathname, data.routes) : null;

  // Acesso determinado exclusivamente pelo painel de usuários em /app/administracao?tab=modulos.
  // Cargo/role não concede nenhum bypass — a RPC list_accessible_menus retorna apenas
  // menus com allow=true explícito para TODOS os usuários (incluindo admin).
  const allowed =
    phaseFlagEnabled &&
    (!data || (menuCode ? data.codes.has(menuCode) : inAllowlist(pathname)));

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

  // Só bloqueia na primeira carga (sem dados). Com dados em cache (mesmo query key
  // diferente), mantém o children montado para não perder estado da Lista.
  if (!data) return null;
  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold">Acesso negado</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Você não tem permissão para visualizar esta tela. Caso precise de acesso,
        solicite ao administrador em <strong>Administração &gt; Módulos &amp; Menus</strong>.
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
