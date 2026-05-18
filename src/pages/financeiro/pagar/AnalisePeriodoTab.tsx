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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, RefreshCw, Send, FileDown, Eraser, CheckSquare, AlertTriangle, FileSpreadsheet, Plus } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };

type Filtros = {
  ini: string; fim: string;
  campoData: "data_vencimento" | "competencia";
  status: string; forma: string; fornecedor: string;
  contaBancariaId: string; centroCustoId: string; contratoId: string;
  apenasVencidos: boolean; apenasSemProgramacao: boolean;
};

type SubTab = "todos" | "vencidos" | "avencer" | "programados" | "pendentesaprov" | "pagos";

const KPI_CLS: Record<string, string> = {
  total: "border-t-4 border-t-primary",
  vencidos: "border-t-4 border-t-destructive",
  avencer: "border-t-4 border-t-blue-500",
  programados: "border-t-4 border-t-violet-500",
  pendentes: "border-t-4 border-t-amber-500",
  pagos: "border-t-4 border-t-emerald-500",
};

export default function AnalisePeriodoTab() {
  const navigate = useNavigate();
  const [f, setF] = useState<Filtros>({
    ini: addDays(today(), -30), fim: addDays(today(), 30),
    campoData: "data_vencimento",
    status: "todos", forma: "todos", fornecedor: "",
    contaBancariaId: "todos", centroCustoId: "todos", contratoId: "todos",
    apenasVencidos: false, apenasSemProgramacao: false,
  });
  const [sub, setSub] = useState<SubTab>("todos");
  const [sel, setSel] = useState<string[]>([]);

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_bancaria_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta").eq("ativa", true).order("banco_nome");
      return data ?? [];
    },
  });
  const { data: ccs = [] } = useQuery<any[]>({
    queryKey: ["cc_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("centro_custo").select("id, nome").order("nome").limit(500);
      return data ?? [];
    },
  });
  const { data: contratosOpts = [] } = useQuery<any[]>({
    queryKey: ["contrato_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("contrato").select("id, numero").order("numero").limit(500);
      return data ?? [];
    },
  });

  const { data: titulos = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["titulo_pagar_analise", f],
    queryFn: async () => {
      let q = (supabase as any).from("titulo_pagar")
        .select("*, fornecedor:fornecedor_id(razao_social, cnpj_cpf), centro_custo:centros_custo!titulo_pagar_centro_custo_fk(id, nome), contrato:contrato_id(id, numero), conta_bancaria:conta_bancaria_id(banco_nome, banco_codigo)")
        .gte(f.campoData, f.ini).lte(f.campoData, f.fim)
        .order("data_vencimento", { ascending: true }).limit(1000);
      if (f.status !== "todos") q = q.eq("status", f.status);
      if (f.forma !== "todos") q = q.eq("forma_pagamento", f.forma);
      if (f.contaBancariaId !== "todos") q = q.eq("conta_bancaria_id", f.contaBancariaId);
      if (f.centroCustoId !== "todos") q = q.eq("centro_custo_id", f.centroCustoId);
      if (f.contratoId !== "todos") q = q.eq("contrato_id", f.contratoId);
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

  // títulos em malote ativo (rascunho/enviado/aprovado)
  const { data: progMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["titulos_em_programacao_status"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("malote_titulo")
        .select("titulo_pagar_id, malote_pagamento!inner(status, aprovacao_status)")
        .in("malote_pagamento.status", ["rascunho", "enviado", "aprovado"]);
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        const ap = r.malote_pagamento?.aprovacao_status;
        m[r.titulo_pagar_id] = ap === "pendente" ? "pendente_aprov" : "programado";
      });
      return m;
    },
  });

  const programadosIds = useMemo(() => Object.keys(progMap), [progMap]);

  const tituloEhVencido = (t: any) => t.status === "aberto" && new Date(t.data_vencimento) < new Date();
  const tituloPendApr = (t: any) => progMap[t.id] === "pendente_aprov";
  const tituloProgramado = (t: any) => progMap[t.id] === "programado";

  const baseFiltrados = useMemo(() => {
    if (!f.apenasSemProgramacao) return titulos;
    return titulos.filter((t: any) => !programadosIds.includes(t.id));
  }, [titulos, programadosIds, f.apenasSemProgramacao]);

  const buckets = useMemo(() => ({
    todos: baseFiltrados,
    vencidos: baseFiltrados.filter(tituloEhVencido),
    avencer: baseFiltrados.filter((t: any) => t.status === "aberto" && new Date(t.data_vencimento) >= new Date()),
    programados: baseFiltrados.filter(tituloProgramado),
    pendentesaprov: baseFiltrados.filter(tituloPendApr),
    pagos: baseFiltrados.filter((t: any) => t.status === "pago"),
  }), [baseFiltrados, progMap]);

  const visiveis = buckets[sub];

  const cards = useMemo(() => {
    const sum = (arr: any[], key: "valor" | "valor_pago" = "valor") =>
      arr.reduce((s, t) => s + Number(t[key] || t.valor || 0), 0);
    return {
      total: sum(buckets.todos), qtdTotal: buckets.todos.length,
      vencidos: sum(buckets.vencidos), qtdVencidos: buckets.vencidos.length,
      avencer: sum(buckets.avencer), qtdAvencer: buckets.avencer.length,
      programados: sum(buckets.programados), qtdProg: buckets.programados.length,
      pendentes: sum(buckets.pendentesaprov), qtdPend: buckets.pendentesaprov.length,
      pagos: sum(buckets.pagos, "valor_pago"), qtdPagos: buckets.pagos.length,
    };
  }, [buckets]);

  const elegivel = (t: any) =>
    !["pago", "cancelado"].includes(t.status) &&
    !!t.data_vencimento && !!t.fornecedor_id && Number(t.valor) > 0 &&
    !programadosIds.includes(t.id);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => {
    const ids = visiveis.filter(elegivel).map((t) => t.id);
    setSel(sel.length === ids.length ? [] : ids);
  };

  const irProgramar = () => {
    if (sel.length === 0) { toast.error("Selecione ao menos um título"); return; }
    const titulosSel = visiveis.filter((t) => sel.includes(t.id));
    navigate("/app/financeiro/programacao-pagamentos", {
      state: { titulosSelecionados: titulosSel, periodoIni: f.ini, periodoFim: f.fim },
    });
  };

  const exportar = () => {
    const head = "Documento;Fornecedor;Vencimento;Valor;Status\n";
    const body = visiveis.map((t) => [
      t.numero_documento, t.fornecedor?.razao_social ?? "", t.data_vencimento,
      Number(t.valor || 0).toFixed(2).replace(".", ","), t.status,
    ].join(";")).join("\n");
    const blob = new Blob([head + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `analise-periodo-${f.ini}-${f.fim}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const limpar = () => setF({
    ini: addDays(today(), -30), fim: addDays(today(), 30), campoData: "data_vencimento",
    status: "todos", forma: "todos", fornecedor: "", contaBancariaId: "todos",
    centroCustoId: "todos", contratoId: "todos",
    apenasVencidos: false, apenasSemProgramacao: false,
  });

  return (
    <div className="space-y-4">
      {/* Header local com ações principais */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Contas a Pagar por Período</h2>
          <p className="text-sm text-muted-foreground">Análise da carteira de títulos por período para programação e aprovação de pagamentos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportar}><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
          <Button onClick={irProgramar} disabled={sel.length === 0}>
            <Plus className="h-4 w-4 mr-2" />Nova Programação
          </Button>
        </div>
      </div>

      {/* KPIs com top-border colorido */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className={KPI_CLS.total}>
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Total do Período</CardDescription>
            <CardTitle className="text-xl">{fmtMoney(cards.total)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0"><span className="text-xs text-muted-foreground">{cards.qtdTotal} títulos</span></CardContent>
        </Card>
        <Card className={KPI_CLS.vencidos}>
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Vencidos</CardDescription>
            <CardTitle className="text-xl text-destructive">{fmtMoney(cards.vencidos)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0"><span className="text-xs text-muted-foreground">{cards.qtdVencidos} títulos</span></CardContent>
        </Card>
        <Card className={KPI_CLS.avencer}>
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">A Vencer</CardDescription>
            <CardTitle className="text-xl">{fmtMoney(cards.avencer)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0"><span className="text-xs text-muted-foreground">{cards.qtdAvencer} títulos</span></CardContent>
        </Card>
        <Card className={KPI_CLS.programados}>
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Programados</CardDescription>
            <CardTitle className="text-xl">{fmtMoney(cards.programados)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0"><span className="text-xs text-muted-foreground">{cards.qtdProg} títulos</span></CardContent>
        </Card>
        <Card className={KPI_CLS.pendentes}>
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Pendentes Aprovação</CardDescription>
            <CardTitle className="text-xl">{fmtMoney(cards.pendentes)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0"><span className="text-xs text-muted-foreground">{cards.qtdPend} títulos</span></CardContent>
        </Card>
        <Card className={KPI_CLS.pagos}>
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase tracking-wide">Pagos no Período</CardDescription>
            <CardTitle className="text-xl">{fmtMoney(cards.pagos)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0"><span className="text-xs text-muted-foreground">{cards.qtdPagos} títulos</span></CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Filtros</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div><Label className="text-xs">Período Inicial</Label><Input type="date" value={f.ini} onChange={(e) => setF({ ...f, ini: e.target.value })} /></div>
            <div><Label className="text-xs">Período Final</Label><Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Campo</Label>
              <Select value={f.campoData} onValueChange={(v: any) => setF({ ...f, campoData: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_vencimento">Vencimento</SelectItem>
                  <SelectItem value="competencia">Competência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} placeholder="Buscar fornecedor..." />
            </div>
            <div>
              <Label className="text-xs">Status do Título</Label>
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
              <Label className="text-xs">Centro de Custo</Label>
              <Select value={f.centroCustoId} onValueChange={(v) => setF({ ...f, centroCustoId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ccs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contrato</Label>
              <Select value={f.contratoId} onValueChange={(v) => setF({ ...f, contratoId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {contratosOpts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.numero}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conta Bancária</Label>
              <Select value={f.contaBancariaId} onValueChange={(v) => setF({ ...f, contaBancariaId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma</Label>
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
            <div className="flex items-end gap-3 lg:col-span-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.apenasVencidos} onCheckedChange={(v) => setF({ ...f, apenasVencidos: !!v })} /> Apenas vencidos</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.apenasSemProgramacao} onCheckedChange={(v) => setF({ ...f, apenasSemProgramacao: !!v })} /> Sem programação</label>
            </div>
            <div className="flex items-end gap-2 lg:col-span-2 lg:justify-end">
              <Button onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Filtrar</Button>
              <Button variant="outline" onClick={limpar}><Eraser className="h-4 w-4 mr-2" />Limpar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar de seleção */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={toggleAll}>
          <CheckSquare className="h-4 w-4 mr-2" />Selecionar todos elegíveis
        </Button>
        <Button size="sm" onClick={irProgramar} disabled={sel.length === 0}>
          <Send className="h-4 w-4 mr-2" />Programar selecionados {sel.length > 0 && `(${sel.length})`}
        </Button>
        <Button variant="outline" size="sm" onClick={exportar}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSub("vencidos")}>
          <AlertTriangle className="h-4 w-4 mr-2" />Abrir pendências
        </Button>
        {sel.length > 0 && <Badge variant="secondary" className="ml-auto">{sel.length} selecionado(s)</Badge>}
      </div>

      {/* Sub-tabs por bucket */}
      <Card>
        <CardHeader className="pb-0">
          <Tabs value={sub} onValueChange={(v) => setSub(v as SubTab)}>
            <TabsList>
              <TabsTrigger value="todos">Todos ({buckets.todos.length})</TabsTrigger>
              <TabsTrigger value="vencidos">Vencidos ({buckets.vencidos.length})</TabsTrigger>
              <TabsTrigger value="avencer">A Vencer ({buckets.avencer.length})</TabsTrigger>
              <TabsTrigger value="programados">Programados ({buckets.programados.length})</TabsTrigger>
              <TabsTrigger value="pendentesaprov">Pendentes Aprovação ({buckets.pendentesaprov.length})</TabsTrigger>
              <TabsTrigger value="pagos">Pagos ({buckets.pagos.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={sel.length > 0 && sel.length === visiveis.filter(elegivel).length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Comp.</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead className="text-right">Valor em Aberto</TableHead>
                  <TableHead>Centro Custo</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Forma Pgto.</TableHead>
                  <TableHead>Conta Prevista</TableHead>
                  <TableHead>Status Fin.</TableHead>
                  <TableHead>Status Prog.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.length === 0 && <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Nenhum título no período</TableCell></TableRow>}
                {visiveis.map((t) => {
                  const ok = elegivel(t);
                  const vencido = tituloEhVencido(t);
                  const dias = t.data_vencimento ? Math.floor((new Date(t.data_vencimento).getTime() - Date.now()) / 86400000) : 0;
                  const progStatus = progMap[t.id];
                  return (
                    <TableRow key={t.id} className={vencido ? "bg-destructive/5" : ""}>
                      <TableCell>{ok && <Checkbox checked={sel.includes(t.id)} onCheckedChange={() => toggle(t.id)} />}</TableCell>
                      <TableCell>
                        <div className="font-medium">{t.fornecedor?.razao_social ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{t.fornecedor?.cnpj_cpf}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.numero_documento}</TableCell>
                      <TableCell className="text-xs">{fmtDate(t.data_emissao)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(t.competencia)}</TableCell>
                      <TableCell className={vencido ? "text-destructive font-semibold" : ""}>{fmtDate(t.data_vencimento)}</TableCell>
                      <TableCell className={`text-right text-xs ${vencido ? "text-destructive" : "text-muted-foreground"}`}>{dias}</TableCell>
                      <TableCell className="text-right">{fmtMoney(t.valor)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(t.valor_aberto ?? t.valor)}</TableCell>
                      <TableCell className="text-xs">{t.centro_custo?.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{t.contrato?.numero ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-[10px]">{t.forma_pagamento ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs">{t.conta_bancaria?.banco_nome ?? "—"}</TableCell>
                      <TableCell><StatusFinBadge s={t.status} vencido={vencido} /></TableCell>
                      <TableCell><StatusProgBadge progStatus={progStatus} vencido={vencido} /></TableCell>
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

function StatusFinBadge({ s, vencido }: { s: string; vencido: boolean }) {
  if (s === "pago") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Pago</Badge>;
  if (vencido) return <Badge variant="destructive">Vencido</Badge>;
  if (s === "agendado") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Agendado</Badge>;
  if (s === "cancelado") return <Badge variant="secondary">Cancelado</Badge>;
  return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200">Aberto</Badge>;
}

function StatusProgBadge({ progStatus, vencido }: { progStatus?: string; vencido: boolean }) {
  if (progStatus === "pendente_aprov") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pendente Aprovação</Badge>;
  if (progStatus === "programado") return <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-violet-200">Programado</Badge>;
  if (vencido) return <Badge variant="destructive">Atrasado</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}
