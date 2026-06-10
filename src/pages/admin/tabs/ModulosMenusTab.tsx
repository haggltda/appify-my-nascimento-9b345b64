import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { usePermissoes } from "@/context/PermissoesContext";
import { Plus, Trash2, ChevronDown, ChevronRight, BookOpen, UserCog, X, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Modulo { id: string; codigo: string; nome: string; ordem: number; ativo: boolean; icone: string | null }
interface Menu { id: string; modulo_id: string; codigo: string; nome: string; rota: string | null; ordem: number; ativo: boolean }
interface ProfileRow { id: string; display_name: string | null; email: string | null }
interface ScreenPerm { menu_codigo: string; acao: string; allow: boolean }

type View = "catalogo" | "acesso";

export function ModulosMenusTab() {
  const qc = useQueryClient();
  const { roles } = usePermissoes();
  const isAdmin = roles.includes("admin");
  const [view, setView] = useState<View>("catalogo");
  const [showAddForm, setShowAddForm] = useState(false);

  const modulosQ = useQuery({
    queryKey: ["app_modulo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_modulo").select("*").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Modulo[];
    },
  });

  const menusQ = useQuery({
    queryKey: ["app_menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_menu").select("*").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Menu[];
    },
  });

  return (
    <section className="card-elevated">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex-1">
          <h2 className="font-display text-sm font-bold">Módulos & Menus</h2>
          <p className="text-xs text-muted-foreground">Catálogo do ERP e controle de acesso por usuário.</p>
        </div>

        {isAdmin && view === "catalogo" && (
          <Button
            size="sm"
            variant={showAddForm ? "secondary" : "default"}
            className="gap-1.5"
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAddForm ? "Cancelar" : "Adicionar módulo"}
          </Button>
        )}

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            onClick={() => { setView("catalogo"); setShowAddForm(false); }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "catalogo" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Catálogo
          </button>
          <button
            onClick={() => { setView("acesso"); setShowAddForm(false); }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "acesso" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UserCog className="h-3.5 w-3.5" />
            Acesso por Usuário
          </button>
        </div>
      </header>

      {view === "catalogo" && (
        <CatalogoView
          isAdmin={isAdmin}
          modulosQ={modulosQ}
          menusQ={menusQ}
          showAddForm={showAddForm}
          onAddFormClose={() => setShowAddForm(false)}
          onModuloChange={() => { qc.invalidateQueries({ queryKey: ["app_modulo"] }); qc.invalidateQueries({ queryKey: ["app_menu"] }); }}
          onMenuChange={() => qc.invalidateQueries({ queryKey: ["app_menu"] })}
        />
      )}

      {view === "acesso" && (
        <UserAccessPanel
          isAdmin={isAdmin}
          modulos={modulosQ.data ?? []}
          menus={menusQ.data ?? []}
        />
      )}
    </section>
  );
}

// ─── View: Catálogo ────────────────────────────────────────────────────────────

