import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { ContaBancariaDialog } from "./ContaBancariaDialog";

interface Props {
  fornecedorId: string;
  empresaId: string;
}

export function ContasBancariasTab({ fornecedorId, empresaId }: Props) {
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fornecedor_conta_bancaria")
      .select("*")
      .eq("fornecedor_id", fornecedorId)
      .order("principal", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setContas(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [fornecedorId]);

  const remove = async (id: string) => {
    if (!confirm("Remover esta conta?")) return;
    const { error } = await supabase.from("fornecedor_conta_bancaria").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conta removida");
    load();
  };

  const tornarPrincipal = async (id: string) => {
    const { error } = await supabase.from("fornecedor_conta_bancaria").update({ principal: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conta principal atualizada");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{contas.length} conta(s) cadastrada(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova conta
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : contas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>PIX</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.principal && <Star className="mr-1 inline h-3 w-3 fill-primary text-primary" />}
                  {c.banco_codigo} — {c.banco_nome}
                </TableCell>
                <TableCell>{c.agencia}{c.agencia_digito ? `-${c.agencia_digito}` : ""}</TableCell>
                <TableCell>{c.conta}{c.conta_digito ? `-${c.conta_digito}` : ""}</TableCell>
                <TableCell className="capitalize">{c.tipo}</TableCell>
                <TableCell className="text-xs">{c.pix_tipo ? `${c.pix_tipo}: ${c.pix_chave}` : "—"}</TableCell>
                <TableCell>
                  {c.ativa ? <Badge variant="secondary">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {!c.principal && (
                    <Button size="icon" variant="ghost" title="Definir como principal" onClick={() => tornarPrincipal(c.id)}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ContaBancariaDialog
        open={open}
        onOpenChange={setOpen}
        fornecedorId={fornecedorId}
        empresaId={empresaId}
        conta={editing}
        onSaved={load}
      />
    </div>
  );
}
