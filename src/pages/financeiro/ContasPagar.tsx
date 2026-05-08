import { useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/layout/PageHeader";
import { Calendar, FileDown, Send, Building2, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import PreTitulosTab from "./pagar/PreTitulosTab";
import MalotesTab from "./pagar/MalotesTab";
import { Textarea } from "@/components/ui/textarea";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusBadge = (s: string) => {
  const map: Record<string, any> = {
    aberto: { v: "outline", l: "Aberto" },
    parcial: { v: "secondary", l: "Parcial" },
    agendado: { v: "default", l: "Agendado" },
    pago: { v: "default", l: "Pago" },
    vencido: { v: "destructive", l: "Vencido" },
    cancelado: { v: "secondary", l: "Cancelado" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

const remessaBadge = (s: string) => {
  if (s === "enviado") return <Badge variant="default">Em remessa</Badge>;
  if (s === "pago") return <Badge variant="default">Pago</Badge>;
  if (s === "rejeitado") return <Badge variant="destructive">Rejeitado</Badge>;
  return <Badge variant="outline">—</Badge>;
};

export default function ContasPagar() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("titulos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [sel, setSel] = useState<string[]>([]);
  const [openAgendar, setOpenAgendar] = useState<string | null>(null);
  const [openBaixar, setOpenBaixar] = useState<any | null>(null);
  const [openRemessa, setOpenRemessa] = useState(false);

  const { data: titulos = [], isLoading } = useQuery<any[]>({
    queryKey: ["titulo_pagar", filtroStatus],
    queryFn: async () => {
      let q = (supabase as any).from("titulo_pagar")
        .select("*, fornecedor(razao_social)")
        .order("data_vencimento", { ascending: true }).limit(500);
      if (filtroStatus !== "todos") q = q.eq("status", filtroStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: remessas = [] } = useQuery<any[]>({
    queryKey: ["remessa_cnab"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("remessa_cnab")
        .select("*, conta_bancaria(banco_codigo, banco_nome, agencia, conta)")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const ab = titulos.filter((t) => t.status === "aberto").reduce((s, t) => s + Number(t.valor || 0), 0);
    const ag = titulos.filter((t) => t.status === "agendado").reduce((s, t) => s + Number(t.valor || 0), 0);
    const venc = titulos.filter((t) => t.status === "aberto" && new Date(t.data_vencimento) < new Date()).length;
    return { ab, ag, venc, qtd: titulos.length };
  }, [titulos]);

  const toggleSel = (id: string) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const selecionaveis = titulos.filter((t) => ["aberto", "agendado", "parcial"].includes(t.status) && t.remessa_status !== "enviado");

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Títulos auto-gerados das NFs lançadas, agendamento e remessa CNAB 240"
        module="Financeiro"
        breadcrumb={["Contas a Pagar"]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total títulos</CardDescription><CardTitle className="text-3xl">{kpis.qtd}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>A pagar (aberto)</CardDescription><CardTitle className="text-2xl">{fmtMoney(kpis.ab)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Agendado</CardDescription><CardTitle className="text-2xl">{fmtMoney(kpis.ag)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Vencidos</CardDescription><CardTitle className="text-3xl text-destructive">{kpis.venc}</CardTitle></CardHeader></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pre">Pré-títulos</TabsTrigger>
          <TabsTrigger value="titulos">Títulos</TabsTrigger>
          <TabsTrigger value="malotes">Malotes</TabsTrigger>
          <TabsTrigger value="remessas">Remessas CNAB</TabsTrigger>
        </TabsList>

        <TabsContent value="pre"><PreTitulosTab /></TabsContent>
        <TabsContent value="malotes"><MalotesTab /></TabsContent>

        <TabsContent value="titulos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Label>Status:</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
                {sel.length > 0 && <Badge variant="secondary">{sel.length} selecionado(s)</Badge>}
              </div>
              <div className="flex gap-2">
                <Button disabled={sel.length === 0} onClick={() => setOpenRemessa(true)}>
                  <Send className="h-4 w-4 mr-2" />Gerar remessa CNAB 240
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remessa</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {titulos.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum título</TableCell></TableRow>}
                    {titulos.map((t) => {
                      const podeSel = ["aberto", "agendado", "parcial"].includes(t.status) && t.remessa_status !== "enviado";
                      const vencido = t.status === "aberto" && new Date(t.data_vencimento) < new Date();
                      return (
                        <TableRow key={t.id} className={vencido ? "bg-destructive/5" : ""}>
                          <TableCell>{podeSel && <Checkbox checked={sel.includes(t.id)} onCheckedChange={() => toggleSel(t.id)} />}</TableCell>
                          <TableCell className="font-mono text-xs">{t.numero_documento}</TableCell>
                          <TableCell>{t.fornecedor?.razao_social ?? "—"}</TableCell>
                          <TableCell>{t.parcela_num}/{t.parcela_total}</TableCell>
                          <TableCell>{fmtDate(t.data_vencimento)}{t.data_agendamento && <div className="text-xs text-muted-foreground"><Clock className="inline h-3 w-3" /> {fmtDate(t.data_agendamento)}</div>}</TableCell>
                          <TableCell className="text-right">{fmtMoney(t.valor)}</TableCell>
                          <TableCell>{statusBadge(t.status)}</TableCell>
                          <TableCell>{remessaBadge(t.remessa_status)}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {podeSel && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setOpenAgendar(t.id)}>
                                  <Calendar className="h-4 w-4 mr-1" />Agendar
                                </Button>
                                <Button size="sm" onClick={() => setOpenBaixar(t)}>
                                  <DollarSign className="h-4 w-4 mr-1" />Baixar
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remessas">
          <Card>
            <CardHeader><CardTitle>Remessas CNAB 240</CardTitle><CardDescription>Arquivos gerados para envio aos bancos</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Sequência</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Qtd / Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remessas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma remessa</TableCell></TableRow>}
                  {remessas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                      <TableCell>{r.conta_bancaria?.banco_codigo} — {r.conta_bancaria?.banco_nome}</TableCell>
                      <TableCell>#{r.sequencia_arquivo}</TableCell>
                      <TableCell>{fmtDate(r.data_geracao)}</TableCell>
                      <TableCell className="text-right">{r.qtd_titulos} / {fmtMoney(r.valor_total)}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => baixarArquivo(r.arquivo_nome, r.arquivo_conteudo)}>
                          <FileDown className="h-4 w-4 mr-1" />Baixar .REM
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {openAgendar && <AgendarDialog tituloId={openAgendar} onClose={() => { setOpenAgendar(null); qc.invalidateQueries({ queryKey: ["titulo_pagar"] }); }} />}
      {openRemessa && <RemessaDialog tituloIds={sel} onClose={(ok) => { setOpenRemessa(false); if (ok) { setSel([]); qc.invalidateQueries({ queryKey: ["titulo_pagar"] }); qc.invalidateQueries({ queryKey: ["remessa_cnab"] }); setTab("remessas"); } }} />}
    </div>
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

function AgendarDialog({ tituloId, onClose }: { tituloId: string; onClose: () => void }) {
  const [contaId, setContaId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("boleto");

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-ativas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta, ativa")
        .eq("ativa", true).order("banco_nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const agendar = useMutation({
    mutationFn: async () => {
      if (!contaId) throw new Error("Selecione a conta bancária");
      const { error } = await (supabase as any).rpc("titulo_agendar", {
        _titulo_id: tituloId,
        _conta_bancaria_id: contaId,
        _data_pgto: data,
        _forma: forma,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Título agendado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar pagamento</DialogTitle>
          <DialogDescription>Defina conta, data e forma de pagamento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome} ag {c.agencia}/{c.conta}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Data prevista</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div>
            <Label>Forma</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="debito_automatico">Débito automático</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => agendar.mutate()} disabled={agendar.isPending}>Agendar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemessaDialog({ tituloIds, onClose }: { tituloIds: string[]; onClose: (ok: boolean) => void }) {
  const [contaId, setContaId] = useState("");
  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-cnab"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta, cnab_convenio, cnab_codigo_empresa, cnab_proxima_sequencia, ativa")
        .eq("ativa", true).order("banco_nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const conta = contas.find((c) => c.id === contaId);

  const gerar = useMutation({
    mutationFn: async () => {
      if (!contaId) throw new Error("Selecione a conta bancária");
      const { data, error } = await (supabase as any).rpc("cnab_gerar_remessa", {
        _conta_bancaria_id: contaId,
        _titulo_ids: tituloIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Remessa ${d.numero} gerada — ${d.qtd_titulos} títulos, ${fmtMoney(d.valor_total)}`);
      // baixa arquivo automaticamente
      if (d.arquivo_nome) {
        // busca o conteúdo
        (supabase as any).from("remessa_cnab").select("arquivo_nome, arquivo_conteudo").eq("id", d.remessa_id).single()
          .then(({ data: r }: any) => { if (r?.arquivo_conteudo) baixarArquivo(r.arquivo_nome, r.arquivo_conteudo); });
      }
      onClose(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar remessa CNAB 240</DialogTitle>
          <DialogDescription>{tituloIds.length} título(s) selecionado(s).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={!c.cnab_convenio || !c.cnab_codigo_empresa}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {c.banco_codigo} — {c.banco_nome} ag {c.agencia}/{c.conta}
                      {(!c.cnab_convenio || !c.cnab_codigo_empresa) && <span className="text-xs text-destructive">(CNAB não configurado)</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {conta && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p>Convênio: <strong>{conta.cnab_convenio || "—"}</strong></p>
              <p>Código empresa: <strong>{conta.cnab_codigo_empresa || "—"}</strong></p>
              <p>Próxima sequência: <strong>#{conta.cnab_proxima_sequencia}</strong></p>
              {(!conta.cnab_convenio || !conta.cnab_codigo_empresa) && (
                <p className="text-destructive mt-1">⚠ Configure os dados CNAB em Cadastros &gt; Contas Bancárias antes de gerar.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => gerar.mutate()} disabled={gerar.isPending || !conta?.cnab_convenio}>
            <Send className="h-4 w-4 mr-2" />Gerar arquivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
