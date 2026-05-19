import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Shield, User } from "lucide-react";

type AppAcao = "visualizar" | "incluir" | "alterar" | "excluir" | "aprovar" | "exportar" | "executar_ia" | "alterar_dre";
const ACOES: AppAcao[] = ["visualizar", "incluir", "alterar", "excluir", "aprovar", "exportar"];

interface MenuItem { codigo: string; nome: string; modulo_id: string | null; ordem: number; }
interface ModuloItem { id: string; nome: string; }
interface ProfilePerm { role: string; menu_codigo: string; acao: AppAcao; allow: boolean; }
interface UserPerm { id?: string; user_id: string; menu_codigo: string; acao: AppAcao; allow: boolean; empresa_id: string | null; }
interface UserOpt { id: string; nome: string; }

export default function AcessosPermissoes() {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Acessos & Permissões</h1>
        <p className="text-muted-foreground text-sm">Configure permissões por perfil ou override por pessoa. Precedência: pessoa &gt; perfil.</p>
      </div>
      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil"><Shield className="h-4 w-4 mr-1" /> Por Perfil</TabsTrigger>
          <TabsTrigger value="pessoa"><User className="h-4 w-4 mr-1" /> Por Pessoa</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil"><PorPerfil /></TabsContent>
        <TabsContent value="pessoa"><PorPessoa /></TabsContent>
      </Tabs>
    </div>
  );
}

function useMenusModulos() {
  return useQuery({
    queryKey: ["acessos-menus"],
    queryFn: async () => {
      const [{ data: menus }, { data: modulos }] = await Promise.all([
        supabase.from("app_menu").select("codigo, nome, modulo_id, ordem").eq("ativo", true).order("ordem"),
        supabase.from("app_modulo").select("id, nome").order("ordem"),
      ]);
      return { menus: (menus ?? []) as MenuItem[], modulos: (modulos ?? []) as ModuloItem[] };
    },
  });
}

function useRoles() {
  return useQuery({
    queryKey: ["perfil-metadata"],
    queryFn: async () => {
      const { data } = await supabase.from("perfil_metadata").select("role, descricao").order("role");
      return (data ?? []).map((r: any) => ({ perfil: r.role as string, label: (r.descricao || r.role) as string }));
    },
  });
}

