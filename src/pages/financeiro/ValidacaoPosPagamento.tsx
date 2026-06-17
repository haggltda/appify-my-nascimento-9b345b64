import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, FileDown, RefreshCw, Send, Eraser } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };

type Filtros = {
  ini: string; fim: string; statusVal: string; bancoId: string;
  fornecedor: string; somenteDivergentes: boolean;
};

export default function ValidacaoPosPagamento() {
  const qc = useQueryClient();
  const [f, setF] = useState<Filtros>({
    ini: addDays(today(), -30), fim: today(), statusVal: "todos",
    bancoId: "todos", fornecedor: "", somenteDivergentes: false,
  });
  const [sel, setSel] = useState<string[]>([]);
  const [divDialog, setDivDialog] = useState<any | null>(null);
  const [divTexto, setDivTexto] = useState("");

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_bancaria_val"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome").eq("ativa", true).order("banco_nome");
      return data ?? [];
    },
  });

  const { data: pagamentos = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["validacao_titulos", f],
    queryFn: async () => {
      let q = (supabase as any).from("titulo_pagar")
        .select("*, fornecedor(razao_social), conta_bancaria(banco_nome, banco_codigo), validacao:financeiro_pagamento_validacao(*), movimento:movimento_bancario(id, conta_bancaria_id, valor, data_movimento, conciliado)")
        .eq("status", "pago")
        .gte("data_pagamento", f.ini).lte("data_pagamento", f.fim)
        .order("data_pagamento", { ascending: false }).limit(500);
      if (f.bancoId !== "todos") q = q.eq("conta_bancaria_id", f.bancoId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (f.fornecedor) rows = rows.filter((r: any) => r.fornecedor?.razao_social?.toLowerCase().includes(f.fornecedor.toLowerCase()));
      if (f.statusVal !== "todos") rows = rows.filter((r: any) => (r.validacao?.[0]?.status_validacao ?? "pendente") === f.statusVal);
      if (f.somenteDivergentes) rows = rows.filter((r: any) => Number(r.valor) !== Number(r.valor_pago) || r.validacao?.[0]?.status_validacao === "divergente");
      return rows;
    },
  });

  const cards = useMemo(() => {
    const total = pagamentos.length;
    const conf = pagamentos.filter((p) => p.validacao?.[0]?.status_validacao === "conferido").length;
    const div = pagamentos.filter((p) => p.validacao?.[0]?.status_validacao === "divergente" || (Number(p.valor) !== Number(p.valor_pago))).length;
    const semComp = pagamentos.filter((p) => !p.validacao?.[0]?.comprovante_anexado).length;
    const pendCon = pagamentos.filter((p) => p.validacao?.[0]?.status_validacao === "pendente_conciliacao").length;
    return { total, conf, div, semComp, pendCon };
  }, [pagamentos]);

  const validar = useMutation({
    mutationFn: async ({ id, status, divergencia, tratativa }: any) => {
      const { error } = await (supabase as any).rpc("validacao_registrar", {
        p_titulo_pagar_id: id, p_status: status,
        p_divergencia: divergencia ?? null, p_tratativa: tratativa ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Validação registrada"); qc.invalidateQueries({ queryKey: ["validacao_titulos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const enviarConciliacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("validacao_enviar_conciliacao", { p_titulo_pagar_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Enviado para conciliação"); qc.invalidateQueries({ queryKey: ["validacao_titulos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const validarSelecionados = async (status: "conferido" | "divergente") => {
    for (const id of sel) await validar.mutateAsync({ id, status });
    setSel([]);
  };

  const abrirDivergencia = (titulo: any) => { setDivDialog(titulo); setDivTexto(""); };
  const confirmarDivergencia = async () => {
    if (!divDialog) return;
    if (divTexto.trim().length < 5) { toast.error("Descreva a divergência"); return; }
    await validar.mutateAsync({ id: divDialog.id, status: "divergente", divergencia: divTexto });
    setDivDialog(null);
  };

  const exportar = () => {
    const head = "Documento;Fornecedor;Data Pgto;Valor Aprov;Valor Pago;Status Validação;Divergência\n";
    const body = pagamentos.map((p) => {
      const v = p.validacao?.[0];
      return [p.numero_documento, p.fornecedor?.razao_social ?? "",
        p.data_pagamento, Number(p.valor || 0).toFixed(2).replace(".", ","),
        Number(p.valor_pago || 0).toFixed(2).replace(".", ","),
        v?.status_validacao ?? "pendente", v?.divergencia ?? ""].join(";");
    }).join("\n");
    const blob = new Blob([head + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `validacao-${f.ini}-${f.fim}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Validação Pós-Pagamento"
        subtitle="Conferência aprovado × pago, comprovantes, baixa, divergências e envio para conciliação bancária."
        module="Financeiro"
        breadcrumb={["Financeiro", "Validação Pós-Pagamento"]}
        actions={<>
          <Button variant="outline" size="sm" onClick={exportar}><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
          <Button size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
        </>}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div><Label>De</Label><Input type="date" value={f.ini} onChange={(e) => setF({ ...f, ini: e.target.value })} /></div>
            <div><Label>Até</Label><Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
            <div>
              <Label>Status validação</Label>
              <Select value={f.statusVal} onValueChange={(v) => setF({ ...f, statusVal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="conferido">Conferido</SelectItem>
                  <SelectItem value="divergente">Divergente</SelectItem>
                  <SelectItem value="pendente_comprovante">Pend. comprovante</SelectItem>
                  <SelectItem value="pendente_baixa">Pend. baixa</SelectItem>
                  <SelectItem value="pendente_conciliacao">Pend. conciliação</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banco</Label>
              <Select value={f.bancoId} onValueChange={(v) => setF({ ...f, bancoId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Fornecedor</Label><Input value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} placeholder="Razão social..." /></div>
            <div className="flex items-end gap-2 col-span-full">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.somenteDivergentes} onCheckedChange={(v) => setF({ ...f, somenteDivergentes: !!v })} />Apenas divergentes</label>
              <Button onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
              <Button variant="outline" onClick={() => setF({ ini: addDays(today(), -30), fim: today(), statusVal: "todos", bancoId: "todos", fornecedor: "", somenteDivergentes: false })}><Eraser className="h-4 w-4 mr-2" />Limpar</Button>
              <Button variant="outline" onClick={exportar}><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-t-4 border-t-primary"><CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Pagamentos</CardDescription><CardTitle className="text-2xl">{cards.total}</CardTitle></CardHeader></Card>
        <Card className="border-t-4 border-t-emerald-500"><CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Conferidos</CardDescription><CardTitle className="text-2xl text-emerald-600">{cards.conf}</CardTitle></CardHeader></Card>
        <Card className="border-t-4 border-t-destructive"><CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Divergentes</CardDescription><CardTitle className="text-2xl text-destructive">{cards.div}</CardTitle></CardHeader></Card>
        <Card className="border-t-4 border-t-amber-500"><CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Sem Comprovante</CardDescription><CardTitle className="text-2xl">{cards.semComp}</CardTitle></CardHeader></Card>
        <Card className="border-t-4 border-t-blue-500"><CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Pend. Conciliação</CardDescription><CardTitle className="text-2xl">{cards.pendCon}</CardTitle></CardHeader></Card>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-9">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pagamentos a validar</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => validarSelecionados("conferido")} disabled={sel.length === 0}><CheckCircle2 className="h-4 w-4 mr-2" />Marcar conformes</Button>
              <Button size="sm" variant="destructive" onClick={() => validarSelecionados("divergente")} disabled={sel.length === 0}><AlertTriangle className="h-4 w-4 mr-2" />Marcar divergentes</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data Pgto</TableHead>
                  <TableHead className="text-right">Aprov.</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Validação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pagamentos.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum pagamento</TableCell></TableRow>}
                  {pagamentos.map((p: any) => {
                    const v = p.validacao?.[0];
                    const divValor = Number(p.valor) !== Number(p.valor_pago);
                    const sv = v?.status_validacao ?? "pendente";
                    return (
                      <TableRow key={p.id} className={divValor ? "bg-destructive/5" : ""}>
                        <TableCell><Checkbox checked={sel.includes(p.id)} onCheckedChange={() => setSel((s) => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} /></TableCell>
                        <TableCell className="font-mono text-xs">{p.numero_documento}</TableCell>
                        <TableCell>{p.fornecedor?.razao_social ?? "—"}</TableCell>
                        <TableCell>{fmtDate(p.data_pagamento)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(p.valor)}</TableCell>
                        <TableCell className={`text-right ${divValor ? "text-destructive font-semibold" : ""}`}>{fmtMoney(p.valor_pago)}</TableCell>
                        <TableCell className="text-xs">{p.conta_bancaria?.banco_nome ?? "—"}</TableCell>
                        <TableCell><Badge variant={sv === "conferido" ? "default" : sv === "divergente" ? "destructive" : "outline"}>{sv}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => validar.mutate({ id: p.id, status: "conferido" })}>Conferir</Button>
                          <Button size="sm" variant="outline" onClick={() => abrirDivergencia(p)}>Divergência</Button>
                          <Button size="sm" variant="outline" onClick={() => enviarConciliacao.mutate(p.id)}><Send className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Checklist</CardTitle><CardDescription>Itens conferidos no período</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ChecklistRow label="Favorecido confere" pct={pct(pagamentos, (p) => p.validacao?.[0]?.fornecedor_confere)} />
            <ChecklistRow label="Valor confere" pct={pct(pagamentos, (p) => Number(p.valor) === Number(p.valor_pago))} />
            <ChecklistRow label="Comprovante anexado" pct={pct(pagamentos, (p) => p.validacao?.[0]?.comprovante_anexado)} />
            <ChecklistRow label="Baixa confirmada" pct={pct(pagamentos, () => true)} />
            <ChecklistRow label="Movimento bancário" pct={pct(pagamentos, (p) => !!p.movimento?.[0])} />
            <ChecklistRow label="Conciliado" pct={pct(pagamentos, (p) => p.movimento?.[0]?.conciliado)} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!divDialog} onOpenChange={(o) => !o && setDivDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir divergência — {divDialog?.numero_documento}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Aprovado: <strong>{fmtMoney(divDialog?.valor)}</strong> • Pago: <strong>{fmtMoney(divDialog?.valor_pago)}</strong>
            </div>
            <Label>Descrição da divergência</Label>
            <Textarea value={divTexto} onChange={(e) => setDivTexto(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDivDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarDivergencia}>Registrar divergência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function pct(arr: any[], pred: (p: any) => boolean | undefined | null) {
  if (arr.length === 0) return 0;
  return Math.round((arr.filter(pred).length / arr.length) * 100);
}

function ChecklistRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between"><span>{label}</span><span className="font-mono text-xs">{pct}%</span></div>
      <div className="h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
