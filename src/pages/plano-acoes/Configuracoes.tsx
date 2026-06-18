import { useEffect, useState } from "react";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { ForbiddenCard } from "./Lista";
import { useToast } from "@/hooks/use-toast";
import { PERMISSOES_FLAGS } from "@/types/planoAcao";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileRow { id: string; display_name: string | null; email: string | null }

const PERM_LABEL: Record<string, string> = {
  visualizar:   "Visualizar",
  dashboard:    "Dashboard",
  criar:        "Criar",
  editar:       "Editar",
  excluir:      "Excluir",
  importar:     "Importar",
  aprovar:      "Aprovar",
  administrar:  "Administrar",
  ver_todas:    "Ver todas",
};

const PERM_DESC: Record<string, string> = {
  visualizar:  "Acessa a lista e detalhes dos planos de ação",
  dashboard:   "Acessa o dashboard e gráficos do módulo",
  criar:       "Cria novos planos de ação",
  editar:      "Edita planos existentes",
  excluir:     "Exclui logicamente planos de ação",
  importar:    "Importa planos via Excel / CSV",
  aprovar:     "Valida e conclui planos (revisão final)",
  administrar: "Configura as permissões deste módulo",
  ver_todas:   "Visualiza todos os planos sem restrição de visibilidade",
};

export default function PlanoAcoesConfiguracoes({ bypassGuard }: { bypassGuard?: boolean } = {}) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;
  const { can, loading } = usePlanoAcaoPermissao();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  // DB state: flag → boolean (current saved values for selected user)
  const [dbPerms, setDbPerms] = useState<Record<string, boolean>>({});
  // Staged (unsaved) changes: flag → new value
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase
      .from("profiles")
      .select("id,display_name,email")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("display_name")
      .then(({ data }) => setProfiles(data ?? []));
  }, [empresaId]);

  useEffect(() => {
    setPending(new Map());
    if (!selectedUserId || !empresaId) { setDbPerms({}); return; }
    setLoadingPerms(true);
    supabase
      .from("plano_acao_usuario_permissao")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("profile_id", selectedUserId)
      .maybeSingle()
      .then(({ data }) => {
        const row: Record<string, boolean> = {};
        PERMISSOES_FLAGS.forEach((f) => { row[f] = data ? !!data[`pode_${f}`] : false; });
        setDbPerms(row);
        setLoadingPerms(false);
      });
  }, [selectedUserId, empresaId]);

  if (loading) return null;
  if (!bypassGuard && !can("administrar")) return <ForbiddenCard />;

  const hasFlag = (flag: string): boolean =>
    pending.has(flag) ? pending.get(flag)! : (dbPerms[flag] ?? false);

  const stageChange = (flag: string, value: boolean) => {
    setPending((prev) => {
      const next = new Map(prev);
      if (value === (dbPerms[flag] ?? false)) { next.delete(flag); } else { next.set(flag, value); }
      return next;
    });
  };

  const stageAll = () => {
    const allOn = PERMISSOES_FLAGS.every((f) => hasFlag(f));
    const newValue = !allOn;
    setPending(() => {
      const next = new Map<string, boolean>();
      PERMISSOES_FLAGS.forEach((f) => {
        if (newValue !== (dbPerms[f] ?? false)) next.set(f, newValue);
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId || !empresaId || pending.size === 0) return;
    setIsSaving(true);
    try {
      const updates: Record<string, boolean> = { ...dbPerms };
      pending.forEach((v, k) => { updates[k] = v; });

      const { data: existing } = await supabase
        .from("plano_acao_usuario_permissao")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("profile_id", selectedUserId)
        .maybeSingle();

      const payload: any = { empresa_id: empresaId, profile_id: selectedUserId };
      PERMISSOES_FLAGS.forEach((f) => { payload[`pode_${f}`] = updates[f] ?? false; });

      if (existing) {
        const { error } = await supabase
          .from("plano_acao_usuario_permissao")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("plano_acao_usuario_permissao")
          .insert(payload);
        if (error) throw error;
      }

      setDbPerms(updates);
      setPending(new Map());
      toast({ title: "Permissões salvas com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const hasPending = pending.size > 0;
  const allOn = PERMISSOES_FLAGS.every((f) => hasFlag(f));

  return (
    <section className="card-elevated">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex-1">
          <h2 className="font-display text-sm font-bold">Plano de Ações — ACL</h2>
          <p className="text-xs text-muted-foreground">Permissões específicas do módulo por usuário (9 flags).</p>
        </div>
      </header>

      {/* Seletor de usuário + botão salvar */}
      <div className="border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Selecionar usuário</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Escolha um usuário…" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
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
        </div>
      </div>

      {!selectedUserId && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Selecione um usuário acima para ver e configurar suas permissões.
        </p>
      )}

      {selectedUserId && loadingPerms && (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">Carregando permissões…</p>
      )}

      {selectedUserId && !loadingPerms && (
        <div className="divide-y divide-border">
          {/* Selecionar todos */}
          <div className="flex items-center justify-end bg-muted/20 px-5 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={stageAll}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {allOn ? "Remover todos" : "Selecionar todos"}
            </Button>
          </div>

          {PERMISSOES_FLAGS.map((flag) => {
            const on = hasFlag(flag);
            const isPending = pending.has(flag);
            return (
              <div
                key={flag}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 hover:bg-muted/40",
                  isPending && "bg-amber-50/50 dark:bg-amber-950/20",
                )}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{PERM_LABEL[flag]}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    pode_{flag}{PERM_DESC[flag] ? ` · ${PERM_DESC[flag]}` : ""}
                  </p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => stageChange(flag, v)}
                  aria-label={`Permissão ${PERM_LABEL[flag]}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