function PorPerfil() {
  const qc = useQueryClient();
  const { data: meta } = useMenusModulos();
  const { data: roles } = useRoles();
  const [filtroModulo, setFiltroModulo] = useState<string>("all");
  const [filtroRole, setFiltroRole] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { if (roles?.length && !filtroRole) setFiltroRole(roles[0].perfil); }, [roles, filtroRole]);

  const { data: perms } = useQuery({
    queryKey: ["screen_permission_profile", filtroRole],
    enabled: !!filtroRole,
    queryFn: async () => {
      const { data } = await supabase.from("screen_permission_profile").select("*").eq("role", filtroRole as any);
      return (data ?? []) as ProfilePerm[];
    },
  });

  const menusFiltrados = useMemo(() => {
    let m = meta?.menus ?? [];
    if (filtroModulo !== "all") m = m.filter((x) => x.modulo_id === filtroModulo);
    if (busca.trim()) m = m.filter((x) => x.nome.toLowerCase().includes(busca.toLowerCase()) || x.codigo.toLowerCase().includes(busca.toLowerCase()));
    return m;
  }, [meta, filtroModulo, busca]);

  const isAllowed = (menu: string, acao: AppAcao) => perms?.find((p) => p.menu_codigo === menu && p.acao === acao)?.allow ?? false;

  const toggle = async (menu: string, acao: AppAcao, allow: boolean) => {
    if (!filtroRole) return;
    const key = `${menu}-${acao}`;
    setSaving(key);
    try {
      const existing = perms?.find((p) => p.menu_codigo === menu && p.acao === acao);
      if (existing) {
        const { error } = await supabase.from("screen_permission_profile").update({ allow }).eq("role", filtroRole as any).eq("menu_codigo", menu).eq("acao", acao);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("screen_permission_profile").insert({ role: filtroRole as any, menu_codigo: menu, acao, allow });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["screen_permission_profile", filtroRole] });
      qc.invalidateQueries({ queryKey: ["screen-access"] });
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setSaving(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Permissões por Perfil</CardTitle>
        <div className="flex gap-2 flex-wrap mt-2">
          <Select value={filtroRole} onValueChange={setFiltroRole}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>{roles?.map((r) => <SelectItem key={r.perfil} value={r.perfil}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filtroModulo} onValueChange={setFiltroModulo}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {meta?.modulos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Buscar tela..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-64" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-muted/40 z-10">Tela</th>
                {ACOES.map((a) => <th key={a} className="p-2 text-center capitalize">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {menusFiltrados.map((m) => (
                <tr key={m.codigo} className="border-t hover:bg-muted/20">
                  <td className="p-2 sticky left-0 bg-background"><div className="font-medium">{m.nome}</div><div className="text-xs text-muted-foreground">{m.codigo}</div></td>
                  {ACOES.map((a) => {
                    const key = `${m.codigo}-${a}`;
                    return (
                      <td key={a} className="p-2 text-center">
                        {saving === key ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> :
                          <Switch checked={isAllowed(m.codigo, a)} onCheckedChange={(v) => toggle(m.codigo, a, v)} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {menusFiltrados.length === 0 && <tr><td colSpan={ACOES.length + 1} className="p-6 text-center text-muted-foreground">Nenhuma tela.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PorPessoa() {
  const qc = useQueryClient();
  const { data: meta } = useMenusModulos();
  const [userId, setUserId] = useState<string>("");
  const [filtroModulo, setFiltroModulo] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ["acessos-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email").order("display_name");
      return (data ?? []).map((u: any) => ({ id: u.id, nome: u.display_name || u.email || u.id })) as UserOpt[];
    },
  });

  const { data: userPerms } = useQuery({
    queryKey: ["screen_permission_user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("screen_permission_user").select("*").eq("user_id", userId).is("empresa_id", null);
      return (data ?? []) as UserPerm[];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user_roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((r: any) => r.role) as string[];
    },
  });

  const { data: profilePerms } = useQuery({
    queryKey: ["screen_permission_profile_for_roles", userRoles?.join(",")],
    enabled: !!userRoles?.length,
    queryFn: async () => {
      const { data } = await supabase.from("screen_permission_profile").select("*").in("role", userRoles as any[]).eq("allow", true);
      return (data ?? []) as ProfilePerm[];
    },
  });

  const menusFiltrados = useMemo(() => {
    let m = meta?.menus ?? [];
    if (filtroModulo !== "all") m = m.filter((x) => x.modulo_id === filtroModulo);
    if (busca.trim()) m = m.filter((x) => x.nome.toLowerCase().includes(busca.toLowerCase()) || x.codigo.toLowerCase().includes(busca.toLowerCase()));
    return m;
  }, [meta, filtroModulo, busca]);

  const inheritedAllow = (menu: string, acao: AppAcao) => !!profilePerms?.find((p) => p.menu_codigo === menu && p.acao === acao);
  const overrideRec = (menu: string, acao: AppAcao) => userPerms?.find((p) => p.menu_codigo === menu && p.acao === acao);

  const setOverride = async (menu: string, acao: AppAcao, allow: boolean | null) => {
    if (!userId) return;
    const key = `${menu}-${acao}`;
    setSaving(key);
    try {
      const existing = overrideRec(menu, acao);
      if (allow === null && existing) {
        const { error } = await supabase.from("screen_permission_user").delete().eq("id", existing.id!);
        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase.from("screen_permission_user").update({ allow: allow! }).eq("id", existing.id!);
        if (error) throw error;
      } else if (allow !== null) {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("screen_permission_user").insert({ user_id: userId, menu_codigo: menu, acao, allow, empresa_id: null, created_by: u.user?.id });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["screen_permission_user", userId] });
      qc.invalidateQueries({ queryKey: ["screen-access"] });
    } catch (e: any) { toast.error("Erro: " + e.message); }
    finally { setSaving(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overrides por Pessoa</CardTitle>
        <div className="flex gap-2 flex-wrap mt-2">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
            <SelectContent>{users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filtroModulo} onValueChange={setFiltroModulo}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {meta?.modulos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Buscar tela..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-64" />
        </div>
        {userId && (
          <div className="text-xs text-muted-foreground mt-2">
            Perfis do usuário: {userRoles?.length ? userRoles.map((r) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>) : "—"}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!userId ? <div className="p-6 text-center text-muted-foreground">Selecione um usuário.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/40">Tela</th>
                  {ACOES.map((a) => <th key={a} className="p-2 text-center capitalize">{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {menusFiltrados.map((m) => (
                  <tr key={m.codigo} className="border-t hover:bg-muted/20">
                    <td className="p-2 sticky left-0 bg-background"><div className="font-medium">{m.nome}</div><div className="text-xs text-muted-foreground">{m.codigo}</div></td>
                    {ACOES.map((a) => {
                      const inh = inheritedAllow(m.codigo, a);
                      const ov = overrideRec(m.codigo, a);
                      const value: "inherit" | "allow" | "deny" = ov ? (ov.allow ? "allow" : "deny") : "inherit";
                      const key = `${m.codigo}-${a}`;
                      return (
                        <td key={a} className="p-2 text-center">
                          {saving === key ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
                            <Select value={value} onValueChange={(v) => setOverride(m.codigo, a, v === "inherit" ? null : v === "allow")}>
                              <SelectTrigger className="h-8 w-32 mx-auto text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inherit">Herdar ({inh ? "✓" : "✗"})</SelectItem>
                                <SelectItem value="allow">Permitir</SelectItem>
                                <SelectItem value="deny">Negar</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
