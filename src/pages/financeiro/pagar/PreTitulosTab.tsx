import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Check, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusBadge = (s: string) => {
  const map: Record<string, any> = {
    rascunho: { v: "outline", l: "Rascunho" },
    em_aprovacao: { v: "secondary", l: "Em aprovação" },
    aprovado: { v: "default", l: "Aprovado" },
    rejeitado: { v: "destructive", l: "Rejeitado" },
    promovido: { v: "default", l: "Promovido" },
    cancelado: { v: "secondary", l: "Cancelado" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

export default function PreTitulosTab() {
  const qc = useQueryClient();
  const [openNovo, setOpenNovo] = useState(false);
  const [openRejeitar, setOpenRejeitar] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["pre_titulo_pagar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pre_titulo_pagar")
        .select("*, fornecedor(razao_social), conta_contabil(codigo, nome), centros_custo(codigo, nome)")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("pre_titulo_submeter", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Submetido para aprovação"); qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("pre_titulo_aprovar", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aprovado"); qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const promover = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("pre_titulo_promover", { _id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Título a pagar criado");
      qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] });
      qc.invalidateQueries({ queryKey: ["titulo_pagar"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pré-títulos a pagar</CardTitle>
          <CardDescription>Solicitação → aprovação → promoção a título a pagar</CardDescription>
        </div>
        <Button onClick={() => setOpenNovo(true)}><Plus className="h-4 w-4 mr-2" />Novo pré-título</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Conta contábil</TableHead>
                <TableHead>CC</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum pré-título</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.numero_documento ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.descricao}</TableCell>
                  <TableCell>{r.fornecedor?.razao_social ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.conta_contabil ? `${r.conta_contabil.codigo} ${r.conta_contabil.nome}` : "—"}</TableCell>
                  <TableCell className="text-xs">{r.centros_custo ? `${r.centros_custo.codigo}` : "—"}</TableCell>
                  <TableCell>{fmtDate(r.data_vencimento)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.valor)}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "rascunho" && (
                      <Button size="sm" variant="outline" onClick={() => submeter.mutate(r.id)}>
                        <Send className="h-4 w-4 mr-1" />Submeter
                      </Button>
                    )}
                    {r.status === "em_aprovacao" && (
                      <>
                        <Button size="sm" onClick={() => aprovar.mutate(r.id)}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
                        <Button size="sm" variant="destructive" onClick={() => setOpenRejeitar(r.id)}><X className="h-4 w-4" /></Button>
                      </>
                    )}
                    {r.status === "aprovado" && (
                      <Button size="sm" onClick={() => promover.mutate(r.id)}>
                        <ArrowRight className="h-4 w-4 mr-1" />Promover a título
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {openNovo && <NovoPreTituloDialog onClose={() => { setOpenNovo(false); qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] }); }} />}
      {openRejeitar && <RejeitarDialog id={openRejeitar} onClose={() => { setOpenRejeitar(null); qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] }); }} />}
    </Card>
  );
}

function NovoPreTituloDialog({ onClose }: { onClose: () => void }) {
  const [empresaId, setEmpresaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [numDoc, setNumDoc] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [contaContabilId, setContaContabilId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ["empresas-ativas"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, razao_social").order("razao_social");
      return data ?? [];
    },
  });
  const { data: fornecedores = [] } = useQuery<any[]>({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("fornecedor").select("id, razao_social").order("razao_social").limit(500);
      return data ?? [];
    },
  });
  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_contabil"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_contabil").select("id, codigo, nome, tipo").eq("tipo", "analitica").order("codigo");
      return data ?? [];
    },
  });
  const { data: ccs = [] } = useQuery<any[]>({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("centros_custo").select("id, codigo, nome").order("codigo");
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empresaId || !descricao || !valor || !vencimento) throw new Error("Preencha empresa, descrição, valor e vencimento");
      const { error } = await (supabase as any).from("pre_titulo_pagar").insert({
        empresa_id: empresaId,
        fornecedor_id: fornecedorId || null,
        descricao,
        numero_documento: numDoc || null,
        valor: Number(valor),
        data_vencimento: vencimento,
        conta_contabil_id: contaContabilId || null,
        centro_custo_id: centroCustoId || null,
        observacoes: observacoes || null,
        solicitante_id: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pré-título criado em rascunho"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo pré-título a pagar</DialogTitle>
          <DialogDescription>Será criado em rascunho. Submeta para entrar no fluxo de aprovação.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Fornecedor</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
              <SelectContent>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Descrição *</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div><Label>Nº documento</Label><Input value={numDoc} onChange={(e) => setNumDoc(e.target.value)} /></div>
          <div><Label>Valor *</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Vencimento *</Label><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>
          <div>
            <Label>Conta contábil</Label>
            <Select value={contaContabilId} onValueChange={setContaContabilId}>
              <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
              <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Centro de custo</Label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
              <SelectContent>{ccs.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar rascunho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejeitarDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [motivo, setMotivo] = useState("");
  const rejeitar = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) throw new Error("Informe o motivo");
      const { error } = await (supabase as any).rpc("pre_titulo_rejeitar", { _id: id, _motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rejeitado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rejeitar pré-título</DialogTitle></DialogHeader>
        <div><Label>Motivo</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => rejeitar.mutate()} disabled={rejeitar.isPending}>Rejeitar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
