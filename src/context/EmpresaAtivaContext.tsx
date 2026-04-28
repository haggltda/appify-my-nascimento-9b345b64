import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { empresasGrupo, type EmpresaGrupo } from "@/data/controladoria";

interface EmpresaAtivaContextValue {
  empresa: EmpresaGrupo;
  empresas: EmpresaGrupo[];
  setEmpresa: (id: string) => void;
}

const EmpresaAtivaContext = createContext<EmpresaAtivaContextValue | null>(null);

export function EmpresaAtivaProvider({ children }: { children: ReactNode }) {
  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (typeof window === "undefined") return empresasGrupo[0].id;
    return localStorage.getItem("gn:empresa_ativa") ?? empresasGrupo[0].id;
  });

  const value = useMemo<EmpresaAtivaContextValue>(() => {
    const empresa =
      empresasGrupo.find((e) => e.id === empresaId) ?? empresasGrupo[0];
    return {
      empresa,
      empresas: empresasGrupo,
      setEmpresa: (id: string) => {
        setEmpresaId(id);
        try {
          localStorage.setItem("gn:empresa_ativa", id);
        } catch {
          /* ignore */
        }
      },
    };
  }, [empresaId]);

  return (
    <EmpresaAtivaContext.Provider value={value}>
      {children}
    </EmpresaAtivaContext.Provider>
  );
}

export function useEmpresaAtiva() {
  const ctx = useContext(EmpresaAtivaContext);
  if (!ctx) {
    throw new Error("useEmpresaAtiva deve ser usado dentro de EmpresaAtivaProvider");
  }
  return ctx;
}
