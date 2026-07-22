import { ReactNode } from "react";
import { useScreenAccess, type AppAcao } from "@/hooks/useScreenAccess";

interface AcessoGateProps {
  menu: string;
  acao: AppAcao;
  fallback?: ReactNode;
  children: ReactNode;
}

// Gate único e genérico de acesso: esconde o conteúdo se o usuário não tiver
// allow=true (via perfil de acesso ou exceção individual) pra este
// menu_codigo+acao. É o componente padrão pra qualquer bloco/ação de tela
// nova que precise de visibilidade diferente por pessoa — ver convenção em
// README.md ("toda tela nova registra 1 linha em app_menu por bloco").
export function AcessoGate({ menu, acao, fallback = null, children }: AcessoGateProps) {
  const { data: allowed, isLoading } = useScreenAccess(menu, acao);
  if (isLoading) return null;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
