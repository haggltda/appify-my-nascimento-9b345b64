import { Eye, X } from "lucide-react";
import { useDemoMode } from "@/context/DemoModeContext";
import { useNavigate } from "react-router-dom";

export function DemoBanner() {
  const { isDemo, disableDemo } = useDemoMode();
  const navigate = useNavigate();
  if (!isDemo) return null;

  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-3 border-b border-warning/30 bg-warning/15 px-4 py-2 text-xs font-medium text-warning-foreground backdrop-blur">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-warning/30">
        <Eye className="h-3 w-3" />
      </span>
      <p className="text-foreground">
        <strong className="font-semibold">Ambiente de demonstração</strong>
        <span className="mx-2 opacity-50">·</span>
        Dados fictícios · Todas as ações de escrita estão desabilitadas (somente leitura)
      </p>
      <button
        onClick={() => { disableDemo(); navigate("/login"); }}
        className="ml-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:border-border-strong hover:text-foreground"
        title="Sair do modo demonstração"
      >
        <X className="h-3 w-3" /> Sair da demonstração
      </button>
    </div>
  );
}