function CatalogoView({ isAdmin, modulosQ, menusQ, showAddForm, onAddFormClose, onModuloChange, onMenuChange }: {
  isAdmin: boolean;
  modulosQ: any;
  menusQ: any;
  showAddForm: boolean;
  onAddFormClose: () => void;
  onModuloChange: () => void;
  onMenuChange: () => void;
}) {
  const [novoModulo, setNovoModulo] = useState({ codigo: "", nome: "", icone: "" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const addModulo = async () => {
    if (!novoModulo.codigo || !novoModulo.nome) { toast({ title: "Código e nome obrigatórios", variant: "destructive" }); return; }
    const { error } = await supabase.from("app_modulo").insert({
      codigo: novoModulo.codigo.trim().toLowerCase().replace(/\s+/g, "_"),
      nome: novoModulo.nome.trim(),
      icone: novoModulo.icone || null,
      ordem: ((modulosQ.data ?? []).length + 1) * 10,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovoModulo({ codigo: "", nome: "", icone: "" });
    onModuloChange();
    onAddFormClose();
    toast({ title: "Módulo criado" });
  };

  const removerModulo = async (id: string) => {
    if (!confirm("Excluir este módulo e todos os seus menus?")) return;
    const { error } = await supabase.from("app_modulo").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    onModuloChange();
  };

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  return (
    <>
      {isAdmin && showAddForm && (
        <div className="grid gap-2 border-b border-border bg-muted/30 px-5 py-3 sm:grid-cols-[1fr_1fr_180px_auto]">
          <Input placeholder="Código (ex: financeiro)" value={novoModulo.codigo} onChange={(e) => setNovoModulo({ ...novoModulo, codigo: e.target.value })} />
          <Input placeholder="Nome" value={novoModulo.nome} onChange={(e) => setNovoModulo({ ...novoModulo, nome: e.target.value })} />
          <Input placeholder="Ícone (opcional)" value={novoModulo.icone} onChange={(e) => setNovoModulo({ ...novoModulo, icone: e.target.value })} />
          <Button onClick={addModulo} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Salvar módulo</Button>
        </div>
      )}
      <div className="divide-y divide-border">
        {modulosQ.isLoading && <p className="px-5 py-6 text-center text-sm text-muted-foreground">Carregando…</p>}
        {(modulosQ.data ?? []).map((m: Modulo) => {
          const menus = (menusQ.data ?? []).filter((x: Menu) => x.modulo_id === m.id);
          const open = expanded.has(m.id);
          return (
            <div key={m.id}>
              <div className="flex items-center gap-2 px-5 py-3 hover:bg-muted/40">
                <button onClick={() => toggleExpand(m.id)} className="text-muted-foreground">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.nome}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{m.codigo} · ordem {m.ordem} · {menus.length} menu(s)</p>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => removerModulo(m.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
              {open && (
                <MenusEditor moduloId={m.id} menus={menus} isAdmin={isAdmin} onChange={onMenuChange} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function MenusEditor({ moduloId, menus, isAdmin, onChange }: { moduloId: string; menus: Menu[]; isAdmin: boolean; onChange: () => void }) {
  const [novo, setNovo] = useState({ codigo: "", nome: "", rota: "" });

  const add = async () => {
    if (!novo.codigo || !novo.nome) return;
    const { error } = await supabase.from("app_menu").insert({
      modulo_id: moduloId,
      codigo: novo.codigo.trim().toLowerCase().replace(/\s+/g, "_"),
      nome: novo.nome.trim(),
      rota: novo.rota || null,
      ordem: (menus.length + 1) * 10,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovo({ codigo: "", nome: "", rota: "" });
    onChange();
  };
  const remover = async (id: string) => {
    const { error } = await supabase.from("app_menu").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    onChange();
  };

  return (
    <div className="bg-muted/20 px-12 py-3">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {menus.map((mn) => (
            <tr key={mn.id}>
              <td className="py-2 text-sm">{mn.nome}</td>
              <td className="py-2 text-[11px] font-mono text-muted-foreground">{mn.codigo}</td>
              <td className="py-2 text-[11px] font-mono text-muted-foreground">{mn.rota ?? "—"}</td>
              <td className="py-2 text-right">
                {isAdmin && <Button size="sm" variant="ghost" onClick={() => remover(mn.id)}><Trash2 className="h-3 w-3" /></Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input placeholder="código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="rota (opcional)" value={novo.rota} onChange={(e) => setNovo({ ...novo, rota: e.target.value })} className="h-8 text-xs" />
          <Button size="sm" onClick={add} className="h-8 gap-1"><Plus className="h-3 w-3" /> Menu</Button>
        </div>
      )}
    </div>
  );
}

// ─── View: Acesso por Usuário ──────────────────────────────────────────────────

function UserAccessPanel({ isAdmin, modulos, menus }: { isAdmin: boolean; modulos: Modulo[]; menus: Menu[] }) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const profilesQ = useQuery({
    queryKey: ["profiles-access-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,email")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const permsQ = useQuery({
    queryKey: ["screen_permission_user", selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screen_permission_user")
        .select("menu_codigo,acao,allow")
        .eq("user_id", selectedUserId)
        .eq("acao", "visualizar");
      if (error) throw error;
      return (data ?? []) as ScreenPerm[];
    },
  });

  const hasAccess = (codigo: string) => {
    return (permsQ.data ?? []).some((p) => p.menu_codigo === codigo && p.allow === true);
  };

  const toggleAccess = async (codigo: string, currentValue: boolean) => {
    if (!selectedUserId || !isAdmin) return;
    setSaving((s) => new Set(s).add(codigo));
    try {
      if (!currentValue) {
        const { error } = await supabase.from("screen_permission_user").upsert(
          { user_id: selectedUserId, menu_codigo: codigo, acao: "visualizar", allow: true, empresa_id: null },
          { onConflict: "user_id,menu_codigo,acao" }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("screen_permission_user")
          .delete()
          .eq("user_id", selectedUserId)
          .eq("menu_codigo", codigo)
          .eq("acao", "visualizar");
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["screen_permission_user", selectedUserId] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar permissão", description: e.message, variant: "destructive" });
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(codigo); return n; });
    }
  };

  const toggleAllMenus = async (modMenus: Menu[], allHaveAccess: boolean) => {
    if (!selectedUserId || !isAdmin) return;
    const codigos = modMenus.map((mn) => mn.codigo);
    codigos.forEach((c) => setSaving((s) => new Set(s).add(c)));
    try {
      if (!allHaveAccess) {
        const rows = codigos.map((codigo) => ({
          user_id: selectedUserId,
          menu_codigo: codigo,
          acao: "visualizar" as const,
          allow: true,
          empresa_id: null,
        }));
        const { error } = await supabase.from("screen_permission_user").upsert(rows, { onConflict: "user_id,menu_codigo,acao" });
        if (error) throw error;
      } else {
        await Promise.all(
          codigos.map((codigo) =>
            supabase
              .from("screen_permission_user")
              .delete()
              .eq("user_id", selectedUserId)
              .eq("menu_codigo", codigo)
              .eq("acao", "visualizar")
          )
        );
      }
      qc.invalidateQueries({ queryKey: ["screen_permission_user", selectedUserId] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar permissões", description: e.message, variant: "destructive" });
    } finally {
      codigos.forEach((c) => setSaving((s) => { const n = new Set(s); n.delete(c); return n; }));
    }
  };

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  return (
    <div>
      <div className="border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Selecionar usuário</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Escolha um usuário…" />
            </SelectTrigger>
            <SelectContent>
              {(profilesQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || p.email || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Apenas administradores podem alterar permissões.</p>
          )}
        </div>
      </div>

      {!selectedUserId && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Selecione um usuário acima para ver e configurar seus acessos.
        </p>
      )}

      {selectedUserId && permsQ.isLoading && (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">Carregando permissões…</p>
      )}

      {selectedUserId && !permsQ.isLoading && (
        <div className="divide-y divide-border">
          {modulos.map((m) => {
            const modMenus = menus.filter((x) => x.modulo_id === m.id);
            const open = expanded.has(m.id);
            const moduloAccess = hasAccess(m.codigo);
            const moduloSaving = saving.has(m.codigo);
            const liberados = modMenus.filter((mn) => hasAccess(mn.codigo)).length;
            const allHaveAccess = modMenus.length > 0 && liberados === modMenus.length;
            const anyMenuSaving = modMenus.some((mn) => saving.has(mn.codigo));

            return (
              <div key={m.id}>
                <div className="flex items-center gap-2 px-5 py-3 hover:bg-muted/40">
                  {modMenus.length > 0 ? (
                    <button onClick={() => toggleExpand(m.id)} className="text-muted-foreground">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.nome}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{m.codigo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {modMenus.length === 0 && (
                      <Switch
                        checked={moduloAccess}
                        disabled={!isAdmin || moduloSaving}
                        onCheckedChange={() => toggleAccess(m.codigo, moduloAccess)}
                        aria-label={`Acesso ao módulo ${m.nome}`}
                      />
                    )}
                    {modMenus.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {liberados}/{modMenus.length} menus liberados
                      </span>
                    )}
                  </div>
                </div>

                {open && modMenus.length > 0 && (
                  <div className="bg-muted/20 divide-y divide-border/60">
                    {isAdmin && (
                      <div className="flex items-center justify-end px-12 py-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          disabled={anyMenuSaving}
                          onClick={() => toggleAllMenus(modMenus, allHaveAccess)}
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          {allHaveAccess ? "Remover todos" : "Selecionar todos"}
                        </Button>
                      </div>
                    )}
                    {modMenus.map((mn) => {
                      const menuAccess = hasAccess(mn.codigo);
                      const menuSaving = saving.has(mn.codigo);
                      return (
                        <div key={mn.id} className="flex items-center gap-2 px-12 py-2.5 hover:bg-muted/40">
                          <div className="flex-1">
                            <p className="text-sm">{mn.nome}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{mn.codigo}{mn.rota ? ` · ${mn.rota}` : ""}</p>
                          </div>
                          <Switch
                            checked={menuAccess}
                            disabled={!isAdmin || menuSaving}
                            onCheckedChange={() => toggleAccess(mn.codigo, menuAccess)}
                            aria-label={`Acesso ao menu ${mn.nome}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
