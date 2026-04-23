import { NavLink, useLocation } from "react-router-dom";
import logoGN from "@/assets/logo-grupo-nascimento.png";
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
  FolderKanban,
  Wallet,
  Users2,
  CalendarRange,
  Ruler,
  TrendingUp,
  PackageCheck,
  Receipt,
  ListChecks,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem { label: string; to: string; icon: any; badge?: string }
interface NavGroup { label: string; items: NavItem[]; defaultOpen?: boolean }
interface ModuleDef {
  id: string;
  label: string;
  description: string;
  icon: any;
  basePath: string;
  groups: NavGroup[];
}

// Módulo MESTRE: Licitações (futuramente: Controladoria, Contábil, Financeiro, etc.)
const licitacoesModule: ModuleDef = {
  id: "licitacoes",
  label: "Licitações",
  description: "Ciclo completo · Edital → Contrato",
  icon: Briefcase,
  basePath: "/app",
  groups: [
    {
      label: "Visão Geral",
      defaultOpen: true,
      items: [
        { label: "Painel Executivo", to: "/app", icon: LayoutDashboard },
        { label: "Pipeline", to: "/app/pipeline", icon: FolderKanban, badge: "32" },
      ],
    },
    {
      label: "Operação",
      defaultOpen: true,
      items: [
        { label: "Cadastro de Editais", to: "/app/editais", icon: FileText },
        { label: "Documentos", to: "/app/documentos", icon: ScrollText },
        { label: "Triagem & IA", to: "/app/triagem", icon: Sparkles },
        { label: "Composição & BDI", to: "/app/composicao", icon: PieChart },
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
        { label: "Prontas p/ Contrato", to: "/app/prontas-contrato", icon: PackageCheck },
      ],
    },
    {
      label: "Contratos",
      defaultOpen: true,
      items: [
        { label: "Implantação", to: "/app/contratos/implantacao", icon: ListChecks },
        { label: "Contratos Ativos", to: "/app/contratos/ativos", icon: Building2, badge: "18" },
        { label: "Empenhos", to: "/app/contratos/empenhos", icon: Wallet },
        { label: "Postos & Alocações", to: "/app/contratos/postos", icon: Users2 },
        { label: "Cronograma de Faturamento", to: "/app/contratos/faturamento", icon: CalendarRange },
        { label: "Medições", to: "/app/contratos/medicoes", icon: Ruler },
        { label: "Reajustes (IGPM/IPCA)", to: "/app/contratos/reajustes", icon: TrendingUp },
        { label: "Encerramentos", to: "/app/contratos/encerramentos", icon: Receipt },
      ],
    },
    {
      label: "Governança",
      items: [
        { label: "Histórico & Auditoria", to: "/app/historico", icon: History },
        { label: "Administração", to: "/app/administracao", icon: Shield },
      ],
    },
  ],
};

// Outros módulos do ERP (placeholders — futuras releases)
const otherModules = [
  { id: "controladoria", label: "Controladoria", icon: Calculator, status: "Em breve" },
  { id: "contabil", label: "Contábil", icon: ScrollText, status: "Em breve" },
  { id: "financeiro", label: "Financeiro", icon: Wallet, status: "Em breve" },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const [moduleSwitcherOpen, setModuleSwitcherOpen] = useState(false);
  const activeModule = licitacoesModule;

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[268px]",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <img src={logoGN} alt="Grupo Nascimento" className="h-9 w-9 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight text-white">Grupo Nascimento</p>
            <p className="text-[11px] uppercase tracking-wider text-sidebar-muted">ERP Corporativo</p>
          </div>
        )}
      </div>

      {/* Module switcher */}
      {!collapsed && (
        <div className="mx-3 mt-4">
          <button
            onClick={() => setModuleSwitcherOpen((o) => !o)}
            className="group flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="grid h-8 w-8 place-items-center rounded-md bg-accent/20 text-accent">
              <activeModule.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">Módulo ativo</p>
              <p className="font-display text-sm font-semibold leading-tight text-white truncate">{activeModule.label}</p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-sidebar-muted transition-transform", moduleSwitcherOpen && "rotate-180")} />
          </button>

          {moduleSwitcherOpen && (
            <div className="mt-2 overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-accent/40">
              <div className="border-b border-sidebar-border px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">Outros módulos</p>
              </div>
              {otherModules.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-sidebar-muted opacity-70"
                >
                  <m.icon className="h-3.5 w-3.5" />
                  <span className="flex-1">{m.label}</span>
                  <span className="rounded bg-sidebar-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="mt-3 flex-1 overflow-y-auto scroll-elegant px-2 py-2">
        {activeModule.groups.map((group) => (
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
  const hasActive = group.items.some((i) => location.pathname === i.to || (i.to !== "/app" && location.pathname.startsWith(i.to)));
  const [open, setOpen] = useState(group.defaultOpen ?? hasActive ?? false);

  return (
    <div className="mb-2">
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
    </div>
  );
}
