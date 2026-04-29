import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Role =
  | "admin"
  | "controladoria"
  | "comercial"
  | "operacional"
  | "juridico"
  | "sst"
  | "diretor_adm"
  | "diretor_op"
  | "visitante";

export type Acao =
  | "visualizar"
  | "incluir"
  | "alterar"
  | "excluir"
  | "aprovar"
  | "exportar"
  | "executar_ia";

// Matriz mock — em produção virá de tabela `role_permissions`
const matriz: Record<Role, Partial<Record<string, Acao[]>>> = {
  admin: { "*": ["visualizar", "incluir", "alterar", "excluir", "aprovar", "exportar", "executar_ia"] },
  controladoria: {
    "*": ["visualizar", "exportar"],
    empresas: ["visualizar", "alterar", "exportar"],
    centros_custo: ["visualizar", "incluir", "alterar", "excluir", "exportar"],
    obz: ["visualizar", "incluir", "alterar", "aprovar", "exportar"],
  },
  comercial: { "*": ["visualizar"], editais: ["visualizar", "incluir", "alterar", "exportar"] },
  operacional: { "*": ["visualizar"], contratos: ["visualizar", "alterar"] },
  juridico: { "*": ["visualizar"], pareceres: ["visualizar", "incluir", "alterar"] },
  sst: { "*": ["visualizar"], pareceres: ["visualizar", "incluir", "alterar"] },
  diretor_adm: { "*": ["visualizar", "aprovar", "exportar"] },
  diretor_op: { "*": ["visualizar", "aprovar", "exportar"] },
  visitante: { "*": ["visualizar"] },
};

interface PermissoesCtx {
  role: Role;
  setRole: (r: Role) => void;
  can: (acao: Acao, modulo?: string) => boolean;
}

const Ctx = createContext<PermissoesCtx | null>(null);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "admin";
    return (localStorage.getItem("gn:role") as Role) ?? "admin";
  });

  const value = useMemo<PermissoesCtx>(
    () => ({
      role,
      setRole: (r) => {
        setRole(r);
        try { localStorage.setItem("gn:role", r); } catch { /* noop */ }
      },
      can: (acao, modulo) => {
        const perfil = matriz[role];
        const acoes = (modulo && perfil[modulo]) ?? perfil["*"] ?? [];
        return acoes.includes(acao);
      },
    }),
    [role],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissoes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissoes deve ser usado dentro de PermissoesProvider");
  return ctx;
}
