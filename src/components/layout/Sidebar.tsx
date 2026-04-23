import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Sparkles,
  ScrollText,
  Calculator,
  CheckCircle2,
  Gavel,
  Trophy,
  FileCheck2,
  History,
  Shield,
  ChevronDown,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem { label: string; to: string; icon: any; badge?: string }
interface NavGroup { label: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { label: "Painel Executivo", to: "/app", icon: LayoutDashboard },
      { label: "Pipeline", to: "/app/pipeline", icon: Briefcase, badge: "32" },
      { label: "Cadastro de Editais", to: "/app/editais", icon: FileText },
      { label: "Documentos", to: "/app/documentos", icon: ScrollText },
      { label: "Triagem & IA", to: "/app/triagem", icon: Sparkles },
    ],
  },
  {
    label: "Análise & Decisão",
    items: [
      { label: "Parecer Técnico", to: "/app/parecer-tecnico", icon: FileCheck2 },
      { label: "Parecer Gerencial", to: "/app/parecer-gerencial", icon: FileCheck2 },
      { label: "Controladoria", to: "/app/controladoria", icon: Calculator },
      { label: "Aprovações", to: "/app/aprovacoes", icon: CheckCircle2, badge: "7" },
    ],
  },
  {
    label: "Disputa & Resultado",
    items: [
      { label: "Pregão & Lances", to: "/app/pregao", icon: Gavel },
      { label: "Resultado", to: "/app/resultado", icon: Trophy },
      { label: "Prontas p/ Contrato", to: "/app/prontas-contrato", icon: Building2 },
      { label: "Histórico & Auditoria", to: "/app/historico", icon: History },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Administração", to: "/app/administracao", icon: Shield },
    ],
  },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <img
          src={(await import("@/assets/logo-grupo-nascimento.png")).default}
          alt="Grupo Nascimento"
          className="h-9 w-9 shrink-0 object-contain"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight text-white">Grupo Nascimento</p>
            <p className="text-[11px] uppercase tracking-wider text-sidebar-muted">ERP Corporativo</p>
          </div>
        )}
      </div>

      {/* Module pill */}
      {!collapsed && (
        <div className="mx-3 mt-4 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">Módulo ativo</p>
          <p className="font-display text-sm font-semibold text-white">Licitações</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto scroll-elegant px-2 py-4">
        {groups.map((group) => (
          <SidebarGroup key={group.label} group={group} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer ambiente */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/40 px-2.5 py-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-soft" />
            <span className="text-[11px] font-medium text-sidebar-muted">Ambiente Produção</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarGroup({ group, collapsed }: { group: NavGroup; collapsed: boolean }) {
  const location = useLocation();
  const hasActive = group.items.some((i) => location.pathname === i.to);
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-3">
      {!collapsed && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mb-1 flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted hover:text-white"
        >
          <span>{group.label}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
        </button>
      )}
      {(open || collapsed) && (
        <ul className="space-y-0.5">
          {group.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/app"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white",
                    collapsed && "justify-center px-2",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />}
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "")} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
      {!collapsed && hasActive && <div className="mt-2 mx-3 h-px bg-sidebar-border" />}
    </div>
  );
}
