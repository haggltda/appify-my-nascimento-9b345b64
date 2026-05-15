import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/context/DemoModeContext";
import { useMustChangePassword } from "@/hooks/useMustChangePassword";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isDemo } = useDemoMode();
  const { mustChange, loading: mcLoading } = useMustChangePassword(user?.id);
  const location = useLocation();

  if (loading || (user && !isDemo && mcLoading)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Carregando sessão…
      </div>
    );
  }

  if (!user && !isDemo) {
    return <Navigate to="/login" replace />;
  }

  // Usuário real precisa trocar a senha (reset feito por admin)
  if (user && !isDemo && !mcLoading && mustChange && location.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }

  return <>{children}</>;
}
