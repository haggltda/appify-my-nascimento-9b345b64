import { Bell, Search, PanelLeft, ChevronDown, Building2, HelpCircle, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { empresas } from "@/data/licitacoes";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/context/DemoModeContext";

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [empresa, setEmpresa] = useState(empresas[0]);
  const [openSelector, setOpenSelector] = useState(false);
  const navigate = useNavigate();
  const { disableDemo } = useDemoMode();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/70 bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={onToggleSidebar}
        className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Alternar menu"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Empresa selector */}
      <div className="relative">
        <button
          onClick={() => setOpenSelector((o) => !o)}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5 text-left shadow-sm transition-colors hover:border-border-strong"
        >
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Empresa ativa</p>
            <p className="truncate text-xs font-semibold text-foreground">{empresa.sigla} · {empresa.cnpj}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {openSelector && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenSelector(false)} />
            <div className="absolute left-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-fade-in">
              <div className="border-b border-border bg-muted/40 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selecione a empresa</p>
              </div>
              <ul className="max-h-72 overflow-y-auto py-1">
                {empresas.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => { setEmpresa(e); setOpenSelector(false); }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary",
                        empresa.id === e.id && "bg-primary-soft",
                      )}
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                        {e.sigla}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.nome}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{e.cnpj}</p>
                      </div>
                      {empresa.id === e.id && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Search global do módulo */}
      <div className="relative ml-2 hidden flex-1 max-w-xl md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Buscar em todos os módulos · editais, contratos, lançamentos, fornecedores…"
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-16 text-sm shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <IconBtn aria-label="Ajuda"><HelpCircle className="h-4 w-4" /></IconBtn>
        <IconBtn aria-label="Configurações"><Settings className="h-4 w-4" /></IconBtn>
        <IconBtn aria-label="Notificações">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </IconBtn>

        <div className="mx-1 h-8 w-px bg-border" />

        <button className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-secondary">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
            AC
          </div>
          <div className="hidden text-left lg:block">
            <p className="text-xs font-semibold leading-tight">Ana Carvalho</p>
            <p className="text-[10px] text-muted-foreground">Analista Corporativo · NEN</p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
        </button>

        <button
          onClick={() => { disableDemo(); navigate("/login"); }}
          className="ml-1 flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive-soft hover:text-destructive"
          aria-label="Sair"
          title="Sair da plataforma"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}

function IconBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}
