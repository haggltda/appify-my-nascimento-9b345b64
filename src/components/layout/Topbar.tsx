import { Bell, Search, PanelLeft, ChevronDown, Building2, HelpCircle, Settings, LogOut, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/context/DemoModeContext";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/context/PermissoesContext";
import { supabase } from "@/integrations/supabase/client";

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { empresa, empresas, setEmpresa } = useEmpresaAtiva();
  const [openSelector, setOpenSelector] = useState(false);
  const navigate = useNavigate();
  const { disableDemo } = useDemoMode();
  const { user, signOut } = useAuth();
  const { roles } = usePermissoes();
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user?.id) { setDisplayName(""); return; }
    supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name || data?.email || user.email || ""));
  }, [user?.id, user?.email]);

  const nomeExibido = displayName || user?.email?.split("@")[0] || "Usuário";
  const iniciais = nomeExibido.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";
  const roleLabel = roles?.[0] ? roles[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Usuário";

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
            <p className="truncate text-xs font-semibold text-foreground">
              {empresa.sigla} · <span className="font-mono">{empresa.cnpj}</span>
            </p>
          </div>
          <span className="hidden rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary md:inline-block">
            {empresa.regime}
          </span>
          {empresa.validacaoDocumentalObrigatoria && (
            <span className="hidden items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning md:inline-flex" title="Validação documental obrigatória">
              <ShieldAlert className="h-3 w-3" />
              Validar
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {openSelector && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenSelector(false)} />
            <div className="absolute left-0 top-full z-20 mt-2 w-96 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-fade-in">
              <div className="border-b border-border bg-muted/40 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Empresas do Grupo Nascimento</p>
              </div>
              <ul className="max-h-96 overflow-y-auto py-1">
                {empresas.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => { setEmpresa(e.id); setOpenSelector(false); }}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary",
                        empresa.id === e.id && "bg-primary-soft",
                      )}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary text-[11px] font-bold">
                        {e.sigla}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.razao}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{e.cnpj}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {e.regime}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {e.papel}
                          </span>
                          {e.validacaoDocumentalObrigatoria && (
                            <span className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                              <ShieldAlert className="h-2.5 w-2.5" />
                              Validação documental
                            </span>
                          )}
                        </div>
                      </div>
                      {empresa.id === e.id && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
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

        <button className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-secondary" title={user?.email ?? ""}>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
            {iniciais}
          </div>
          <div className="hidden text-left lg:block">
            <p className="text-xs font-semibold leading-tight">{nomeExibido}</p>
            <p className="text-[10px] text-muted-foreground">{roleLabel} · {empresa.sigla}</p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
        </button>

        <button
          onClick={async () => { await signOut(); disableDemo(); navigate("/login"); }}
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
