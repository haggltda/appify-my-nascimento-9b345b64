import { ReactNode } from "react";
import { useScreenAccess, type AppAcao } from "@/hooks/useScreenAccess";

interface ScreenGateProps {
  menu: string;
  acao: AppAcao;
  empresaId?: string | null;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ScreenGate({ menu, acao, empresaId, fallback = null, children }: ScreenGateProps) {
  const { data: allowed, isLoading } = useScreenAccess(menu, acao, empresaId);
  if (isLoading) return null;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
