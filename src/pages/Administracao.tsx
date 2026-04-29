import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import logoGN from "@/assets/logo-grupo-nascimento.png";
import {
  Users, ShieldCheck, Key, GitBranch, Settings, Activity, AlertOctagon, Lock, Palette,
  Plus, Search, MoreVertical, CheckCircle2, XCircle, Eye, Edit, Building2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UsuariosReal } from "@/components/admin/UsuariosReal";

type Tab =
  | "usuarios" | "perfis" | "modulos" | "permissoes" | "alcadas" | "parametros"
  | "sessoes" | "logs" | "ocorrencias" | "auditoria" | "identidade";

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "perfis", label: "Perfis de acesso", icon: ShieldCheck },
  { id: "modulos", label: "Módulos & Menus", icon: GitBranch },
  { id: "permissoes", label: "Permissões por perfil", icon: Key },
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
        title="Administração"
        breadcrumb={["Administração"]}
        subtitle="Governança, segurança e configuração institucional do módulo de Licitações."
      />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav className="card-elevated p-2">
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
          {tab === "usuarios" && <Usuarios />}
          {tab === "perfis" && <Perfis />}
          {tab === "modulos" && <ModulosMenus />}
          {tab === "permissoes" && <Permissoes />}
          {tab === "alcadas" && <Alcadas />}
          {tab === "parametros" && <Parametros />}
          {tab === "sessoes" && <Sessoes />}
          {tab === "logs" && <Logs />}
          {tab === "ocorrencias" && <Ocorrencias />}
          {tab === "auditoria" && <Auditoria />}
          {tab === "identidade" && <Identidade />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- USUÁRIOS ------------------------------- */
function Usuarios() {
  const users = [
    { n: "Ana Carvalho", e: "ana.carvalho@gn.com.br", p: "Analista de Licitações", emp: "NEN", s: "ativo", l: "há 3 min" },
    { n: "Marcos Pinto", e: "marcos.pinto@gn.com.br", p: "Analista de Licitações", emp: "NSV", s: "ativo", l: "há 12 min" },
    { n: "Renata Lima", e: "renata.lima@gn.com.br", p: "Gerente de Licitação", emp: "NEN", s: "ativo", l: "há 1 h" },
    { n: "Eduardo Vargas", e: "eduardo.v@gn.com.br", p: "Controladoria", emp: "Todas", s: "ativo", l: "ontem" },
    { n: "Sandra Müller", e: "sandra.m@gn.com.br", p: "Diretoria Administrativa", emp: "Todas", s: "ativo", l: "há 2 h" },
    { n: "Carlos Mendes", e: "carlos.m@gn.com.br", p: "Analista de Licitações", emp: "NSV", s: "bloqueado", l: "—" },
  ];
  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-bold">Gestão de usuários</h2>
          <p className="text-xs text-muted-foreground">42 usuários · 4 empresas · 9 perfis</p>
        </div>
        <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
          <Plus className="h-3.5 w-3.5" /> Novo usuário
        </button>
      </header>
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Buscar usuário, e-mail, perfil…"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left">Usuário</th>
            <th className="px-3 py-3 text-left">Perfil</th>
            <th className="px-3 py-3 text-left">Escopo</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-3 py-3 text-left">Último acesso</th>
            <th className="px-5 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => (
            <tr key={u.e} className="hover:bg-muted/40">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                    {u.n.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.n}</p>
                    <p className="text-[11px] text-muted-foreground">{u.e}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-xs">{u.p}</td>
              <td className="px-3 py-3"><span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{u.emp}</span></td>
              <td className="px-3 py-3">
                {u.s === "ativo"
                  ? <span className="chip border border-success/30 bg-success-soft text-success"><CheckCircle2 className="h-3 w-3" /> Ativo</span>
                  : <span className="chip border border-destructive/30 bg-destructive-soft text-destructive"><XCircle className="h-3 w-3" /> Bloqueado</span>}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{u.l}</td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-1">
                  <IconBtn><Eye className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn><Edit className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn><MoreVertical className="h-3.5 w-3.5" /></IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ------------------------------- PERFIS ------------------------------- */
function Perfis() {
  const perfis = [
    { n: "Analista de Licitações", u: 18, d: "Cadastro, parecer técnico, execução de IA" },
    { n: "Gerente de Licitação", u: 5, d: "Endosso de pareceres, gestão de equipe" },
    { n: "Controladoria", u: 3, d: "Revisão de margem, tributos, alçada" },
    { n: "Diretoria Administrativa", u: 2, d: "Aprovação de processos sensíveis" },
    { n: "Presidência", u: 1, d: "Exceções de risco e processos críticos" },
    { n: "Auditor", u: 2, d: "Acesso somente leitura à trilha completa" },
  ];
  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="font-display text-sm font-bold">Perfis de acesso</h2>
        <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
          <Plus className="h-3.5 w-3.5" /> Novo perfil
        </button>
      </header>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {perfis.map((p) => (
          <div key={p.n} className="card-elevated p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-sm font-bold">{p.n}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.d}</p>
              </div>
              <span className="chip border border-border bg-muted">{p.u} usuários</span>
            </div>
            <button className="mt-3 text-xs font-medium text-primary hover:underline">Configurar permissões →</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- MÓDULOS & MENUS ----------------------------- */
function ModulosMenus() {
  type Item = { id: string; modulo: string; menu: string; acao: string };
  const [items, setItems] = useState<Item[]>([
    { id: "1", modulo: "Licitações", menu: "Pipeline", acao: "Visualizar" },
    { id: "2", modulo: "Licitações", menu: "Cadastro de Editais", acao: "Incluir" },
    { id: "3", modulo: "Licitações", menu: "Cadastro de Editais", acao: "Alterar" },
    { id: "4", modulo: "Controladoria & Orçamento", menu: "Planejador OBZ", acao: "Aprovar" },
    { id: "5", modulo: "Controladoria & Orçamento", menu: "Centros de Custo", acao: "Excluir" },
  ]);
  const [draft, setDraft] = useState({ modulo: "", menu: "", acao: "Visualizar" });

  const add = () => {
    if (!draft.modulo.trim() || !draft.menu.trim()) return;
    setItems((s) => [...s, { id: crypto.randomUUID(), ...draft }]);
    setDraft({ modulo: "", menu: "", acao: "Visualizar" });
  };
  const remove = (id: string) => setItems((s) => s.filter((i) => i.id !== id));

  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-bold">Módulos, Menus & Ações</h2>
          <p className="text-xs text-muted-foreground">CRUD de itens de menu e ações disponíveis no sistema.</p>
        </div>
      </header>
      <div className="grid gap-2 border-b border-border bg-muted/30 px-5 py-3 sm:grid-cols-[1fr_1fr_180px_auto]">
        <input
          placeholder="Módulo (ex: Licitações)"
          value={draft.modulo}
          onChange={(e) => setDraft((d) => ({ ...d, modulo: e.target.value }))}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        />
        <input
          placeholder="Menu / Submenu"
          value={draft.menu}
          onChange={(e) => setDraft((d) => ({ ...d, menu: e.target.value }))}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        />
        <select
          value={draft.acao}
          onChange={(e) => setDraft((d) => ({ ...d, acao: e.target.value }))}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        >
          {["Visualizar", "Incluir", "Alterar", "Excluir", "Aprovar", "Exportar", "Executar IA"].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button
          onClick={add}
          data-write
          className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left">Módulo</th>
            <th className="px-3 py-3 text-left">Menu</th>
            <th className="px-3 py-3 text-left">Ação</th>
            <th className="px-5 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((it) => (
            <tr key={it.id} className="hover:bg-muted/40">
              <td className="px-5 py-2.5 font-medium">{it.modulo}</td>
              <td className="px-3 py-2.5">{it.menu}</td>
              <td className="px-3 py-2.5">
                <span className="chip border border-border bg-muted">{it.acao}</span>
              </td>
              <td className="px-5 py-2.5 text-right">
                <button
                  onClick={() => remove(it.id)}
                  data-write
                  className="text-xs font-medium text-destructive hover:underline"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ----------------------------- PERMISSÕES POR PERFIL ----------------------------- */
function Permissoes() {
  const acoes = ["Visualizar", "Incluir", "Alterar", "Excluir", "Aprovar", "Exportar", "Executar IA"];
  const submodulos = [
    "Pipeline", "Cadastro de Editais", "Documentos", "Triagem & IA",
    "Composição & BDI", "Parecer Técnico", "Parecer SST", "Parecer Jurídico",
    "Parecer Controladoria", "Aprovações", "Pregão", "Resultado",
    "Contratos Ativos", "Empenhos", "Medições",
    "Empresas", "Centros de Custo", "Linhas DRE", "Planejador OBZ",
  ];
  const perfis = ["Admin", "Controladoria", "Comercial", "Operacional", "Jurídico", "SST", "Diretor Adm.", "Diretor Op.", "Visitante"];
  const [perfil, setPerfil] = useState(perfis[1]);
  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-bold">Matriz de permissões por perfil</h2>
          <p className="text-xs text-muted-foreground">Perfil ativo: <strong className="text-foreground">{perfil}</strong></p>
        </div>
        <select
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-xs"
        >
          {perfis.map((p) => <option key={p}>{p}</option>)}
        </select>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Submódulo</th>
              {acoes.map((a) => <th key={a} className="px-2 py-3 text-center">{a}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {submodulos.map((sm, i) => (
              <tr key={sm} className="hover:bg-muted/40">
                <td className="px-5 py-3 text-sm font-medium">{sm}</td>
                {acoes.map((a) => {
                  const checked = perfil === "Admin" ? true : (i + a.length) % 3 !== 0;
                  return (
                    <td key={a} className="px-2 py-3 text-center">
                      <input type="checkbox" defaultChecked={checked} className="h-4 w-4 rounded border-border accent-primary" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3 text-xs">
        <p className="text-muted-foreground">Filtrado por escopo: <strong className="text-foreground">Empresa</strong>, <strong className="text-foreground">Contrato</strong>, <strong className="text-foreground">Centro de Custo</strong></p>
        <button data-write className="btn-relief inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Salvar matriz</button>
      </div>
    </section>
  );
}

/* ------------------------------ ALÇADAS ------------------------------ */
function Alcadas() {
  return (
    <section className="card-elevated p-5">
      <h2 className="font-display text-sm font-bold">Alçadas de aprovação</h2>
      <p className="mt-1 text-xs text-muted-foreground">Configuração de faixas e responsáveis por etapa.</p>
      <table className="mt-4 w-full text-sm">
        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Etapa</th>
            <th className="px-3 py-2 text-left">Responsável</th>
            <th className="px-3 py-2 text-right">Faixa de valor</th>
            <th className="px-3 py-2 text-left">Exceções</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[
            { e: "Gerente", r: "Renata Lima", f: "até R$ 5 M", x: "—" },
            { e: "Controladoria", r: "Eduardo Vargas", f: "todos", x: "Margem < 10%" },
            { e: "Diretoria", r: "Sandra Müller", f: "R$ 5 M – R$ 30 M", x: "Tributos especiais" },
            { e: "Presidência", r: "C. Nascimento", f: "acima de R$ 30 M", x: "Risco crítico" },
          ].map((r) => (
            <tr key={r.e}>
              <td className="px-3 py-3 font-medium">{r.e}</td>
              <td className="px-3 py-3">{r.r}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{r.f}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{r.x}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ----------------------------- PARÂMETROS ----------------------------- */
function Parametros() {
  return (
    <section className="card-elevated p-5 space-y-5">
      <h2 className="font-display text-sm font-bold">Parâmetros gerais do módulo</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Param label="Margem mínima institucional" value="14%" />
        <Param label="Garantia padrão exigida" value="5%" />
        <Param label="Tempo de retenção da trilha" value="10 anos" />
        <Param label="Idioma padrão" value="Português (BR)" />
        <Param label="Fuso horário" value="America/Sao_Paulo" />
        <Param label="Política de senha" value="12+ caracteres, MFA obrigatório" />
      </div>
    </section>
  );
}
function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-sm font-bold">{value}</p>
    </div>
  );
}

/* ------------------------------ SESSÕES ------------------------------ */
function Sessoes() {
  return (
    <section className="card-elevated">
      <header className="border-b border-border px-5 py-3.5">
        <h2 className="font-display text-sm font-bold">Sessões ativas <span className="ml-2 chip border border-success/30 bg-success-soft text-success">14 online</span></h2>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left">Usuário</th>
            <th className="px-3 py-3 text-left">IP</th>
            <th className="px-3 py-3 text-left">Dispositivo</th>
            <th className="px-3 py-3 text-left">Início</th>
            <th className="px-5 py-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[
            { u: "Ana Carvalho", ip: "201.55.12.4", d: "Chrome · macOS", t: "08:32" },
            { u: "Marcos Pinto", ip: "187.34.9.110", d: "Firefox · Windows 11", t: "09:14" },
            { u: "Renata Lima", ip: "201.55.12.18", d: "Edge · Windows 11", t: "09:20" },
            { u: "Eduardo Vargas", ip: "189.12.45.7", d: "Safari · iPad", t: "09:42" },
          ].map((s) => (
            <tr key={s.u} className="hover:bg-muted/40">
              <td className="px-5 py-3 text-sm font-medium">{s.u}</td>
              <td className="px-3 py-3 font-mono text-xs">{s.ip}</td>
              <td className="px-3 py-3 text-xs">{s.d}</td>
              <td className="px-3 py-3 text-xs">{s.t}</td>
              <td className="px-5 py-3 text-right">
                <button className="text-xs font-medium text-destructive hover:underline">Encerrar sessão</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------- LOGS -------------------------------- */
function Logs() {
  return (
    <section className="card-elevated">
      <header className="border-b border-border px-5 py-3.5">
        <h2 className="font-display text-sm font-bold">Logs de acesso</h2>
      </header>
      <ul className="divide-y divide-border">
        {[
          { d: "Hoje 10:42", u: "Ana Carvalho", e: "Login bem-sucedido", ip: "201.55.12.4", t: "success" },
          { d: "Hoje 09:18", u: "Carlos Mendes", e: "Tentativa falhou (senha incorreta — 3ª)", ip: "189.45.22.7", t: "warning" },
          { d: "Hoje 09:19", u: "Carlos Mendes", e: "Conta bloqueada automaticamente", ip: "189.45.22.7", t: "destructive" },
          { d: "Ontem 18:55", u: "Renata Lima", e: "Logout", ip: "201.55.12.18", t: "info" },
        ].map((l, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className={`h-2 w-2 rounded-full bg-${l.t}`} />
            <span className="w-32 text-xs text-muted-foreground">{l.d}</span>
            <span className="font-medium">{l.u}</span>
            <span className="flex-1 text-xs text-muted-foreground">{l.e}</span>
            <span className="font-mono text-xs">{l.ip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------- OCORRÊNCIAS ---------------------------- */
function Ocorrencias() {
  return (
    <section className="card-elevated p-5">
      <h2 className="font-display text-sm font-bold">Ocorrências de operação</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {[
          { t: "Tentativa de acesso fora do horário corporativo", u: "Carlos Mendes", h: "23:42", tone: "warning" },
          { t: "Exportação massiva de dados de licitação", u: "Marcos Pinto", h: "16:08", tone: "info" },
          { t: "Edição em campo crítico após aprovação", u: "Renata Lima", h: "14:51", tone: "destructive" },
        ].map((o, i) => (
          <li key={i} className={`flex items-center gap-3 rounded-md border border-${o.tone}/30 bg-${o.tone}-soft px-3 py-2.5`}>
            <AlertOctagon className={`h-4 w-4 text-${o.tone}`} />
            <span className="flex-1 text-sm font-medium">{o.t}</span>
            <span className="text-xs text-muted-foreground">{o.u} · {o.h}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------- AUDITORIA ----------------------------- */
function Auditoria() {
  return (
    <section className="card-elevated p-5">
      <h2 className="font-display text-sm font-bold">Auditoria de ações sensíveis</h2>
      <p className="mt-1 text-xs text-muted-foreground">Registros imutáveis das alterações em campos protegidos (margem, tributos, alçadas, valor).</p>
      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-xs">
        <p className="font-mono text-[11px] text-muted-foreground">2025-04-22T14:30:12Z</p>
        <p className="mt-1"><strong>Eduardo Vargas</strong> alterou campo <code className="rounded bg-muted px-1">margem_alvo</code> de <code className="rounded bg-destructive-soft px-1 text-destructive">14.0%</code> para <code className="rounded bg-success-soft px-1 text-success">12.8%</code> em PE 044/2025. Justificativa: "Reajuste anual mitiga risco".</p>
      </div>
    </section>
  );
}

/* ---------------------------- IDENTIDADE ---------------------------- */
function Identidade() {
  return (
    <section className="card-elevated p-5 space-y-5">
      <h2 className="font-display text-sm font-bold">Identidade visual institucional</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logotipo</p>
          <div className="mt-3 flex items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-8">
            <img src={logoGN} alt="Grupo Nascimento" className="h-12 w-12 object-contain" />
            <div className="ml-3">
              <p className="font-display font-bold">Grupo Nascimento</p>
              <p className="text-xs text-muted-foreground">ERP Corporativo</p>
            </div>
          </div>
          <button className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary">Atualizar logotipo</button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome empresarial</p>
            <input defaultValue="Grupo Nascimento" className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subtítulo institucional</p>
            <input defaultValue="ERP Corporativo · Multi-CNPJ" className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cor primária</p>
            <div className="mt-2 flex gap-2">
              <button className="h-8 w-8 rounded-md ring-2 ring-offset-2" style={{ background: "hsl(218 78% 22%)" }} />
              <button className="h-8 w-8 rounded-md" style={{ background: "hsl(22 95% 54%)" }} />
              <button className="h-8 w-8 rounded-md" style={{ background: "hsl(152 60% 36%)" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">{children}</button>
  );
}
