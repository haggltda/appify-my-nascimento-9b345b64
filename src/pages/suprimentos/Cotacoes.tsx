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
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { Trophy, Plus, Calculator, FileSpreadsheet, Eye, Trash2, Send, Building2 } from "lucide-react";
import { toast } from "sonner";

const statusBadge = (s: string) => {
  const map: Record<string, { v: any; l: string }> = {
    rascunho: { v: "outline", l: "Rascunho" },
    aberta: { v: "default", l: "Aberta" },
    em_analise: { v: "secondary", l: "Em análise" },
    fechada: { v: "default", l: "Fechada" },
    cancelada: { v: "destructive", l: "Cancelada" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

const fornStatusBadge = (s: string) => {
  const map: Record<string, any> = {
    convidado: { v: "outline", l: "Convidado" },
    respondeu: { v: "secondary", l: "Respondeu" },
    recusou: { v: "destructive", l: "Recusou" },
    vencedor: { v: "default", l: "🏆 Vencedor" },
    perdedor: { v: "outline", l: "Perdedor" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

const fmtMoney = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export default function Cotacoes() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("lista");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [openNova, setOpenNova] = useState(false);
  const [openMapa, setOpenMapa] = useState<string | null>(null);

  const { data: empresa } = useQuery({
    queryKey: ["minha-empresa"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await (supabase as any).from("profiles").select("empresa_id").eq("id", u.user.id).maybeSingle();
      return data?.empresa_id ?? null;
    },
  });

  const { data: cotacoes = [], isLoading } = useQuery<any[]>({
    queryKey: ["cotacoes", filtroStatus],
    queryFn: async () => {
      let q = (supabase as any).from("cotacao")
        .select("*, fornecedor:vencedor_fornecedor_id(razao_social)")
        .order("created_at", { ascending: false }).limit(200);
      if (filtroStatus !== "todos") q = q.eq("status", filtroStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: parametros } = useQuery({
    queryKey: ["parametro_cotacao", empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data } = await (supabase as any).from("parametro_cotacao")
        .select("*").eq("empresa_id", empresa).maybeSingle();
      return data;
    },
  });

  const kpis = useMemo(() => {
    const ab = cotacoes.filter((c) => ["aberta", "em_analise"].includes(c.status)).length;
    const fc = cotacoes.filter((c) => c.status === "fechada").length;
    const ras = cotacoes.filter((c) => c.status === "rascunho").length;
    return { ab, fc, ras, tot: cotacoes.length };
  }, [cotacoes]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Cotações de Fornecedores"
        description="RFQ, mapa comparativo com score ponderado e geração automática de Pedido de Compra"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle className="text-3xl">{kpis.tot}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Rascunhos</CardDescription><CardTitle className="text-3xl">{kpis.ras}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Em andamento</CardDescription><CardTitle className="text-3xl">{kpis.ab}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Fechadas</CardDescription><CardTitle className="text-3xl">{kpis.fc}</CardTitle></CardHeader></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lista">Cotações</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Label>Status:</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="fechada">Fechada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setOpenNova(true)}><Plus className="h-4 w-4 mr-2" />Nova Cotação</Button>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prazo resposta</TableHead>
                      <TableHead>Vencedor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotacoes.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma cotação encontrada</TableCell></TableRow>
                    )}
                    {cotacoes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono">{c.numero}</TableCell>
                        <TableCell>{c.titulo}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell>{c.prazo_resposta ? new Date(c.prazo_resposta).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>{c.fornecedor?.razao_social ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setOpenMapa(c.id)}>
                            <FileSpreadsheet className="h-4 w-4 mr-1" />Mapa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parametros">
          <ParametrosCard empresa={empresa} parametros={parametros} />
        </TabsContent>
      </Tabs>

      {openNova && <NovaCotacaoDialog empresa={empresa} onClose={() => setOpenNova(false)} onCreated={(id) => { setOpenNova(false); setOpenMapa(id); qc.invalidateQueries({ queryKey: ["cotacoes"] }); }} />}
      {openMapa && <MapaCotacaoDialog cotacaoId={openMapa} onClose={() => { setOpenMapa(null); qc.invalidateQueries({ queryKey: ["cotacoes"] }); }} />}
    </div>
  );
}

// ============================================================
// Parâmetros
// ============================================================
function ParametrosCard({ empresa, parametros }: { empresa: string | null; parametros: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(parametros ?? {
    min_propostas: 3, valor_dispensa: 1000,
    permite_fornecedor_exclusivo: true, permite_emergencia: true,
    peso_preco: 70, peso_prazo_entrega: 15, peso_prazo_pagamento: 15,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!empresa) throw new Error("Empresa não definida");
      const total = Number(form.peso_preco) + Number(form.peso_prazo_entrega) + Number(form.peso_prazo_pagamento);
      if (total !== 100) throw new Error("Pesos devem somar 100");
      const payload = { ...form, empresa_id: empresa };
      const { error } = parametros?.id
        ? await (supabase as any).from("parametro_cotacao").update(payload).eq("id", parametros.id)
        : await (supabase as any).from("parametro_cotacao").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parâmetros salvos"); qc.invalidateQueries({ queryKey: ["parametro_cotacao"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros de Cotação</CardTitle>
        <CardDescription>Mínimo de propostas, valor de dispensa e pesos do score ponderado</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Mínimo de propostas</Label><Input type="number" value={form.min_propostas} onChange={(e) => setForm({ ...form, min_propostas: +e.target.value })} /></div>
        <div><Label>Valor de dispensa (R$)</Label><Input type="number" step="0.01" value={form.valor_dispensa} onChange={(e) => setForm({ ...form, valor_dispensa: +e.target.value })} /></div>
        <div><Label>Peso preço (%)</Label><Input type="number" value={form.peso_preco} onChange={(e) => setForm({ ...form, peso_preco: +e.target.value })} /></div>
        <div><Label>Peso prazo entrega (%)</Label><Input type="number" value={form.peso_prazo_entrega} onChange={(e) => setForm({ ...form, peso_prazo_entrega: +e.target.value })} /></div>
        <div><Label>Peso prazo pagamento (%)</Label><Input type="number" value={form.peso_prazo_pagamento} onChange={(e) => setForm({ ...form, peso_prazo_pagamento: +e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar parâmetros</Button>
        </div>
        <p className="md:col-span-2 text-xs text-muted-foreground">
          A soma dos pesos deve ser exatamente 100. Cotações com menos propostas que o mínimo só fecham com justificativa de dispensa
          (fornecedor exclusivo, emergência, valor baixo ou outro), exceto quando o valor é menor que o limite de dispensa.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Nova cotação
// ============================================================
function NovaCotacaoDialog({ empresa, onClose, onCreated }: { empresa: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      if (!empresa) throw new Error("Empresa não definida no perfil");
      if (!titulo.trim()) throw new Error("Informe um título");
      const { data, error } = await (supabase as any).from("cotacao").insert({
        empresa_id: empresa, titulo, descricao,
        prazo_resposta: prazo || null, status: "rascunho",
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Cotação criada"); onCreated(id); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Cotação</DialogTitle>
          <DialogDescription>Crie a cotação e em seguida adicione itens, fornecedores e propostas no mapa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Título *</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Aquisição EPIs - Contrato XPTO" /></div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div><Label>Prazo de resposta</Label><Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Mapa de cotação
// ============================================================
function MapaCotacaoDialog({ cotacaoId, onClose }: { cotacaoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("itens");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddForn, setShowAddForn] = useState(false);
  const [editProposta, setEditProposta] = useState<string | null>(null);
  const [showFechar, setShowFechar] = useState(false);

  const { data: cot } = useQuery<any>({
    queryKey: ["cotacao", cotacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cotacao").select("*").eq("id", cotacaoId).single();
      if (error) throw error; return data;
    },
  });

  const { data: itens = [] } = useQuery<any[]>({
    queryKey: ["cotacao_item", cotacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cotacao_item")
        .select("*").eq("cotacao_id", cotacaoId).order("ordem");
      if (error) throw error; return data ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery<any[]>({
    queryKey: ["cotacao_fornecedor", cotacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cotacao_fornecedor")
        .select("*, fornecedor(id, razao_social, cnpj)")
        .eq("cotacao_id", cotacaoId);
      if (error) throw error; return data ?? [];
    },
  });

  const { data: propostas = [] } = useQuery<any[]>({
    queryKey: ["cotacao_proposta", cotacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cotacao_proposta")
        .select("*, fornecedor(razao_social), itens:cotacao_proposta_item(*)")
        .eq("cotacao_id", cotacaoId).order("ranking", { ascending: true, nullsFirst: false });
      if (error) throw error; return data ?? [];
    },
  });

  const calcularScore = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("cotacao_calcular_score", { _cotacao_id: cotacaoId });
      if (error) throw error; return data;
    },
    onSuccess: (d: any) => { toast.success(`Score recalculado (${d?.propostas_avaliadas ?? 0} propostas)`); qc.invalidateQueries({ queryKey: ["cotacao_proposta", cotacaoId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const fechado = cot?.status === "fechada";
  const numFornecedoresValidos = propostas.filter((p) => Number(p.valor_total) > 0).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cot?.numero} — {cot?.titulo} {cot && statusBadge(cot.status)}
          </DialogTitle>
          <DialogDescription>{cot?.descricao}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
            <TabsTrigger value="fornecedores">Fornecedores ({fornecedores.length})</TabsTrigger>
            <TabsTrigger value="propostas">Propostas ({propostas.length})</TabsTrigger>
            <TabsTrigger value="mapa">📊 Mapa Comparativo</TabsTrigger>
          </TabsList>

          {/* ITENS */}
          <TabsContent value="itens" className="space-y-3">
            {!fechado && <Button size="sm" onClick={() => setShowAddItem(true)}><Plus className="h-4 w-4 mr-1" />Item</Button>}
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Descrição</TableHead><TableHead>Un</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {itens.map((it, i) => (
                  <TableRow key={it.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{it.descricao}</TableCell>
                    <TableCell>{it.unidade ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(it.quantidade).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      {!fechado && <Button size="icon" variant="ghost" onClick={async () => {
                        await (supabase as any).from("cotacao_item").delete().eq("id", it.id);
                        qc.invalidateQueries({ queryKey: ["cotacao_item", cotacaoId] });
                      }}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {itens.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Adicione itens à cotação</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          {/* FORNECEDORES */}
          <TabsContent value="fornecedores" className="space-y-3">
            {!fechado && <Button size="sm" onClick={() => setShowAddForn(true)}><Plus className="h-4 w-4 mr-1" />Convidar fornecedor</Button>}
            <Table>
              <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>CNPJ</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {fornecedores.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.fornecedor?.razao_social}</TableCell>
                    <TableCell className="font-mono text-xs">{f.fornecedor?.cnpj}</TableCell>
                    <TableCell>{fornStatusBadge(f.status)}</TableCell>
                    <TableCell className="text-right">
                      {!fechado && <Button size="icon" variant="ghost" onClick={async () => {
                        await (supabase as any).from("cotacao_fornecedor").delete().eq("id", f.id);
                        qc.invalidateQueries({ queryKey: ["cotacao_fornecedor", cotacaoId] });
                        qc.invalidateQueries({ queryKey: ["cotacao_proposta", cotacaoId] });
                      }}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {fornecedores.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Convide fornecedores</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          {/* PROPOSTAS */}
          <TabsContent value="propostas" className="space-y-3">
            <p className="text-sm text-muted-foreground">Registre/edite a proposta recebida de cada fornecedor convidado.</p>
            <Table>
              <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead className="text-right">Frete</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Prazo entrega</TableHead><TableHead>Prazo pgto</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {fornecedores.map((f) => {
                  const p = propostas.find((x) => x.fornecedor_id === f.fornecedor_id);
                  return (
                    <TableRow key={f.id}>
                      <TableCell><div className="flex items-center gap-2"><Building2 className="h-4 w-4" />{f.fornecedor?.razao_social}</div></TableCell>
                      <TableCell className="text-right">{p ? fmtMoney(p.valor_frete) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{p ? fmtMoney(p.valor_total) : "—"}</TableCell>
                      <TableCell>{p?.prazo_entrega_dias ? `${p.prazo_entrega_dias} dias` : "—"}</TableCell>
                      <TableCell>{p?.prazo_pagamento_dias ? `${p.prazo_pagamento_dias} dias` : "—"}</TableCell>
                      <TableCell className="text-right">
                        {!fechado && <Button size="sm" variant="outline" onClick={() => setEditProposta(f.fornecedor_id)}>{p ? "Editar" : "Lançar"}</Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          {/* MAPA */}
          <TabsContent value="mapa" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Score ponderado por preço, prazo de entrega e prazo de pagamento.</p>
              {!fechado && <Button size="sm" onClick={() => calcularScore.mutate()} disabled={calcularScore.isPending}>
                <Calculator className="h-4 w-4 mr-1" />Recalcular score
              </Button>}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Pgto</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sem propostas</TableCell></TableRow>}
                {propostas.map((p) => (
                  <TableRow key={p.id} className={p.ranking === 1 ? "bg-primary/5" : ""}>
                    <TableCell>{p.ranking ?? "—"}{p.ranking === 1 && <Trophy className="inline h-4 w-4 ml-1 text-yellow-500" />}</TableCell>
                    <TableCell>{p.fornecedor?.razao_social}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(p.valor_total)}</TableCell>
                    <TableCell>{p.prazo_entrega_dias ? `${p.prazo_entrega_dias}d` : "—"}</TableCell>
                    <TableCell>{p.prazo_pagamento_dias ? `${p.prazo_pagamento_dias}d` : "—"}</TableCell>
                    <TableCell className="text-right"><Badge variant={p.ranking === 1 ? "default" : "outline"}>{p.score ?? "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!fechado && propostas.length > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setShowFechar(true)}>
                  <Send className="h-4 w-4 mr-2" />Fechar cotação e gerar PC
                </Button>
              </div>
            )}

            {cot?.status === "fechada" && cot.pedido_compra_ids?.length > 0 && (
              <div className="rounded-md border p-4 bg-primary/5">
                <p className="text-sm font-medium">✅ Cotação fechada — Pedido(s) gerado(s):</p>
                <p className="font-mono text-xs mt-1">{cot.pedido_compra_ids.join(", ")}</p>
                {cot.justificativa_dispensa && <p className="text-xs text-muted-foreground mt-2">Dispensa: <strong>{cot.motivo_dispensa}</strong> — {cot.justificativa_dispensa}</p>}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>

        {showAddItem && <AddItemDialog cotacaoId={cotacaoId} onClose={() => { setShowAddItem(false); qc.invalidateQueries({ queryKey: ["cotacao_item", cotacaoId] }); }} ordem={itens.length + 1} />}
        {showAddForn && <AddFornecedorDialog cotacaoId={cotacaoId} jaConvidados={fornecedores.map((f) => f.fornecedor_id)} onClose={() => { setShowAddForn(false); qc.invalidateQueries({ queryKey: ["cotacao_fornecedor", cotacaoId] }); }} />}
        {editProposta && <PropostaDialog cotacaoId={cotacaoId} fornecedorId={editProposta} itens={itens} fornecedores={fornecedores} propostaExistente={propostas.find((p) => p.fornecedor_id === editProposta)} onClose={() => { setEditProposta(null); qc.invalidateQueries({ queryKey: ["cotacao_proposta", cotacaoId] }); }} />}
        {showFechar && <FecharDialog cotacaoId={cotacaoId} propostas={propostas} numValidas={numFornecedoresValidos} onClose={() => setShowFechar(false)} onDone={() => { setShowFechar(false); qc.invalidateQueries({ queryKey: ["cotacao", cotacaoId] }); qc.invalidateQueries({ queryKey: ["cotacao_proposta", cotacaoId] }); qc.invalidateQueries({ queryKey: ["cotacoes"] }); }} />}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Sub-diálogos
// ============================================================
function AddItemDialog({ cotacaoId, ordem, onClose }: { cotacaoId: string; ordem: number; onClose: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [quantidade, setQuantidade] = useState(1);
  const salvar = useMutation({
    mutationFn: async () => {
      if (!descricao.trim()) throw new Error("Informe a descrição");
      const { error } = await (supabase as any).from("cotacao_item").insert({
        cotacao_id: cotacaoId, descricao, unidade, quantidade, ordem,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Item adicionado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Descrição *</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} /></div>
            <div><Label>Quantidade</Label><Input type="number" step="0.0001" value={quantidade} onChange={(e) => setQuantidade(+e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Adicionar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddFornecedorDialog({ cotacaoId, jaConvidados, onClose }: { cotacaoId: string; jaConvidados: string[]; onClose: () => void }) {
  const [sel, setSel] = useState("");
  const { data: forns = [] } = useQuery<any[]>({
    queryKey: ["fornecedores-disponiveis"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("fornecedor").select("id, razao_social, cnpj").order("razao_social").limit(500);
      if (error) throw error; return data ?? [];
    },
  });
  const disponiveis = forns.filter((f) => !jaConvidados.includes(f.id));
  const salvar = useMutation({
    mutationFn: async () => {
      if (!sel) throw new Error("Selecione um fornecedor");
      const { error } = await (supabase as any).from("cotacao_fornecedor").insert({
        cotacao_id: cotacaoId, fornecedor_id: sel, status: "convidado",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fornecedor convidado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar fornecedor</DialogTitle></DialogHeader>
        <div>
          <Label>Fornecedor</Label>
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {disponiveis.map((f) => <SelectItem key={f.id} value={f.id}>{f.razao_social} {f.cnpj ? `(${f.cnpj})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Convidar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PropostaDialog({ cotacaoId, fornecedorId, itens, fornecedores, propostaExistente, onClose }: any) {
  const cf = fornecedores.find((f: any) => f.fornecedor_id === fornecedorId);
  const [frete, setFrete] = useState(propostaExistente?.valor_frete ?? 0);
  const [prazoE, setPrazoE] = useState(propostaExistente?.prazo_entrega_dias ?? "");
  const [prazoP, setPrazoP] = useState(propostaExistente?.prazo_pagamento_dias ?? "");
  const [obs, setObs] = useState(propostaExistente?.observacoes ?? "");
  const [precos, setPrecos] = useState<Record<string, { preco: number; ipi: number; desc: number }>>(() => {
    const m: any = {};
    itens.forEach((it: any) => {
      const ex = propostaExistente?.itens?.find((pi: any) => pi.cotacao_item_id === it.id);
      m[it.id] = { preco: Number(ex?.preco_unitario ?? 0), ipi: Number(ex?.ipi_pct ?? 0), desc: Number(ex?.desconto_pct ?? 0) };
    });
    return m;
  });

  const salvar = useMutation({
    mutationFn: async () => {
      let propostaId = propostaExistente?.id;
      if (!propostaId) {
        const { data, error } = await (supabase as any).from("cotacao_proposta").insert({
          cotacao_id: cotacaoId, cotacao_fornecedor_id: cf.id, fornecedor_id: fornecedorId,
          valor_frete: frete, prazo_entrega_dias: prazoE || null, prazo_pagamento_dias: prazoP || null, observacoes: obs,
        }).select("id").single();
        if (error) throw error;
        propostaId = data.id;
      } else {
        const { error } = await (supabase as any).from("cotacao_proposta").update({
          valor_frete: frete, prazo_entrega_dias: prazoE || null, prazo_pagamento_dias: prazoP || null, observacoes: obs,
        }).eq("id", propostaId);
        if (error) throw error;
      }
      // upsert itens
      for (const it of itens) {
        const p = precos[it.id];
        const existe = propostaExistente?.itens?.find((pi: any) => pi.cotacao_item_id === it.id);
        if (existe) {
          await (supabase as any).from("cotacao_proposta_item").update({
            preco_unitario: p.preco, ipi_pct: p.ipi, desconto_pct: p.desc,
          }).eq("id", existe.id);
        } else {
          await (supabase as any).from("cotacao_proposta_item").insert({
            proposta_id: propostaId, cotacao_item_id: it.id,
            preco_unitario: p.preco, ipi_pct: p.ipi, desconto_pct: p.desc,
          });
        }
      }
      // marca fornecedor como respondido
      await (supabase as any).from("cotacao_fornecedor").update({ status: "respondeu", respondido_em: new Date().toISOString() }).eq("id", cf.id);
    },
    onSuccess: () => { toast.success("Proposta salva"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposta — {cf?.fornecedor?.razao_social}</DialogTitle>
          <DialogDescription>Preencha preço unitário por item, frete e prazos.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="w-32">Preço unit.</TableHead><TableHead className="w-24">IPI %</TableHead><TableHead className="w-24">Desc %</TableHead></TableRow></TableHeader>
          <TableBody>
            {itens.map((it: any) => (
              <TableRow key={it.id}>
                <TableCell>{it.descricao}</TableCell>
                <TableCell className="text-right">{Number(it.quantidade).toLocaleString("pt-BR")}</TableCell>
                <TableCell><Input type="number" step="0.0001" value={precos[it.id].preco} onChange={(e) => setPrecos({ ...precos, [it.id]: { ...precos[it.id], preco: +e.target.value } })} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={precos[it.id].ipi} onChange={(e) => setPrecos({ ...precos, [it.id]: { ...precos[it.id], ipi: +e.target.value } })} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={precos[it.id].desc} onChange={(e) => setPrecos({ ...precos, [it.id]: { ...precos[it.id], desc: +e.target.value } })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Frete (R$)</Label><Input type="number" step="0.01" value={frete} onChange={(e) => setFrete(+e.target.value)} /></div>
          <div><Label>Prazo entrega (dias)</Label><Input type="number" value={prazoE} onChange={(e) => setPrazoE(e.target.value)} /></div>
          <div><Label>Prazo pagamento (dias)</Label><Input type="number" value={prazoP} onChange={(e) => setPrazoP(e.target.value)} /></div>
          <div className="col-span-3"><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar proposta</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FecharDialog({ cotacaoId, propostas, numValidas, onClose, onDone }: any) {
  const ranking1 = propostas.find((p: any) => p.ranking === 1);
  const [vencedor, setVencedor] = useState(ranking1?.fornecedor_id ?? "");
  const [motivo, setMotivo] = useState("");
  const [justif, setJustif] = useState("");

  const fechar = useMutation({
    mutationFn: async () => {
      if (!vencedor) throw new Error("Selecione o vencedor");
      const { data, error } = await (supabase as any).rpc("cotacao_fechar", {
        _cotacao_id: cotacaoId,
        _vencedor_fornecedor_id: vencedor,
        _motivo_dispensa: motivo || null,
        _justificativa: justif || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => { toast.success(`Cotação fechada. PC ${d?.pedido_compra_numero} criado.`); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar cotação e gerar Pedido de Compra</DialogTitle>
          <DialogDescription>{numValidas} proposta(s) válida(s). Confirme o vencedor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fornecedor vencedor</Label>
            <Select value={vencedor} onValueChange={setVencedor}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {propostas.filter((p: any) => Number(p.valor_total) > 0).map((p: any) => (
                  <SelectItem key={p.id} value={p.fornecedor_id}>
                    {p.ranking === 1 ? "🏆 " : ""}{p.fornecedor?.razao_social} — {fmtMoney(p.valor_total)} (score {p.score ?? "—"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {numValidas < 3 && (
            <>
              <p className="text-sm text-amber-600">⚠️ Menos de 3 propostas. Se valor &gt; limite de dispensa, é necessário motivo + justificativa.</p>
              <div>
                <Label>Motivo de dispensa</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger><SelectValue placeholder="Selecione (se aplicável)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fornecedor_exclusivo">Fornecedor exclusivo</SelectItem>
                    <SelectItem value="emergencia">Emergência</SelectItem>
                    <SelectItem value="valor_baixo">Valor baixo</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Justificativa (mín 10 caracteres)</Label><Textarea value={justif} onChange={(e) => setJustif(e.target.value)} /></div>
            </>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => fechar.mutate()} disabled={fechar.isPending}>Fechar e gerar PC</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
