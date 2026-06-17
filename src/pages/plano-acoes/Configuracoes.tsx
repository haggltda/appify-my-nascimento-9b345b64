import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { ForbiddenCard } from "./Lista";
import { useToast } from "@/hooks/use-toast";
import { PERMISSOES_FLAGS } from "@/types/planoAcao";

export default function PlanoAcoesConfiguracoes({ bypassGuard }: { bypassGuard?: boolean } = {}) {
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;
  const { can, loading } = usePlanoAcaoPermissao();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const reload = async () => {
    if (!empresaId) return;
    const [perms, profs] = await Promise.all([
      supabase.from("plano_acao_usuario_permissao").select("*").eq("empresa_id", empresaId),
      supabase.from("profiles").select("id,display_name,email").eq("empresa_id", empresaId).eq("ativo", true).order("display_name"),
    ]);
    setRows(perms.data ?? []);
    setProfiles(profs.data ?? []);
  };
  useEffect(() => { reload(); }, [empresaId]);

  if (loading) return null;
  if (!bypassGuard && !can("administrar")) return <ForbiddenCard />;

  const togglePerm = async (profile_id: string, flag: string, value: boolean) => {
    if (!empresaId) return;
    const existente = rows.find(r => r.profile_id === profile_id);
    const updates: any = { [`pode_${flag}`]: value };
    if (existente) {
      const { error } = await supabase.from("plano_acao_usuario_permissao").update(updates).eq("id", existente.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const baseRow: any = { empresa_id: empresaId, profile_id };
      PERMISSOES_FLAGS.forEach(p => baseRow[`pode_${p}`] = false);
      baseRow[`pode_${flag}`] = value;
      const { error } = await supabase.from("plano_acao_usuario_permissao").insert(baseRow);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Configurações — Plano de Ações"
        subtitle="ACL específica do módulo (8 permissões por usuário)"
        module="Plano de Ações"
        breadcrumb={["Configurações"]}
        actions={<Button asChild variant="outline" size="sm"><Link to="/app/plano-acoes">← Lista</Link></Button>}
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="p-2 px-3">Usuário</th>
              {PERMISSOES_FLAGS.map(p => <th key={p} className="p-2 text-center">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => {
              const r = rows.find(x => x.profile_id === p.id);
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2 px-3">
                    <div className="font-medium">{p.display_name ?? "(sem nome)"}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </td>
                  {PERMISSOES_FLAGS.map(f => {
                    const checked = r ? !!r[`pode_${f}`] : false;
                    return (
                      <td key={f} className="p-2 text-center">
                        <Checkbox checked={checked} onCheckedChange={v => togglePerm(p.id, f, !!v)} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {profiles.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum usuário ativo na empresa.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Administradores globais têm acesso total automaticamente. As permissões aqui aplicam-se a usuários sem role <code>admin</code>.
      </p>
    </div>
  );
}
