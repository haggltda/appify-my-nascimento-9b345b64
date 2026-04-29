import type { ReactNode } from "react";
import { usePermissoes, type Acao } from "@/context/PermissoesContext";

interface RoleGateProps {
  acao: Acao;
  modulo?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Esconde o conteúdo se o role atual não tiver permissão. */
export function RoleGate({ acao, modulo, children, fallback = null }: RoleGateProps) {
  const { can } = usePermissoes();
  return <>{can(acao, modulo) ? children : fallback}</>;
}
