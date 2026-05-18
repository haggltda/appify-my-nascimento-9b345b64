import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes, type Role } from "@/context/PermissoesContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Pencil, ShieldCheck, Building2, UserPlus, Eye, EyeOff, KeyRound, Copy, AlertTriangle, Upload, Trash2 } from "lucide-react";

const ROLES: Role[] = ["admin","controladoria","comercial","operacional","juridico","sst","diretor_adm","diretor_op","usuario"];
const LINK_ACESSO = `${window.location.origin}/login`;

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  empresa_id: string | null;
  avatar_url: string | null;
}

export function UsuariosReal() {
  const { user } = useAuth();
  const { roles: myRoles } = usePermissoes();
  const podeEditar = (myRoles ?? []).includes("admin");
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const profilesQ = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,display_name,empresa_id,avatar_url")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const empresasQ = useQuery({
    queryKey: ["empresas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id,codigo,razao_social,nome_fantasia").order("razao_social");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, Role[]>();
    (rolesQ.data ?? []).forEach((r: any) => {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      m.set(r.user_id, arr);
    });
    return m;
  }, [rolesQ.data]);

  const empresasById = useMemo(() => {
    const m = new Map<string, { codigo: string; razao_social: string }>();
    (empresasQ.data ?? []).forEach((e: any) => m.set(e.id, e));
    return m;
  }, [empresasQ.data]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return profilesQ.data ?? [];
    return (profilesQ.data ?? []).filter((p) =>
      (p.display_name ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  }, [profilesQ.data, busca]);

  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-bold">Gestão de usuários</h2>
          <p className="text-xs text-muted-foreground">
            {(profilesQ.data ?? []).length} usuário(s) · {(empresasQ.data ?? []).length} empresa(s)
          </p>
        </div>
        {podeEditar && (
          <NovoUsuarioDialog
            empresas={empresasQ.data ?? []}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["admin-profiles"] });
              qc.invalidateQueries({ queryKey: ["all-user-roles"] });
            }}
          />
        )}
      </header>

      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left">Usuário</th>
            <th className="px-3 py-3 text-left">Perfis (roles)</th>
            <th className="px-3 py-3 text-left">Empresa</th>
            <th className="px-5 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {profilesQ.isLoading && (
            <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">Carregando…</td></tr>
          )}
          {!profilesQ.isLoading && filtrados.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">Nenhum usuário.</td></tr>
          )}
          {filtrados.map((u) => {
            const userRoles = rolesByUser.get(u.id) ?? [];
            const emp = u.empresa_id ? empresasById.get(u.empresa_id) : null;
            const ehVoce = u.id === user?.id;
            return (
              <tr key={u.id} className="hover:bg-muted/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                        {(u.display_name ?? u.email ?? "?").split(" ").map((s) => s[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {u.display_name ?? "—"} {ehVoce && <Badge variant="outline" className="ml-1 text-[10px]">você</Badge>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {userRoles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {userRoles.map((r) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px]">
                        {r === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
                        {r}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs">
                  {emp ? (
                    <span className="inline-flex items-center gap-1.5"><Building2 className="h-3 w-3 text-muted-foreground" />{emp.codigo} — {emp.razao_social}</span>
                  ) : <span className="text-muted-foreground">— sem vínculo —</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  {podeEditar ? (
                    <EditarUsuarioDialog
                      profile={u}
                      empresas={empresasQ.data ?? []}
                      currentRoles={userRoles}
                      onSaved={() => {
                        qc.invalidateQueries({ queryKey: ["admin-profiles"] });
                        qc.invalidateQueries({ queryKey: ["all-user-roles"] });
                      }}
                    />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">somente admin</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function EditarUsuarioDialog({
  profile, empresas, currentRoles, onSaved,
}: {
  profile: ProfileRow;
  empresas: { id: string; codigo: string; razao_social: string }[];
  currentRoles: Role[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [empresaId, setEmpresaId] = useState<string>(profile.empresa_id ?? "_none");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(currentRoles);
  const [saving, setSaving] = useState(false);

  const toggleRole = (r: Role) => {
    setSelectedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  const salvar = async () => {
    setSaving(true);
    try {
      // 1) profile
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          empresa_id: empresaId === "_none" ? null : empresaId,
        })
        .eq("id", profile.id);
      if (pErr) throw pErr;

      // 2) roles - apaga atuais e reinsere selecionadas
      const { error: dErr } = await supabase.from("user_roles").delete().eq("user_id", profile.id);
      if (dErr) throw dErr;
      if (selectedRoles.length > 0) {
        const { error: iErr } = await supabase
          .from("user_roles")
          .insert(selectedRoles.map((r) => ({ user_id: profile.id, role: r })));
        if (iErr) throw iErr;
      }

      toast({ title: "Usuário atualizado" });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5"><Pencil className="h-3.5 w-3.5" />Editar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{profile.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <AvatarUploadSection profile={profile} />

          <div>
            <Label>Nome de exibição</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Messias Souza" />
          </div>
          <div>
            <Label>Empresa vinculada</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Sem vínculo —</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Perfis (roles)</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selectedRoles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                  <span className="font-medium">{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <ResetSenhaSection userId={profile.id} email={profile.email ?? ""} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetSenhaSection({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(false);
  const [novaSenha, setNovaSenha] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const reset = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { user_id: userId },
      });
      if (error) {
        const ctx = (error as any).context;
        let msg = error.message;
        try { if (ctx && typeof ctx.json === "function") { const j = await ctx.json(); if (j?.error) msg = j.error; } } catch { /* */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setNovaSenha((data as any)?.password ?? null);
      setConfirmando(false);
      toast({ title: "Senha resetada", description: "Nova senha gerada. Compartilhe com o usuário." });
    } catch (e: any) {
      toast({ title: "Erro ao resetar senha", description: e?.message ?? "Falha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copiar = async (texto: string, msg: string) => {
    try { await navigator.clipboard.writeText(texto); toast({ title: msg }); } catch { /* */ }
  };

  const textoCompleto = novaSenha
    ? [
        "Acesso ao ERP Gestão Nascimento",
        `Link de acesso: ${LINK_ACESSO}`,
        `Login (e-mail): ${email}`,
        `Senha temporária: ${novaSenha}`,
        "",
        "Importante: no primeiro login o sistema solicitará a criação de uma nova senha pessoal.",
      ].join("\n")
    : "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold"><KeyRound className="h-3.5 w-3.5" /> Resetar senha do usuário</p>
          <p className="text-[11px] text-muted-foreground">Gera uma nova senha temporária. O usuário será obrigado a criar uma nova senha no próximo login.</p>
        </div>
        {!confirmando && !novaSenha && (
          <Button size="sm" variant="outline" onClick={() => setConfirmando(true)} disabled={loading}>Resetar</Button>
        )}
      </div>

      {confirmando && !novaSenha && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs">
          <p className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warning" /> Confirma resetar a senha de <strong>{email}</strong>? A senha atual deixará de funcionar.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
            <Button size="sm" onClick={reset} disabled={loading}>{loading ? "Resetando…" : "Confirmar reset"}</Button>
          </div>
        </div>
      )}

      {novaSenha && (
        <div className="rounded-md border border-success/40 bg-success-soft p-3 text-xs space-y-2">
          <p className="font-semibold text-foreground">Nova senha temporária</p>

          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Link de acesso</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 select-all rounded bg-background px-2 py-1.5 font-mono text-xs break-all">{LINK_ACESSO}</code>
              <Button size="sm" variant="outline" onClick={() => copiar(LINK_ACESSO, "Link copiado")} className="gap-1.5"><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Senha</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 select-all rounded bg-background px-2 py-1.5 font-mono text-sm">{novaSenha}</code>
              <Button size="sm" variant="outline" onClick={() => copiar(novaSenha, "Senha copiada")} className="gap-1.5"><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => copiar(textoCompleto, "Credenciais copiadas")}>
            <Copy className="h-3.5 w-3.5" /> Copiar tudo (link + e-mail + senha)
          </Button>

          <p className="leading-relaxed text-muted-foreground">
            <strong>Guarde estas informações em local seguro</strong> e repasse ao usuário por canal confiável.
            Esta senha <strong>não será exibida novamente</strong>. No próximo login, o ERP exigirá a definição de uma nova senha pessoal.
          </p>
        </div>
      )}
    </div>
  );
}

function NovoUsuarioDialog({
  empresas, onCreated,
}: {
  empresas: { id: string; codigo: string; razao_social: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("_none");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);

  // Credenciais geradas após criação (mostrado em modal flutuante)
  const [credenciaisCriadas, setCredenciaisCriadas] = useState<{
    email: string; password: string; display_name: string | null;
  } | null>(null);

  const reset = () => {
    setDisplayName(""); setEmail(""); setPassword("");
    setEmpresaId("_none"); setSelectedRoles([]); setShowPwd(false);
  };

  const toggleRole = (r: Role) => {
    setSelectedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  const gerarSenha = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setPassword(s);
    setShowPwd(true);
  };

  const criar = async () => {
    if (!email.trim()) {
      toast({ title: "E-mail obrigatório", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha deve ter ao menos 6 caracteres", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: email.trim(),
          password,
          display_name: displayName.trim() || null,
          empresa_id: empresaId === "_none" ? null : empresaId,
          roles: selectedRoles,
        },
      });
      if (error) {
        const ctx = (error as any).context;
        let msg = error.message;
        try {
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      // Mostra modal de credenciais e fecha o de criação
      setCredenciaisCriadas({
        email: email.trim(),
        password,
        display_name: displayName.trim() || null,
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (e: any) {
      const m = e?.message ?? "Falha ao criar usuário";
      toast({
        title: /already|registered|exists|duplic/i.test(m) ? "E-mail já cadastrado" : "Erro ao criar usuário",
        description: m,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Novo usuário
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Cria o acesso e vincula perfil(is) e empresa. Apenas administradores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Messias Souza" />
            </div>
            <div>
              <Label>E-mail corporativo *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" />
            </div>
            <div>
              <Label>Senha temporária *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={gerarSenha}>Gerar</Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                O usuário será obrigado a definir uma nova senha pessoal no primeiro login.
              </p>
            </div>
            <div>
              <Label>Empresa vinculada</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Sem vínculo —</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Perfis (roles)</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={selectedRoles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                    <span className="font-medium">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={criar} disabled={saving}>
              {saving ? "Criando…" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CredenciaisDialog
        creds={credenciaisCriadas}
        onClose={() => setCredenciaisCriadas(null)}
      />
    </>
  );
}

function CredenciaisDialog({
  creds, onClose,
}: {
  creds: { email: string; password: string; display_name: string | null } | null;
  onClose: () => void;
}) {
  const textoCompleto = creds
    ? [
        "Acesso ao ERP Gestão Nascimento",
        creds.display_name ? `Nome: ${creds.display_name}` : null,
        `Link de acesso: ${LINK_ACESSO}`,
        `Login (e-mail): ${creds.email}`,
        `Senha temporária: ${creds.password}`,
        "",
        "Importante: no primeiro login o sistema solicitará a criação de uma nova senha pessoal.",
      ].filter(Boolean).join("\n")
    : "";

  const copiar = async (texto: string, msg: string) => {
    try { await navigator.clipboard.writeText(texto); toast({ title: msg }); } catch { /* */ }
  };

  return (
    <Dialog open={!!creds} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" /> Usuário criado com sucesso
          </DialogTitle>
          <DialogDescription>
            Estas credenciais <strong>não serão exibidas novamente</strong>. Copie e repasse ao usuário por canal seguro.
          </DialogDescription>
        </DialogHeader>

        {creds && (
          <div className="space-y-3">
            {creds.display_name && (
              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">Nome</Label>
                <p className="text-sm font-medium">{creds.display_name}</p>
              </div>
            )}
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground">Link de acesso</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded bg-muted px-2 py-1.5 font-mono text-xs break-all">{LINK_ACESSO}</code>
                <Button size="sm" variant="outline" onClick={() => copiar(LINK_ACESSO, "Link copiado")} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground">Login (e-mail)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded bg-muted px-2 py-1.5 font-mono text-sm">{creds.email}</code>
                <Button size="sm" variant="outline" onClick={() => copiar(creds.email, "E-mail copiado")} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground">Senha temporária</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded bg-muted px-2 py-1.5 font-mono text-sm">{creds.password}</code>
                <Button size="sm" variant="outline" onClick={() => copiar(creds.password, "Senha copiada")} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  <strong>Guarde estas informações em um gerenciador de senhas</strong> antes de fechar.
                  Ao acessar com a senha temporária, o ERP exigirá a definição de uma nova senha pessoal.
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => copiar(textoCompleto, "Credenciais copiadas para a área de transferência")}
          >
            <Copy className="h-4 w-4" /> Copiar tudo
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvatarUploadSection({ profile }: { profile: ProfileRow }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const inputId = `avatar-input-${profile.id}`;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Tamanho máximo 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      if (updErr) throw updErr;
      toast({ title: "Foto atualizada" });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e?.message ?? "Falha", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remover = async () => {
    setUploading(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
      if (error) throw error;
      toast({ title: "Foto removida" });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const iniciais = (profile.display_name ?? profile.email ?? "?")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-3">
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-border" />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-primary text-base font-semibold text-primary-foreground ring-2 ring-border">
          {iniciais}
        </div>
      )}
      <div className="flex-1 space-y-1">
        <p className="text-xs font-semibold">Foto do perfil</p>
        <p className="text-[11px] text-muted-foreground">PNG ou JPG, até 5 MB.</p>
        <div className="mt-1 flex gap-2">
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Carregar foto"}
          </Button>
          {profile.avatar_url && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={remover} disabled={uploading}>
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

