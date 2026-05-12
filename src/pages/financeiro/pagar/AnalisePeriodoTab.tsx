import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, RefreshCw, Send, FileDown, Eraser } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10);
};

type Filtros = {
  ini: string; fim: string;
  campoData: "data_vencimento" | "competencia";
  status: string;
  forma: string;
  fornecedor: string;
  contaBancariaId: string;
  apenasVencidos: boolean;
  apenasSemProgramacao: boolean;
};

export default function AnalisePeriodoTab() {
  const navigate = useNavigate();
  const [f, setF] = useState<Filtros>({
    ini: addDays(today(), -30), fim: addDays(today(), 30),
    campoData: "data_vencimento",
    status: "todos", forma: "todos", fornecedor: "",
    contaBancariaId: "todos",
    apenasVencidos: false, apenasSemProgramacao: false,
  });
  const [sel, setSel] = useState<string[]>([]);

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_bancaria_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta").eq("ativa", true).order("banco_nome");
      return data ?? [];
    },
  });

  const { data: titulos = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["titulo_pagar_analise", f],
    queryFn: async () => {
      let q = (supabase as any).from("titulo_pagar")
        .select("*, fornecedor(razao_social, cnpj_cpf), centro_custo(nome), contrato(numero), conta_bancaria(banco_nome)")
        .gte(f.campoData, f.ini).lte(f.campoData, f.fim)
        .order("data_vencimento", { ascending: true }).limit(1000);
      if (f.status !== "todos") q = q.eq("status", f.status);
      if (f.forma !== "todos") q = q.eq("forma_pagamento", f.forma);
      if (f.contaBancariaId !== "todos") q = q.eq("conta_bancaria_id", f.contaBancariaId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (f.fornecedor) {
        const t = f.fornecedor.toLowerCase();
        rows = rows.filter((r: any) => r.fornecedor?.razao_social?.toLowerCase().includes(t));
      }
      if (f.apenasVencidos) rows = rows.filter((r: any) => r.status === "aberto" && new Date(r.data_vencimento) < new Date());
      return rows;
    },
  });

  // detecta títulos já programados (em malote rascunho/enviado)
  const { data: programados = [] } = useQuery<string[]>({
    queryKey: ["titulos_em_programacao"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("malote_titulo")
        .select("titulo_pagar_id, malote_pagamento!inner(status)")
        .in("malote_pagamento.status", ["rascunho", "enviado"]);
      return (data ?? []).map((r: any) => r.titulo_pagar_id);
    },
  });

  const titulosFiltrados = useMemo(() => {
    if (!f.apenasSemProgramacao) return titulos;
    const setProg = new Set(programados);
    return titulos.filter((t: any) => !setProg.has(t.id));
  }, [titulos, programados, f.apenasSemProgramacao]);

  const cards = useMemo(() => {
    const total = titulosFiltrados.reduce((s, t) => s + Number(t.valor || 0), 0);
    const venc = titulosFiltrados.filter((t) => t.status === "aberto" && new Date(t.data_vencimento) < new Date());
    const aVencer = titulosFiltrados.filter((t) => t.status === "aberto" && new Date(t.data_vencimento) >= new Date());
    const agendado = titulosFiltrados.filter((t) => t.status === "agendado");
    const pago = titulosFiltrados.filter((t) => t.status === "pago");
    return {
      total, qtd: titulosFiltrados.length,
      vencidos: venc.reduce((s, t) => s + Number(t.valor || 0), 0),
      qtdVencidos: venc.length,
      aVencer: aVencer.reduce((s, t) => s + Number(t.valor || 0), 0),
      agendado: agendado.reduce((s, t) => s + Number(t.valor || 0), 0),
      pagos: pago.reduce((s, t) => s + Number(t.valor_pago || t.valor || 0), 0),
    };
  }, [titulosFiltrados]);

  const elegivel = (t: any) =>
    !["pago", "cancelado"].includes(t.status) &&
    !!t.data_vencimento && !!t.fornecedor_id && Number(t.valor) > 0 &&
    !programados.includes(t.id);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => {
    const ids = titulosFiltrados.filter(elegivel).map((t) => t.id);
    setSel(sel.length === ids.length ? [] : ids);
  };

  const irProgramar = () => {
    if (sel.length === 0) { toast.error("Selecione ao menos um título"); return; }
    const titulosSel = titulosFiltrados.filter((t) => sel.includes(t.id));
    navigate("/app/financeiro/programacao-pagamentos", {
      state: { titulosSelecionados: titulosSel, periodoIni: f.ini, periodoFim: f.fim },
    });
  };

  const exportar = () => {
    const head = "Documento;Fornecedor;Vencimento;Valor;Status\n";
    const body = titulosFiltrados.map((t) => [
      t.numero_documento, t.fornecedor?.razao_social ?? "", t.data_vencimento,
      Number(t.valor || 0).toFixed(2).replace(".", ","), t.status,
    ].join(";")).join("\n");
    const blob = new Blob([head + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `analise-periodo-${f.ini}-${f.fim}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div><Label>De</Label><Input type="date" value={f.ini} onChange={(e) => setF({ ...f, ini: e.target.value })} /></div>
            <div><Label>Até</Label><Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
            <div>
              <Label>Campo</Label>
              <Select value={f.campoData} onValueChange={(v: any) => setF({ ...f, campoData: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_vencimento">Vencimento</SelectItem>
                  <SelectItem value="competencia">Competência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma</Label>
              <Select value={f.forma} onValueChange={(v) => setF({ ...f, forma: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="debito_automatico">Débito automático</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta bancária</Label>
              <Select value={f.contaBancariaId} onValueChange={(v) => setF({ ...f, contaBancariaId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Fornecedor (contém)</Label>
              <Input value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} placeholder="Razão social..." />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.apenasVencidos} onCheckedChange={(v) => setF({ ...f, apenasVencidos: !!v })} /> Vencidos</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.apenasSemProgramacao} onCheckedChange={(v) => setF({ ...f, apenasSemProgramacao: !!v })} /> Sem programação</label>
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
              <Button variant="outline" onClick={() => setF({
                ini: addDays(today(), -30), fim: addDays(today(), 30), campoData: "data_vencimento",
                status: "todos", forma: "todos", fornecedor: "", contaBancariaId: "todos",
                apenasVencidos: false, apenasSemProgramacao: false,
              })}><Eraser className="h-4 w-4 mr-2" />Limpar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total período</CardDescription><CardTitle className="text-xl">{fmtMoney(cards.total)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Qtd</CardDescription><CardTitle className="text-xl">{cards.qtd}</CardTitle></CardHeader></Card>
        <Card className="border-l-4 border-l-destructive"><CardHeader className="pb-2"><CardDescription>Vencidos ({cards.qtdVencidos})</CardDescription><CardTitle className="text-xl">{fmtMoney(cards.vencidos)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>A vencer</CardDescription><CardTitle className="text-xl">{fmtMoney(cards.aVencer)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Programado</CardDescription><CardTitle className="text-xl">{fmtMoney(cards.agendado)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pago no período</CardDescription><CardTitle className="text-xl">{fmtMoney(cards.pagos)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Carteira do período</CardTitle>
            {sel.length > 0 && <Badge variant="secondary">{sel.length} selecionado(s)</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportar}><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
            <Button onClick={irProgramar} disabled={sel.length === 0}>
              <Send className="h-4 w-4 mr-2" />Programar selecionados
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={sel.length > 0 && sel.length === titulosFiltrados.filter(elegivel).length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>CC / Contrato</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Programação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titulosFiltrados.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum título no período</TableCell></TableRow>}
                {titulosFiltrados.map((t) => {
                  const ok = elegivel(t);
                  const vencido = t.status === "aberto" && new Date(t.data_vencimento) < new Date();
                  const jaProgramado = programados.includes(t.id);
                  const motivo = !ok ? (
                    t.status === "pago" ? "Já pago" :
                    t.status === "cancelado" ? "Cancelado" :
                    !t.data_vencimento ? "Sem vencimento" :
                    !t.fornecedor_id ? "Sem fornecedor" :
                    Number(t.valor) <= 0 ? "Valor inválido" :
                    jaProgramado ? "Já em programação ativa" : "Inelegível"
                  ) : null;
                  return (
                    <TableRow key={t.id} className={vencido ? "bg-destructive/5" : ""}>
                      <TableCell>{ok && <Checkbox checked={sel.includes(t.id)} onCheckedChange={() => toggle(t.id)} />}</TableCell>
                      <TableCell className="font-mono text-xs">{t.numero_documento}</TableCell>
                      <TableCell><div>{t.fornecedor?.razao_social ?? "—"}</div><div className="text-xs text-muted-foreground">{t.fornecedor?.cnpj_cpf}</div></TableCell>
                      <TableCell className="text-xs">{fmtDate(t.competencia)}</TableCell>
                      <TableCell>{fmtDate(t.data_vencimento)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(t.valor)}</TableCell>
                      <TableCell className="text-xs">{t.centro_custo?.nome ?? "—"}{t.contrato?.numero ? ` / ${t.contrato.numero}` : ""}</TableCell>
                      <TableCell><Badge variant="outline">{t.forma_pagamento ?? "—"}</Badge></TableCell>
                      <TableCell><Badge variant={t.status === "pago" ? "default" : vencido ? "destructive" : "outline"}>{t.status}</Badge></TableCell>
                      <TableCell>
                        {jaProgramado ? <Badge variant="secondary">Programado</Badge> :
                         motivo ? <span className="text-xs text-muted-foreground">{motivo}</span> :
                         <span className="text-xs text-muted-foreground">Disponível</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
