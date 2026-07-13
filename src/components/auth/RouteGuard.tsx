import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/lib/featureFlags";

/**
 * Bloco V3 - Rotas governadas por feature flag soberana de fase.
 * Quando a flag está desativada, o RouteGuard nega acesso.
 * Reativação exige flip explícito da flag.
 */
const PHASE_FLAGGED_ROUTES: { prefix: string; flag: "triagemIA" }[] = [
  // Triagem IA - desativada permanentemente (decisão de negócio 2026-05-28).
  { prefix: "/app/triagem", flag: "triagemIA" },
  // Copiloto IA (plano de ações) - desativado permanentemente sob a mesma flag
  // soberana de IA. Decisão de negócio 2026-05-28: nenhum usuário final do ERP
  // deve acessar funcionalidades de IA da Fase 1.
  { prefix: "/app/plano-acoes/copiloto", flag: "triagemIA" },
];

/**
 * Sem regra de permissão por tela: todo usuário autenticado acessa qualquer
 * rota do app. Somente as feature flags de fase (IA) continuam bloqueando
 * suas rotas.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const [triagemIAEnabled] = useFeatureFlag("triagemIA", false);
  const phaseFlagged = PHASE_FLAGGED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  const phaseFlagEnabled = phaseFlagged
    ? (phaseFlagged.flag === "triagemIA" ? triagemIAEnabled : false)
    : true;

  if (phaseFlagEnabled) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold">Funcionalidade desativada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Esta funcionalidade está desativada por decisão de negócio.
      </p>
      <p className="text-xs text-muted-foreground">
        Rota: <code>{pathname}</code>
      </p>
      <Button asChild>
        <Link to="/app/painel-executivo">Voltar ao início</Link>
      </Button>
    </div>
  );
}
