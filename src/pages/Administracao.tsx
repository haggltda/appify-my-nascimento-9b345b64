import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Users, ShieldCheck, Key, GitBranch, Settings, Activity, AlertOctagon, Lock, Palette, Shield,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { UsuariosReal } from "@/components/admin/UsuariosReal";
import { PerfisTab } from "@/pages/admin/tabs/PerfisTab";
import { ModulosMenusTab } from "@/pages/admin/tabs/ModulosMenusTab";
import { PermissoesTab } from "@/pages/admin/tabs/PermissoesTab";
import { AlcadasTab } from "@/pages/admin/tabs/AlcadasTab";
import { ParametrosTab } from "@/pages/admin/tabs/ParametrosTab";
import { SessoesTab } from "@/pages/admin/tabs/SessoesTab";
import { LogsTab } from "@/pages/admin/tabs/LogsTab";
import { OcorrenciasTab } from "@/pages/admin/tabs/OcorrenciasTab";
import { AuditoriaTab } from "@/pages/admin/tabs/AuditoriaTab";
import { IdentidadeTab } from "@/pages/admin/tabs/IdentidadeTab";
import AcessosPermissoes from "@/pages/admin/AcessosPermissoes";

type Tab =
  | "usuarios" | "perfis" | "modulos" | "permissoes" | "acessos" | "alcadas" | "parametros"
  | "sessoes" | "logs" | "ocorrencias" | "auditoria" | "identidade";

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "perfis", label: "Perfis de acesso", icon: ShieldCheck },
  { id: "modulos", label: "Módulos & Menus", icon: GitBranch },
  { id: "permissoes", label: "Permissões por perfil", icon: Key },
  { id: "acessos", label: "Acessos & Permissões", icon: Shield },
  { id: "alcadas", label: "Alçadas de aprovação", icon: GitBranch },
  { id: "parametros", label: "Parâmetros gerais", icon: Settings },
  { id: "sessoes", label: "Sessões ativas", icon: Activity },
  { id: "logs", label: "Logs de acesso", icon: Lock },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertOctagon },
  { id: "auditoria", label: "Auditoria sensível", icon: ShieldCheck },
  { id: "identidade", label: "Identidade visual", icon: Palette },
];


export default function Administracao() {
  const [tab, setTab] = useState<Tab>("usuarios");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do ERP"
        breadcrumb={["Administração"]}
        subtitle="Governança, segurança e configuração institucional do ERP."
      />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav className="card-elevated p-2 self-start sticky top-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary",
              )}
            >
              <t.icon className="h-4 w-4" />
              <span className="flex-1">{t.label}</span>
              {tab === t.id && <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </nav>

        <div className="space-y-5">
          {tab === "usuarios" && <UsuariosReal />}
          {tab === "perfis" && <PerfisTab />}
          {tab === "modulos" && <ModulosMenusTab />}
          {tab === "permissoes" && <PermissoesTab />}
          {tab === "acessos" && <AcessosPermissoes />}
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
