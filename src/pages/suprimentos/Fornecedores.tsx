import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { FornecedorDialog } from "./fornecedores/FornecedorDialog";

export default function Fornecedores() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewOnly, setViewOnly] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fornecedor", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedor")
        .select("*")
        .order("razao_social", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedor").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedor"] });
      toast.success("Fornecedor removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores PJ/PF da empresa, incluindo contas bancárias para pagamento."
        actions={
          <Button onClick={() => { setEditing(null); setViewOnly(false); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} registro(s)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum fornecedor. Clique em <Badge variant="outline">Novo</Badge> para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.razao_social}
                      {r.is_global && <span className="ml-2 inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Global</span>}
                    </TableCell>
                    <TableCell>{r.cnpj_cpf}</TableCell>
                    <TableCell>{r.tipo === "pj" ? "PJ" : "PF"}</TableCell>
                    <TableCell>{r.contato ?? "—"}</TableCell>
                    <TableCell>{r.ativo ? "✓ Ativo" : "Inativo"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este fornecedor?")) remove.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FornecedorDialog
        open={open}
        onOpenChange={setOpen}
        fornecedor={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["fornecedor"] })}
      />
    </div>
  );
}
