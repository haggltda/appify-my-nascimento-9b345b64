import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, FileDown, Pencil, Plus, ShieldCheck, Sparkles, Trash2, User2 } from "lucide-react";
import { useList, useRemove } from "@/hooks/useGenericCrud";
import { ColaboradorForm, type Colaborador } from "./ColaboradorForm";
import { RelatorioColaboradoresDialog } from "./RelatorioColaboradoresDialog";
import { supabase } from "@/integrations/supabase/client";

const FOTO_BUCKET = "colaboradores-fotos";
const fmtBRL = (v: any) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString("pt-BR") : "—";

function FluxoIntegracaoAviso() {
  return (
    <Card className="mb-4 border-dashed bg-muted/30">
      <CardContent className="p-4">
        <p className="mb-2 text-sm font-semibold">Sem colaboradores ainda — como carregar?</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Cadastre manualmente em <Badge variant="outline">+ Novo</Badge> ou importe via planilha (3 etapas):
        </p>
        <ol className="grid gap-2 text-xs md:grid-cols-3">
          <li className="flex items-start gap-2 rounded border bg-background p-2">
            <Database className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">1. Materializar</p>
              <p className="text-muted-foreground">
                Envie a planilha em <Link className="underline" to="/app/integracao">Integração & Migração</Link> e clique em Materializar.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2 rounded border bg-background p-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">2. Aprovar</p>
              <p className="text-muted-foreground">Revise as validações e clique em Aprovar.</p>
            </div>
          </li>
          <li className="flex items-start gap-2 rounded border bg-background p-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">3. Promover ao ERP</p>
              <p className="text-muted-foreground">Os colaboradores aparecem aqui após a promoção.</p>
            </div>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}

export default function Colaboradores() {
  const { data: rows = [], isLoading, refetch } = useList<Colaborador>("colaborador", { orderBy: "nome", ascending: true });
  const remove = useRemove("colaborador");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Colaborador> | null>(null);

  const fotoUrl = (path?: string | null) =>
    path ? supabase.storage.from(FOTO_BUCKET).getPublicUrl(path).data.publicUrl : null;

  const openNew = () => { setEditing({ status: "ativo" }); setOpen(true); };
  const openEdit = (r: Colaborador) => { setEditing(r); setOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colaboradores"
        subtitle="Cadastro de colaboradores ativos da empresa."
        actions={
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo</Button>
        }
      />

      {!isLoading && rows.length === 0 && <FluxoIntegracaoAviso />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} colaborador(es)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const url = fotoUrl(r.foto_path);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-muted">
                          {url ? (
                            <img src={url} alt={r.nome ?? ""} className="h-full w-full object-cover" />
                          ) : (
                            <User2 className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{r.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.cpf ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.matricula ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.cargo ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.departamento ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.data_admissao)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtBRL(r.salario_base)}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este colaborador?")) remove.mutate(r.id!); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ColaboradorForm
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={() => refetch()}
      />
    </div>
  );
}
