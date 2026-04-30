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
import { Textarea } from "@/components/ui/textarea";
import { ArrowDownToLine, AlertTriangle, Search, Filter, FileText } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const statusBadge = (s: string) => {
  const map: Record<string, any> = {
    aberto: { v: "outline", l: "Aberto" },
    parcial: { v: "secondary", l: "Parcial" },
    pago: { v: "default", l: "Recebido" },
    vencido: { v: "destructive", l: "Vencido" },
    cancelado: { v: "secondary", l: "Cancelado" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

const meioBadge = (m: string) => {
  const map: Record<string, string> = { boleto: "🧾 Boleto", pix: "📱 PIX", ted: "🏦 TED", dinheiro: "💵", deposito: "🏧", cartao: "💳", outro: "•" };
  return <Badge variant="outline" className="font-mono text-xs">{map[m] ?? m}</Badge>;
};

export default function TitulosReceberTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [openBaixa, setOpenBaixa] = useState<any | null>(null);

  const { data: titulos = [], isLoading } = useQuery<any[]>({
    queryKey: ["titulo_receber", filtro],
    queryFn: async () => {
      let q = (supabase as any).from("titulo_receber")
        .select("*, contrato(numero, orgao)")
        .order("data_vencimento", { ascending: true })
        .limit(500);
      if (filtro !== "todos") q = q.eq("status", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    if (!busca) return titulos;
    const b = busca.toLowerCase();
    return titulos.filter(
      (t) =>
        (t.numero ?? t.numero_documento ?? "").toLowerCase().includes(b) ||
        (t.sacado_nome ?? t.cliente_nome ?? "").toLowerCase().includes(b) ||
        (t.contrato?.numero ?? "").toLowerCase().includes(b),
    );
  }, [titulos, busca]);

  const kpis = useMemo(() => {
    const ab = titulos.filter((t) => t.status === "aberto" || t.status === "parcial").reduce((s, t) => s + (Number(t.valor) - Number(t.valor_recebido || 0)), 0);
    const venc = titulos.filter((t) => (t.status === "aberto" || t.status === "parcial") && new Date(t.data_vencimento) < new Date());
    const pg = titulos.filter((t) => t.status === "pago").reduce((s, t) => s + Number(t.valor_recebido || 0), 0);
    const vencValor = venc.reduce((s, t) => s + (Number(t.valor) - Number(t.valor_recebido || 0)), 0);
    return { ab, vencCount: venc.length, vencValor, pg, qtd: titulos.length };
  }, [titulos]);

  const marcarVencidos = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("titulo_receber_marcar_vencidos");
      if (error) throw error;
      return data;
    },
    onSuccess: (n: any) => {
      toast.success(`${n} título(s) marcado(s) como vencido(s)`);
      qc.invalidateQueries({ queryKey: ["titulo_receber"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total títulos</CardDescription>
            <CardTitle className="text-3xl">{kpis.qtd}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>A receber</CardDescription>
            <CardTitle className="text-2xl">{fmtMoney(kpis.ab)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive">Vencidos</CardDescription>
            <CardTitle className="text-2xl text-destructive">{fmtMoney(kpis.vencValor)}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{kpis.vencCount} título(s)</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recebido (mês)</CardDescription>
            <CardTitle className="text-2xl">{fmtMoney(kpis.pg)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar título, sacado, contrato..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 w-72" />
            </div>
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pago">Recebidos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => marcarVencidos.mutate()}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Atualizar vencidos
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Sacado</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead>Meio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum título encontrado
                    </TableCell></TableRow>
                  )}
                  {filtrados.map((t) => {
                    const vencido = (t.status === "aberto" || t.status === "parcial") && new Date(t.data_vencimento) < new Date();
                    const saldo = Number(t.valor) - Number(t.valor_recebido || 0);
                    return (
                      <TableRow key={t.id} className={vencido ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-xs">{t.numero ?? t.numero_documento}</TableCell>
                        <TableCell className="font-medium">{t.sacado_nome ?? t.cliente_nome}</TableCell>
                        <TableCell className="text-xs">
                          {t.contrato ? <span>{t.contrato.numero}<br /><span className="text-muted-foreground">{t.contrato.orgao}</span></span> : "—"}
                        </TableCell>
                        <TableCell>{fmtDate(t.data_vencimento)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(t.valor)}</TableCell>
                        <TableCell className="text-right">
                          {Number(t.valor_recebido) > 0 ? fmtMoney(t.valor_recebido) : "—"}
                          {saldo > 0 && Number(t.valor_recebido) > 0 && <div className="text-xs text-muted-foreground">saldo {fmtMoney(saldo)}</div>}
                        </TableCell>
                        <TableCell>{meioBadge(t.meio_cobranca)}</TableCell>
                        <TableCell>{statusBadge(t.status)}</TableCell>
                        <TableCell className="text-right">
                          {!["pago", "cancelado"].includes(t.status) && (
                            <Button size="sm" variant="outline" onClick={() => setOpenBaixa(t)}>
                              <ArrowDownToLine className="h-4 w-4 mr-1" /> Baixar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {openBaixa && <BaixaDialog titulo={openBaixa} onClose={(ok) => { setOpenBaixa(null); if (ok) qc.invalidateQueries({ queryKey: ["titulo_receber"] }); }} />}
    </div>
  );
}

function BaixaDialog({ titulo, onClose }: { titulo: any; onClose: (ok: boolean) => void }) {
  const saldo = Number(titulo.valor) - Number(titulo.valor_recebido || 0);
  const [valor, setValor] = useState(saldo.toFixed(2));
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [meio, setMeio] = useState<string>(titulo.meio_cobranca ?? "boleto");
  const [contaId, setContaId] = useState<string>("");
  const [juros, setJuros] = useState("0");
  const [multa, setMulta] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [obs, setObs] = useState("");

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-ativas-cr"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta")
        .eq("ativa", true).order("banco_nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const baixar = useMutation({
    mutationFn: async () => {
      const v = Number(valor);
      if (!v || v <= 0) throw new Error("Informe um valor válido");
      const { data, error } = await (supabase as any).rpc("titulo_baixar", {
        _titulo_id: titulo.id,
        _valor: v,
        _data_baixa: data,
        _meio: meio,
        _conta_bancaria_id: contaId || null,
        _juros: Number(juros) || 0,
        _multa: Number(multa) || 0,
        _desconto: Number(desconto) || 0,
        _observacoes: obs || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Baixa registrada"); onClose(true); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Baixar título {titulo.numero ?? titulo.numero_documento}</DialogTitle>
          <DialogDescription>
            {titulo.sacado_nome} • Saldo: <strong>{fmtMoney(saldo)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Valor recebido</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div>
            <Label>Meio</Label>
            <Select value={meio} onValueChange={setMeio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="deposito">Depósito</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome} {c.agencia}/{c.conta}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Juros</Label><Input type="number" step="0.01" value={juros} onChange={(e) => setJuros(e.target.value)} /></div>
          <div><Label>Multa</Label><Input type="number" step="0.01" value={multa} onChange={(e) => setMulta(e.target.value)} /></div>
          <div className="col-span-2"><Label>Desconto</Label><Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => baixar.mutate()} disabled={baixar.isPending}>Confirmar baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
