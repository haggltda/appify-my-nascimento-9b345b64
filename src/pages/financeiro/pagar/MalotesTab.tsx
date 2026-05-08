import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, FileDown, Trash2, ListPlus } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusBadge = (s: string) => {
  const map: Record<string, any> = {
    rascunho: { v: "outline", l: "Rascunho" },
    enviado: { v: "default", l: "Enviado" },
    executado: { v: "default", l: "Executado" },
    cancelado: { v: "secondary", l: "Cancelado" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

export default function MalotesTab() {
  const qc = useQueryClient();
  const [openNovo, setOpenNovo] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data: malotes = [], isLoading } = useQuery<any[]>({
    queryKey: ["malote_pagamento"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("malote_pagamento")
        .select("*, conta_bancaria(banco_codigo, banco_nome, agencia, conta), empresas(razao_social)")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const executar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("malote_executar", { _malote_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Remessa ${d.numero} gerada`);
      if (d?.remessa_id) {
        (supabase as any).from("remessa_cnab").select("arquivo_nome, arquivo_conteudo").eq("id", d.remessa_id).single()
          .then(({ data: r }: any) => { if (r?.arquivo_conteudo) baixarArquivo(r.arquivo_nome, r.arquivo_conteudo); });
      }
      qc.invalidateQueries({ queryKey: ["malote_pagamento"] });
      qc.invalidateQueries({ queryKey: ["titulo_pagar"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Malotes de pagamento</CardTitle>
          <CardDescription>Agrupe títulos por banco/dia e gere a remessa CNAB</CardDescription>
        </div>
        <Button onClick={() => setOpenNovo(true)}><Plus className="h-4 w-4 mr-2" />Novo malote</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Data pgto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Qtd / Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {malotes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum malote</TableCell></TableRow>}
              {malotes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{m.empresas?.razao_social ?? "—"}</TableCell>
                  <TableCell className="text-xs">{m.conta_bancaria?.banco_codigo} — {m.conta_bancaria?.banco_nome}</TableCell>
                  <TableCell>{fmtDate(m.data_pagamento)}</TableCell>
                  <TableCell className="text-xs">{m.descricao ?? "—"}</TableCell>
                  <TableCell className="text-right">{m.qtd_titulos} / {fmtMoney(m.valor_total)}</TableCell>
                  <TableCell>{statusBadge(m.status)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {m.status === "rascunho" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditing(m.id)}>
                          <ListPlus className="h-4 w-4 mr-1" />Títulos
                        </Button>
                        <Button size="sm" disabled={m.qtd_titulos === 0 || executar.isPending} onClick={() => executar.mutate(m.id)}>
                          <Send className="h-4 w-4 mr-1" />Enviar CNAB
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {openNovo && <NovoMaloteDialog onClose={(id) => { setOpenNovo(false); qc.invalidateQueries({ queryKey: ["malote_pagamento"] }); if (id) setEditing(id); }} />}
      {editing && <EditarMaloteDialog id={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["malote_pagamento"] }); }} />}
    </Card>
  );
}

function baixarArquivo(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome || "remessa.REM";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function NovoMaloteDialog({ onClose }: { onClose: (id?: string) => void }) {
  const [empresaId, setEmpresaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ["empresas-malote"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, razao_social").order("razao_social");
      return data ?? [];
    },
  });
  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-malote"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_bancaria").select("id, banco_codigo, banco_nome, agencia, conta, empresa_id").eq("ativa", true).order("banco_nome");
      return data ?? [];
    },
  });
  const contasFiltradas = contas.filter((c) => !empresaId || c.empresa_id === empresaId);

  const criar = useMutation({
    mutationFn: async () => {
      if (!empresaId || !contaId || !data) throw new Error("Preencha todos os campos");
      const { data: id, error } = await (supabase as any).rpc("malote_criar", {
        _empresa_id: empresaId, _conta_bancaria_id: contaId, _data_pagamento: data, _descricao: descricao || null,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (id: string) => { toast.success("Malote criado"); onClose(id); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo malote</DialogTitle><DialogDescription>Crie um lote para agrupar títulos de pagamento.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={(v) => { setEmpresaId(v); setContaId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId} disabled={!empresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{contasFiltradas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome} {c.agencia}/{c.conta}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data de pagamento</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarMaloteDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: malote } = useQuery<any>({
    queryKey: ["malote_detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("malote_pagamento").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: dentro = [] } = useQuery<any[]>({
    queryKey: ["malote_titulos", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("malote_titulo")
        .select("titulo_pagar_id, titulo_pagar(id, numero_documento, data_vencimento, valor, fornecedor(razao_social))")
        .eq("malote_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: disponiveis = [] } = useQuery<any[]>({
    queryKey: ["titulos-disponiveis-malote", id, malote?.empresa_id],
    enabled: !!malote?.empresa_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("titulo_pagar")
        .select("id, numero_documento, data_vencimento, valor, status, remessa_status, fornecedor(razao_social)")
        .eq("empresa_id", malote.empresa_id)
        .in("status", ["aberto", "agendado", "parcial"])
        .neq("remessa_status", "enviado")
        .order("data_vencimento").limit(200);
      if (error) throw error;
      const inIds = new Set((dentro || []).map((d: any) => d.titulo_pagar_id));
      return (data ?? []).filter((t: any) => !inIds.has(t.id));
    },
  });

  const adicionar = useMutation({
    mutationFn: async (tid: string) => {
      const { error } = await (supabase as any).rpc("malote_adicionar_titulo", { _malote_id: id, _titulo_id: tid });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["malote_titulos", id] });
      qc.invalidateQueries({ queryKey: ["titulos-disponiveis-malote", id] });
      qc.invalidateQueries({ queryKey: ["malote_pagamento"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (tid: string) => {
      const { error } = await (supabase as any).rpc("malote_remover_titulo", { _malote_id: id, _titulo_id: tid });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["malote_titulos", id] });
      qc.invalidateQueries({ queryKey: ["titulos-disponiveis-malote", id] });
      qc.invalidateQueries({ queryKey: ["malote_pagamento"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Títulos do malote</DialogTitle>
          <DialogDescription>Adicione ou remova títulos antes de gerar a remessa.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2 text-sm">No malote ({dentro.length})</h4>
            <div className="border rounded max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Doc</TableHead><TableHead>Fornec.</TableHead><TableHead>Venc</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dentro.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Vazio</TableCell></TableRow>}
                  {dentro.map((d: any) => (
                    <TableRow key={d.titulo_pagar_id}>
                      <TableCell className="font-mono text-xs">{d.titulo_pagar?.numero_documento}</TableCell>
                      <TableCell className="text-xs truncate max-w-32">{d.titulo_pagar?.fornecedor?.razao_social ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(d.titulo_pagar?.data_vencimento)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtMoney(d.titulo_pagar?.valor)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => remover.mutate(d.titulo_pagar_id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-sm">Disponíveis ({disponiveis.length})</h4>
            <div className="border rounded max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Doc</TableHead><TableHead>Fornec.</TableHead><TableHead>Venc</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {disponiveis.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum</TableCell></TableRow>}
                  {disponiveis.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.numero_documento}</TableCell>
                      <TableCell className="text-xs truncate max-w-32">{t.fornecedor?.razao_social ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(t.data_vencimento)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtMoney(t.valor)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => adicionar.mutate(t.id)}><Plus className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
