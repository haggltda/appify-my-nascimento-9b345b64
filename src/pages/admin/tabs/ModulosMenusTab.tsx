import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { usePermissoes } from "@/context/PermissoesContext";
import { Plus, Trash2, ChevronDown, ChevronRight, BookOpen, UserCog, X, CheckSquare, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Modulo { id: string; codigo: string; nome: string; ordem: number; ativo: boolean; icone: string | null }
interface Menu { id: string; modulo_id: string; codigo: string; nome: string; rota: string | null; ordem: number; ativo: boolean }
interface ProfileRow { id: string; display_name: string | null; email: string | null }

// Remove acentos antes de virar slug — "Solicitações" → "solicitacoes", não "solicitações".
// Sem isso, o código salvo no banco diverge do que outras partes do sistema esperam
// (ex: comparações de menu_codigo) por causa de caracteres acentuados invisíveis na UI.
const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(text: string): string {
  return text
    .trim()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

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
      codigo: slugify(novoModulo.codigo),
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
    const rotaTrim = novo.rota.trim();
    // RouteGuard compara a rota com pathname exato (com barra inicial) — sem isso,
    // matchMenuCode nunca encontra a rota e o switch de permissão fica sem efeito.
    const rotaNormalizada = rotaTrim ? (rotaTrim.startsWith("/") ? rotaTrim : `/${rotaTrim}`) : null;
    const { error } = await supabase.from("app_menu").insert({
      modulo_id: moduloId,
      codigo: slugify(novo.codigo),
      nome: novo.nome.trim(),
      rota: rotaNormalizada,
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
  // Map of menu_codigo → desired allow value (staged, not yet saved)
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
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

  // Acesso efetivo real do usuário via RPC (combina role + overrides individuais).
  // É isso que deve ser exibido nos switches — não apenas os registros explícitos.
  const effectiveQ = useQuery({
    queryKey: ["effective-menus-for-user", selectedUserId],
    enabled: !!selectedUserId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_accessible_menus", {
        _user: selectedUserId as string,
        _acao: "visualizar",
        _empresa: null,
      });
      if (error) {
        console.warn("effective menus admin panel error", error);
        return new Set<string>();
      }
      return new Set<string>((data ?? []).map((r: any) => r.menu_codigo));
    },
  });

  // Clear pending changes when user is switched
  useEffect(() => { setPending(new Map()); }, [selectedUserId]);

  // Acesso efetivo atual (role + overrides). Base para os switches e para detectar mudança real.
  const dbHasAccess = (codigo: string) =>
    effectiveQ.data?.has(codigo) ?? false;

  // Show pending value if staged, otherwise DB value
  const hasAccess = (codigo: string) =>
    pending.has(codigo) ? pending.get(codigo)! : dbHasAccess(codigo);

  const stageChange = (codigo: string, newValue: boolean) => {
    setPending((prev) => {
      const next = new Map(prev);
      // If new value matches DB, no change needed — remove from pending
      if (newValue === dbHasAccess(codigo)) { next.delete(codigo); } else { next.set(codigo, newValue); }
      return next;
    });
  };

  const stageAll = (modMenus: Menu[], allHaveAccess: boolean) => {
    const newValue = !allHaveAccess;
    setPending((prev) => {
      const next = new Map(prev);
      modMenus.forEach((mn) => {
        if (newValue === dbHasAccess(mn.codigo)) { next.delete(mn.codigo); } else { next.set(mn.codigo, newValue); }
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId || !isAdmin || pending.size === 0) return;
    setIsSaving(true);
    try {
      for (const [codigo, allow] of pending) {
        const { error: delErr } = await supabase.from("screen_permission_user").delete()
          .eq("user_id", selectedUserId).eq("menu_codigo", codigo)
          .eq("acao", "visualizar").is("empresa_id", null);
        if (delErr) console.warn("delete perm error", delErr);

        const { error } = await supabase.from("screen_permission_user").insert({
          user_id: selectedUserId, menu_codigo: codigo, acao: "visualizar", allow, empresa_id: null,
        });
        if (error) throw error;
      }
      // refetchQueries aguarda o re-fetch completar antes de limpar pending,
      // evitando o flicker onde os switches voltam ao estado anterior por um instante.
      await qc.refetchQueries({ queryKey: ["effective-menus-for-user", selectedUserId] });
      await qc.invalidateQueries({ queryKey: ["accessible-menus"] });
      setPending(new Map());
      toast({ title: "Permissões salvas com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar permissões", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const hasPending = pending.size > 0;

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

          {hasPending && (
            <Button
              size="sm"
              className="ml-auto gap-1.5"
              disabled={isSaving}
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Salvando…" : `Salvar ${pending.size} alteraç${pending.size === 1 ? "ão" : "ões"}`}
            </Button>
          )}

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

      {selectedUserId && effectiveQ.isLoading && (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">Carregando permissões…</p>
      )}

      {selectedUserId && !effectiveQ.isLoading && (
        <div className="divide-y divide-border">
          {modulos.map((m) => {
            const modMenus = menus.filter((x) => x.modulo_id === m.id);
            const open = expanded.has(m.id);
            const moduloAccess = hasAccess(m.codigo);
            const liberados = modMenus.filter((mn) => hasAccess(mn.codigo)).length;
            const allHaveAccess = modMenus.length > 0 && liberados === modMenus.length;

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
                        disabled={!isAdmin}
                        onCheckedChange={() => stageChange(m.codigo, !moduloAccess)}
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
                          onClick={() => stageAll(modMenus, allHaveAccess)}
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          {allHaveAccess ? "Remover todos" : "Selecionar todos"}
                        </Button>
                      </div>
                    )}
                    {modMenus.map((mn) => {
                      const menuAccess = hasAccess(mn.codigo);
                      const isPending = pending.has(mn.codigo);
                      return (
                        <div key={mn.id} className={cn("flex items-center gap-2 px-12 py-2.5 hover:bg-muted/40", isPending && "bg-amber-50/50 dark:bg-amber-950/20")}>
                          <div className="flex-1">
                            <p className="text-sm">{mn.nome}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{mn.codigo}{mn.rota ? ` · ${mn.rota}` : ""}</p>
                          </div>
                          <Switch
                            checked={menuAccess}
                            disabled={!isAdmin}
                            onCheckedChange={() => stageChange(mn.codigo, !menuAccess)}
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
