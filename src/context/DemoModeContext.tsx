import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

type DemoCtx = {
  isDemo: boolean;
  enableDemo: () => void;
  disableDemo: () => void;
  /** Returns true if the action should be BLOCKED (and shows a toast). */
  blockWrite: (label?: string) => boolean;
};

const Ctx = createContext<DemoCtx | undefined>(undefined);
const STORAGE_KEY = "gn:demo-mode";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try {
      if (isDemo) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
  }, [isDemo]);

  const enableDemo = useCallback(() => setIsDemo(true), []);
  const disableDemo = useCallback(() => setIsDemo(false), []);

  const blockWrite = useCallback((label = "Esta ação") => {
    if (!isDemo) return false;
    toast({
      title: "Modo demonstração",
      description: `${label} está desabilitada no ambiente somente leitura.`,
      variant: "destructive",
    });
    return true;
  }, [isDemo]);

  return (
    <Ctx.Provider value={{ isDemo, enableDemo, disableDemo, blockWrite }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDemoMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemoMode must be used within DemoModeProvider");
  return ctx;
}
