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
  ChevronRight,
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
  HardHat,
  Scale,
  UserCog,
  Briefcase as BriefcaseIcon,
  Home,
  ShoppingCart,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardCheck,
  DatabaseZap,
} from "lucide-react";
import { usePermissoes } from "@/context/PermissoesContext";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { Target } from "lucide-react";
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
  badge?: string;
  status: "active" | "soon";
  groups?: NavGroup[];
}

// Módulo Licitações — único navegável hoje
const licitacoesModule: ModuleDef = {
  id: "licitacoes",
  label: "Licitações",
  description: "Edital → Contrato",
  icon: Briefcase,
  basePath: "/app",
  badge: "32",
  status: "active",
  groups: [
    {
      label: "Visão Geral",
      defaultOpen: true,
      items: [
        { label: "Painel Executivo", to: "/app/painel-executivo", icon: LayoutDashboard },
        { label: "Presidência", to: "/app/presidencia", icon: LayoutDashboard },
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
      defaultOpen: true,
      items: [
        { label: "Parecer Técnico", to: "/app/parecer-tecnico", icon: FileCheck2 },
        { label: "Parecer SST", to: "/app/parecer-sst", icon: HardHat },
        { label: "Parecer Jurídico Adm.", to: "/app/parecer-juridico", icon: Scale },
        { label: "Parecer Controladoria", to: "/app/parecer-controladoria", icon: Calculator },
        { label: "Diretor Operacional", to: "/app/parecer-dir-operacional", icon: BriefcaseIcon },
        { label: "Diretor Administrativo", to: "/app/parecer-dir-administrativo", icon: UserCog },
        { label: "Parecer Gerencial (Consolidador)", to: "/app/parecer-gerencial", icon: FileCheck2 },
        { label: "Aprovações", to: "/app/aprovacoes", icon: CheckCircle2, badge: "7" },
      ],
    },
      {
        label: "Pregão & Encaminhamento",
        items: [
          { label: "Pregão & Lances", to: "/app/pregao", icon: Gavel },
          { label: "Resultado Final", to: "/app/resultado", icon: Trophy },
          { label: "Prontas p/ Contrato", to: "/app/prontas-contrato", icon: PackageCheck },
        ],
      },
    {
      label: "Contratos",
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

// Módulo Controladoria & Orçamento — ativo (catálogos + OBZ)
const controladoriaOrcModule: ModuleDef = {
  id: "controladoria_orc",
  label: "Controladoria & Orçamento",
  description: "Catálogos mestres, OBZ, baseline",
  icon: Calculator,
  basePath: "/app/co",
  status: "active",
  groups: [
    {
      label: "Cadastros Mestres",
      defaultOpen: true,
      items: [
        { label: "Empresas do Grupo", to: "/app/co/empresas", icon: Building2 },
        { label: "Centros de Custo", to: "/app/co/centros-custo", icon: FolderKanban },
        { label: "Estrutura Organizacional", to: "/app/co/estrutura-organizacional", icon: FolderKanban },
        { label: "Linhas da DRE", to: "/app/co/dre", icon: BookOpen },
        { label: "Classificadores & Drivers", to: "/app/co/classificadores", icon: ListChecks },
      ],
    },
    {
      label: "Orçamento",
      defaultOpen: true,
      items: [
        { label: "Ciclos de Orçamento", to: "/app/orcamento", icon: Calculator },
        { label: "Planejador OBZ (mock)", to: "/app/co/obz", icon: Calculator },
        { label: "OBZ — Versões", to: "/app/co/obz-versoes", icon: Calculator },
        { label: "DRE Gerencial", to: "/app/co/dre-gerencial", icon: TrendingUp },
      ],
    },
  ],
};

// Suprimentos
const suprimentosModule: ModuleDef = {
  id: "suprimentos", label: "Suprimentos", description: "Compras, estoque, requisições",
  icon: ShoppingCart, basePath: "/app/suprimentos", status: "active",
  groups: [
    {
      label: "Cadastros", defaultOpen: true,
      items: [
        { label: "Fornecedores", to: "/app/suprimentos/fornecedores", icon: Building2 },
        { label: "Catálogo de Produtos", to: "/app/suprimentos/produtos", icon: PackageCheck },
        { label: "Categorias", to: "/app/suprimentos/categorias", icon: FolderKanban },
        { label: "Almoxarifados", to: "/app/suprimentos/almoxarifados", icon: Home },
      ],
    },
    {
      label: "Estoque", defaultOpen: true,
      items: [
        { label: "Saldos & Alertas", to: "/app/suprimentos/estoque", icon: PackageCheck },
        { label: "Movimentações", to: "/app/suprimentos/movimentos", icon: History },
      ],
    },
    {
      label: "Compras", defaultOpen: true,
      items: [
        { label: "Requisições", to: "/app/suprimentos/requisicoes", icon: ListChecks },
        { label: "Cotações (RFQ)", to: "/app/suprimentos/cotacoes", icon: Calculator },
        { label: "Pedidos de Compra", to: "/app/suprimentos/pedidos", icon: ShoppingCart },
        { label: "NF de Entrada (XML/Manual)", to: "/app/suprimentos/nf-entrada", icon: FileText },
        { label: "Recebimento Físico", to: "/app/suprimentos/recebimentos", icon: ClipboardCheck },
        { label: "Aprovações (RC/PC)", to: "/app/suprimentos/aprovacoes", icon: CheckCircle2 },
      ],
    },
  ],
};

// Financeiro
const financeiroModule: ModuleDef = {
  id: "financeiro", label: "Financeiro", description: "Contas, movimentos bancários",
  icon: Wallet, basePath: "/app/financeiro", status: "active",
  groups: [{
    label: "Operação Financeira", defaultOpen: true,
    items: [
      { label: "Contas a Pagar", to: "/app/financeiro/contas-pagar", icon: TrendingUp },
      { label: "Programação de Pagamentos", to: "/app/financeiro/programacao-pagamentos", icon: Wallet },
      { label: "Validação Pós-Pagamento", to: "/app/financeiro/validacao-pos-pagamento", icon: Receipt },
      { label: "Contas a Receber", to: "/app/financeiro/contas-receber", icon: Receipt },
      { label: "Fluxo de Caixa", to: "/app/financeiro/fluxo-caixa", icon: TrendingUp },
      { label: "Fluxo de Caixa Diário", to: "/app/financeiro/fluxo-caixa-diario", icon: TrendingUp },
      { label: "Conciliação Fluxo Caixa", to: "/app/financeiro/conciliacao-fluxo-caixa", icon: Receipt },
      { label: "Análise de Capital de Giro", to: "/app/financeiro/capital-giro", icon: TrendingUp },
      { label: "Movimentos Bancários", to: "/app/financeiro/movimentos", icon: Wallet },
      { label: "Integração Bancária", to: "/app/financeiro/integracao-bancaria", icon: Wallet },
    ],
  }],
};

// Contábil
const contabilModule: ModuleDef = {
  id: "contabil", label: "Contábil", description: "Lançamentos e partidas",
  icon: BookOpen, basePath: "/app/contabil", status: "active",
  groups: [{
    label: "Escrituração", defaultOpen: true,
    items: [
      { label: "Lançamentos", to: "/app/contabil/lancamentos", icon: BookOpen },
      { label: "Balancete", to: "/app/contabil/balancete", icon: BookOpen },
      { label: "Razão", to: "/app/contabil/razao", icon: BookOpen },
      { label: "Plano de Contas", to: "/app/contabil/plano-contas", icon: BookOpen },
      { label: "Contabilidade Avançada", to: "/app/contabil/avancada", icon: BookOpen },
      { label: "Aprovação de Contas", to: "/app/contabil/aprovacao-contas", icon: ClipboardCheck },
      { label: "DRE Gerencial (real)", to: "/app/contabil/dre-gerencial-real", icon: BookOpen },
      { label: "Conciliação Eventos", to: "/app/contabil/conciliacao-eventos", icon: ClipboardCheck },
    ],
  }],
};

// Fiscal
const fiscalModule: ModuleDef = {
  id: "fiscal", label: "Fiscal & Tributário", description: "NFS-e, NF-e e apuração",
  icon: Receipt, basePath: "/app/fiscal", status: "active",
  groups: [{
    label: "Emissão & Apuração", defaultOpen: true,
    items: [
      { label: "Notas / Apuração / Config", to: "/app/fiscal", icon: Receipt },
    ],
  }],
};

// RH
const rhModule: ModuleDef = {
  id: "rh", label: "Recursos Humanos", description: "Colaboradores e alocações",
  icon: Users2, basePath: "/app/rh", status: "active",
  groups: [{
    label: "Pessoas", defaultOpen: true,
    items: [
      { label: "Colaboradores", to: "/app/rh/colaboradores", icon: Users2 },
      { label: "Alocações em Contratos", to: "/app/rh/alocacoes", icon: ListChecks },
    ],
  }],
};

// BI
const biModule: ModuleDef = {
  id: "bi", label: "BI & Analytics", description: "Dashboards consolidados",
  icon: BarChart3, basePath: "/app/bi", status: "active",
  groups: [{
    label: "Painéis", defaultOpen: true,
    items: [{ label: "Resumo do Grupo", to: "/app/bi", icon: BarChart3 }],
  }],
};

// Integração & Migração (somente admin)
const integracaoModule: ModuleDef = {
  id: "integracao", label: "Integração & Migração", description: "Lotes de planilhas → ERP",
  icon: DatabaseZap, basePath: "/app/integracao", status: "active",
  groups: [{
    label: "Cargas", defaultOpen: true,
    items: [
      { label: "Lotes de Integração", to: "/app/integracao", icon: DatabaseZap },
      { label: "Aliases (De/Para)", to: "/app/integracao/aliases", icon: ListChecks },
      { label: "Migração DO ZERO", to: "/app/admin/migracao-zero", icon: DatabaseZap },
    ],
  }],
};

function buildPlanoAcoesModule(podeCopiloto: boolean): ModuleDef {
  const items: NavItem[] = [
    { label: "Lista", to: "/app/plano-acoes", icon: ListChecks },
    { label: "Dashboard", to: "/app/plano-acoes/dashboard", icon: BarChart3 },
    { label: "Kanban", to: "/app/plano-acoes/kanban", icon: FolderKanban },
    { label: "Aprovações", to: "/app/plano-acoes/aprovacoes", icon: ClipboardCheck },
    { label: "Importar", to: "/app/plano-acoes/importar", icon: DatabaseZap },
    { label: "Configurações", to: "/app/plano-acoes/configuracoes", icon: Settings },
  ];
  if (podeCopiloto) {
    items.splice(1, 0, { label: "Copiloto IA", to: "/app/plano-acoes/copiloto", icon: Sparkles, badge: "IA" });
  }
  return {
    id: "plano-acoes", label: "Plano de Ações", description: "Gestão de ações e comitês",
    icon: Target, basePath: "/app/plano-acoes", status: "active",
    groups: [{ label: "Plano de Ações", defaultOpen: true, items }],
  };
}

const erpModules: ModuleDef[] = [
  licitacoesModule,
  controladoriaOrcModule,
  suprimentosModule,
  financeiroModule,
  fiscalModule,
  contabilModule,
  rhModule,
  biModule,
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { roles } = usePermissoes();
  const { perms, isAdmin } = usePlanoAcaoPermissao();
  const podeVerPlanoAcoes = isAdmin || perms.pode_visualizar;
  const podeCopiloto = roles.includes("admin") || roles.includes("presidencia");
  const visibleModules = [
    ...erpModules,
    ...(podeVerPlanoAcoes ? [buildPlanoAcoesModule(podeCopiloto)] : []),
    ...(roles.includes("admin") ? [integracaoModule] : []),
  ];
  // Determina qual módulo está ativo pela rota
  const activeModuleId = visibleModules.find(
    (m) => m.status === "active" && (location.pathname === m.basePath || location.pathname.startsWith(m.basePath))
  )?.id ?? "licitacoes";
  const [expandedModule, setExpandedModule] = useState<string | null>(activeModuleId);

  // No mobile a sidebar nunca aparece colapsada (sempre full); colapso é só desktop.
  const desktopCollapsed = collapsed;

  // Fecha drawer mobile ao clicar em um link de navegação
  const handleNavClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!onMobileClose) return;
    const target = e.target as HTMLElement;
    if (target.closest("a")) onMobileClose();
  };

  return (
    <aside
      onClick={handleNavClick}
      className={cn(
        // Mobile: drawer fixo off-canvas
        "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-out",
        "w-[268px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: sticky, sem transform, larguras originais
        "lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 lg:shadow-none lg:transition-all",
        desktopCollapsed ? "lg:w-[72px]" : "lg:w-[268px]",
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

      {/* Início global */}
      <div className="px-2 pt-3">
        <NavLink
          to="/app"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white",
              collapsed && "justify-center px-2",
            )
          }
        >
          <Home className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Início</span>}
        </NavLink>
      </div>

      {/* Section label */}
      {!collapsed && (
        <p className="mt-4 px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
          Módulos do ERP
        </p>
      )}

      <nav className="mt-2 flex-1 overflow-y-auto scroll-elegant px-2 py-1">
        {visibleModules.map((mod) => (
          <ModuleEntry
            key={mod.id}
            mod={mod}
            collapsed={collapsed}
            expanded={expandedModule === mod.id}
            onToggle={() => setExpandedModule((cur) => (cur === mod.id ? null : mod.id))}
          />
        ))}
      </nav>

      {/* Configurações + ambiente */}
      <div className="border-t border-sidebar-border p-2">
        <NavLink
          to="/app/administracao"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
              collapsed && "justify-center px-2",
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Configurações do ERP</span>}
        </NavLink>
        {!collapsed && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-sidebar-accent/40 px-2.5 py-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-soft" />
            <span className="text-[11px] font-medium text-sidebar-muted">Ambiente Produção</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function ModuleEntry({
  mod, collapsed, expanded, onToggle,
}: { mod: ModuleDef; collapsed: boolean; expanded: boolean; onToggle: () => void }) {
  const location = useLocation();
  const isActiveModule = mod.status === "active" && (location.pathname === mod.basePath || location.pathname.startsWith(mod.basePath));
  const Icon = mod.icon;
  const disabled = mod.status === "soon";

  return (
    <div className="mb-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
          isActiveModule
            ? "bg-sidebar-accent text-white"
            : disabled
              ? "text-sidebar-muted/70 cursor-not-allowed"
              : "text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-white",
          collapsed && "justify-center px-2",
        )}
        title={collapsed ? mod.label : undefined}
      >
        {isActiveModule && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />}
        <Icon className={cn("h-4 w-4 shrink-0", isActiveModule && "text-accent", disabled && "opacity-60")} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{mod.label}</span>
            {mod.badge && !disabled && (
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                {mod.badge}
              </span>
            )}
            {disabled && (
              <span className="rounded bg-sidebar-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sidebar-muted">
                Em breve
              </span>
            )}
            {!disabled && mod.groups && (
              <ChevronRight className={cn("h-3.5 w-3.5 text-sidebar-muted transition-transform", expanded && "rotate-90")} />
            )}
          </>
        )}
      </button>

      {/* Submódulos (apenas quando expandido, módulo ativo e sidebar não colapsada) */}
      {expanded && !collapsed && !disabled && mod.groups && (
        <div className="mt-1 ml-3 border-l border-sidebar-border/70 pl-2">
          {mod.groups.map((group) => (
            <SidebarGroup key={group.label} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarGroup({ group }: { group: NavGroup }) {
  const location = useLocation();
  const hasActive = group.items.some((i) => location.pathname === i.to || (i.to !== "/app" && location.pathname.startsWith(i.to)));
  const [open, setOpen] = useState(group.defaultOpen ?? hasActive ?? false);

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-0.5 flex w-full items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted hover:text-white"
      >
        <span>{group.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <ul className="space-y-0.5">
          {group.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/app"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />}
                    <item.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-accent" : "")} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
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
