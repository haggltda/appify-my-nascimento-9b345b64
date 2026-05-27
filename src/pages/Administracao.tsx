// Arquivo: src/pages/Administracao.tsx
// FASE 2 / FRONT-END
// Mantém telas legadas quando a feature flag está desligada.
// Quando ligada, mostra a tela única "Permissões unificadas".

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Users,
  ShieldCheck,
  Key,
  GitBranch,
  Settings,
  Activity,
  AlertOctagon,
  Lock,
  Palette,
  Shield,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { UsuariosReal } from "@/components/admin/UsuariosReal";
import { PerfisTab } from "@/pages/admin/tabs/PerfisTab";
import { ModulosMenusTab } from "@/pages/admin/tabs/ModulosMenusTab";
import { PermissoesTab } from "@/pages/admin/tabs/PermissoesTab";
import { PermissoesUnificadasTab } from "@/pages/admin/tabs/PermissoesUnificadasTab";
import { AlcadasTab } from "@/pages/admin/tabs/AlcadasTab";
import { ParametrosTab } from "@/pages/admin/tabs/ParametrosTab";
import { SessoesTab } from "@/pages/admin/tabs/SessoesTab";
import { LogsTab } from "@/pages/admin/tabs/LogsTab";
import { OcorrenciasTab } from "@/pages/admin/tabs/OcorrenciasTab";
import { AuditoriaTab } from "@/pages/admin/tabs/AuditoriaTab";
import { IdentidadeTab } from "@/pages/admin/tabs/IdentidadeTab";
import AcessosPermissoes from "@/pages/admin/AcessosPermissoes";
import PlanoAcoesConfiguracoes from "@/pages/plano-acoes/Configuracoes";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useFeatureFlag } from "@/lib/featureFlags";

type Tab =
  | "usuarios"
  | "perfis"
  | "modulos"
  | "permissoes"
  | "visibilidade"
  | "plano-acoes-acl"
  | "alcadas"
  | "parametros"
  | "sessoes"
  | "logs"
  | "ocorrencias"
  | "auditoria"
  | "identidade";

const legacyTabs: { id: Tab; label: string; icon: any }[] = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "perfis", label: "Perfis de acesso", icon: ShieldCheck },
  { id: "modulos", label: "Módulos & Menus", icon: GitBranch },
  { id: "permissoes", label: "Permissões (ações na tela)", icon: Key },
  { id: "visibilidade", label: "Visibilidade de menu", icon: Shield },
  { id: "plano-acoes-acl", label: "Plano de Ações (ACL)", icon: ShieldCheck },
  { id: "alcadas", label: "Alçadas de aprovação", icon: GitBranch },
  { id: "parametros", label: "Parâmetros gerais", icon: Settings },
  { id: "sessoes", label: "Sessões ativas", icon: Activity },
  { id: "logs", label: "Logs de acesso", icon: Lock },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertOctagon },
  { id: "auditoria", label: "Auditoria sensível", icon: ShieldCheck },
  { id: "identidade", label: "Identidade visual", icon: Palette },
];

const unifiedTabs: { id: Tab; label: string; icon: any }[] = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "perfis", label: "Perfis de acesso", icon: ShieldCheck },
  { id: "modulos", label: "Módulos & Menus", icon: GitBranch },
  { id: "permissoes", label: "Permissões unificadas", icon: Key },
  { id: "plano-acoes-acl", label: "Plano de Ações (ACL)", icon: ShieldCheck },
  { id: "alcadas", label: "Alçadas de aprovação", icon: GitBranch },
  { id: "parametros", label: "Parâmetros gerais", icon: Settings },
  { id: "sessoes", label: "Sessões ativas", icon: Activity },
  { id: "logs", label: "Logs de acesso", icon: Lock },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertOctagon },
  { id: "auditoria", label: "Auditoria sensível", icon: ShieldCheck },
  { id: "identidade", label: "Identidade visual", icon: Palette },
];

export default function Administracao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [unifiedPermissions, setUnifiedPermissions] = useFeatureFlag("unifiedPermissions", false);
  const tabs = useMemo(() => (unifiedPermissions ? unifiedTabs : legacyTabs), [unifiedPermissions]);

  const initial = (searchParams.get("tab") as Tab) || "usuarios";
  const normalizedInitial =
    unifiedPermissions && initial === "visibilidade" ? "permissoes" : initial;
  const [tab, setTab] = useState<Tab>(normalizedInitial);

  useEffect(() => {
    const q = searchParams.get("tab") as Tab | null;
    if (!q) return;
    const normalized = unifiedPermissions && q === "visibilidade" ? "permissoes" : q;
    if (normalized !== tab) setTab(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, unifiedPermissions]);

  useEffect(() => {
    if (unifiedPermissions && tab === "visibilidade") {
      setTab("permissoes");
      setSearchParams({ tab: "permissoes" }, { replace: true });
    }
  }, [setSearchParams, tab, unifiedPermissions]);

  const changeTab = (nextTab: Tab) => {
    const normalized =
      unifiedPermissions && nextTab === "visibilidade" ? "permissoes" : nextTab;
    setTab(normalized);
    setSearchParams({ tab: normalized }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do ERP"
        breadcrumb={["Administração"]}
        subtitle="Governança, segurança e configuração institucional do ERP."
      />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3 self-start sticky top-4">
          <div className="card-elevated p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold leading-tight">Nova gestão unificada</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Une menu, rota, ações e exceções.
                  </p>
                </div>
              </div>
              <Switch
                checked={unifiedPermissions}
                onCheckedChange={setUnifiedPermissions}
                aria-label="Ativar gestão unificada de permissões"
              />
            </div>
            <Badge variant={unifiedPermissions ? "default" : "secondary"} className="w-full justify-center">
              {unifiedPermissions ? "Ligada" : "Desligada"}
            </Badge>
          </div>

          <nav className="card-elevated p-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => changeTab(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                    tab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {tab === item.id && <ChevronRight className="h-4 w-4" />}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-5">
          {tab === "usuarios" && <UsuariosReal />}
          {tab === "perfis" && <PerfisTab />}
          {tab === "modulos" && <ModulosMenusTab />}
          {tab === "permissoes" &&
            (unifiedPermissions ? <PermissoesUnificadasTab /> : <PermissoesTab />)}
          {tab === "visibilidade" && !unifiedPermissions && <AcessosPermissoes />}
          {tab === "plano-acoes-acl" && <PlanoAcoesConfiguracoes />}
          {tab === "alcadas" && <AlcadasTab />}
          {tab === "parametros" && <ParametrosTab />}
          {tab === "sessoes" && <SessoesTab />}
          {tab === "logs" && <LogsTab />}
          {tab === "ocorrencias" && <OcorrenciasTab />}
          {tab === "auditoria" && <AuditoriaTab />}
          {tab === "identidade" && <IdentidadeTab />}
        </div>
      </div>
    </div>
  );
}
