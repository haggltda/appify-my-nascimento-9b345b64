import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { usePermissoes } from "@/context/PermissoesContext";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];
type Acao = Database["public"]["Enums"]["app_acao"];

const ACOES: Acao[] = ["visualizar", "incluir", "alterar", "excluir", "aprovar", "exportar", "executar_ia"];

export function PermissoesTab() {
  const qc = useQueryClient();
  const { roles: myRoles } = usePermissoes();
  const isAdmin = myRoles.includes("admin");

  const perfisQ = useQuery({
    queryKey: ["perfil_metadata"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfil_metadata").select("role").order("role");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role as Role);
    },
  });

  const modulosQ = useQuery({
    queryKey: ["app_modulo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_modulo").select("codigo,nome").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [perfil, setPerfil] = useState<Role>("controladoria");

  const permsQ = useQuery({
    queryKey: ["role_permissions", perfil],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("modulo,acao")
        .eq("role", perfil);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => `${r.modulo}::${r.acao}`));
    },
  });

  const [pending, setPending] = useState<Map<string, boolean>>(new Map());

  const isChecked = (key: string) => {
    if (pending.has(key)) return pending.get(key)!;
    return permsQ.data?.has(key) ?? false;
  };

  const toggle = (modulo: string, acao: Acao) => {
    if (!isAdmin) return;
    const key = `${modulo}::${acao}`;
    const cur = isChecked(key);
    const next = new Map(pending);
    next.set(key, !cur);
    setPending(next);
  };

  const salvar = async () => {
    if (pending.size === 0) return;
    const adds: { role: Role; modulo: string; acao: Acao }[] = [];
    const removes: { modulo: string; acao: Acao }[] = [];
    pending.forEach((novoValor, key) => {
      const [modulo, acao] = key.split("::") as [string, Acao];
      if (novoValor) adds.push({ role: perfil, modulo, acao });
      else removes.push({ modulo, acao });
    });
    try {
      if (adds.length > 0) {
        const { error } = await supabase.from("role_permissions").insert(adds);
        if (error) throw error;
      }
      for (const r of removes) {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", perfil)
          .eq("modulo", r.modulo)
          .eq("acao", r.acao);
        if (error) throw error;
      }
      toast({ title: "Permissões salvas", description: `${adds.length} adição(ões), ${removes.length} remoção(ões).` });
      setPending(new Map());
      qc.invalidateQueries({ queryKey: ["role_permissions", perfil] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <section className="card-elevated">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-display text-sm font-bold">Matriz de permissões por perfil</h2>
          <p className="text-xs text-muted-foreground">Perfil ativo: <strong className="capitalize">{perfil.replace(/_/g, " ")}</strong></p>
        </div>
        <Select value={perfil} onValueChange={(v) => { setPerfil(v as Role); setPending(new Map()); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(perfisQ.data ?? []).map((r) => (
              <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Módulo</th>
              {ACOES.map((a) => <th key={a} className="px-2 py-3 text-center capitalize">{a.replace("_", " ")}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(modulosQ.data ?? []).map((m: any) => (
              <tr key={m.codigo} className="hover:bg-muted/40">
                <td className="px-5 py-3 text-sm font-medium">{m.nome}</td>
                {ACOES.map((a) => {
                  const key = `${m.codigo}::${a}`;
                  return (
                    <td key={a} className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked(key)}
                        onChange={() => toggle(m.codigo, a)}
                        disabled={!isAdmin}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3 text-xs">
        <p className="text-muted-foreground">{pending.size} alteração(ões) pendente(s).</p>
        <Button size="sm" onClick={salvar} disabled={!isAdmin || pending.size === 0}>Salvar matriz</Button>
      </div>
    </section>
  );
}
