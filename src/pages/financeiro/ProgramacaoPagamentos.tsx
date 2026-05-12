import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Send, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

type TituloSel = {
  id: string; numero_documento: string; data_vencimento: string;
  valor: number; fornecedor?: { razao_social?: string };
};

export default function ProgramacaoPagamentos() {
  const navigate = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const incoming: TituloSel[] = (loc.state as any)?.titulosSelecionados ?? [];
  const periodoIni = (loc.state as any)?.periodoIni ?? null;
  const periodoFim = (loc.state as any)?.periodoFim ?? null;

  const [programacaoId, setProgramacaoId] = useState<string | null>(null);
  const [titulos, setTitulos] = useState<TituloSel[]>(incoming);
  const [dataPgto, setDataPgto] = useState<string>(new Date().toISOString().slice(0, 10));
  const [contaId, setContaId] = useState<string>("");
  const [prioridade, setPrioridade] = useState<string>("normal");
  const [urgencia, setUrgencia] = useState(false);
  const [excecao, setExcecao] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [decisaoJustif, setDecisaoJustif] = useState("");

  useEffect(() => {
    if (incoming.length === 0 && !programacaoId) {
      // permite abrir vazia também
    }
  }, []);

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_bancaria_prog"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta").eq("ativa", true).order("banco_nome");
      return data ?? [];
    },
  });

  // Carrega programação existente (se programacaoId set)
  const { data: prog, refetch: refetchProg } = useQuery<any>({
    enabled: !!programacaoId,
    queryKey: ["malote_pagamento", programacaoId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("malote_pagamento").select("*").eq("id", programacaoId).single();
      return data;
    },
  });

  const { data: itens = [] } = useQuery<any[]>({
    enabled: !!programacaoId,
    queryKey: ["malote_titulo", programacaoId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("malote_titulo")
        .select("*, titulo_pagar(numero_documento, valor, data_vencimento, status, fornecedor(razao_social))")
        .eq("malote_id", programacaoId).order("ordem");
      return data ?? [];
    },
  });

  const { data: aprovacoes = [], refetch: refetchAprov } = useQuery<any[]>({
    enabled: !!programacaoId,
    queryKey: ["fpa", programacaoId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("financeiro_pagamento_aprovacao")
        .select("*").eq("programacao_id", programacaoId).order("etapa");
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery<any[]>({
    enabled: !!programacaoId,
    queryKey: ["fpl", programacaoId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("financeiro_pagamento_log")
        .select("*").eq("programacao_id", programacaoId).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const totaisItens = useMemo(() => {
    const fonte = programacaoId ? itens.map((i: any) => ({
      id: i.titulo_pagar_id,
      valor: Number(i.valor_programado ?? i.titulo_pagar?.valor ?? 0),
      data_vencimento: i.titulo_pagar?.data_vencimento,
      numero_documento: i.titulo_pagar?.numero_documento,
      fornecedor: i.titulo_pagar?.fornecedor,
      status: i.titulo_pagar?.status,
    })) : titulos.map((t) => ({ ...t, valor: Number(t.valor) }));
    const total = fonte.reduce((s: number, t: any) => s + Number(t.valor || 0), 0);
    const venc = fonte.filter((t: any) => t.data_vencimento && new Date(t.data_vencimento) < new Date(dataPgto));
    return { total, qtd: fonte.length, vencidosNaProg: venc.length, fonte };
  }, [itens, titulos, programacaoId, dataPgto]);

  const status = prog?.status ?? "rascunho";
  const aprovStatus = prog?.aprovacao_status ?? "nao_submetida";
  const editavel = !programacaoId || (status === "rascunho" && aprovStatus !== "pendente");

  // Salvar rascunho
  const salvar = useMutation({
    mutationFn: async () => {
      if (!contaId) throw new Error("Selecione a conta bancária prevista");
      if (titulos.length === 0 && !programacaoId) throw new Error("Sem títulos");
      if ((urgencia || excecao) && justificativa.trim().length < 5) throw new Error("Justificativa obrigatória para urgência/exceção");

      if (!programacaoId) {
        const { data: u } = await supabase.auth.getUser();
        const { data: prof } = u.user
          ? await (supabase as any).from("profiles").select("empresa_id").eq("id", u.user.id).single()
          : { data: null };
        const empresa_id = prof?.empresa_id;
        if (!empresa_id) throw new Error("Empresa do usuário não identificada");

        const valorTotal = titulos.reduce((s, t) => s + Number(t.valor || 0), 0);
        const { data: m, error } = await (supabase as any).from("malote_pagamento").insert({
          empresa_id, conta_bancaria_id: contaId, data_pagamento: dataPgto,
          status: "rascunho", qtd_titulos: titulos.length, valor_total: valorTotal,
          prioridade, urgencia, excecao, justificativa: justificativa || null,
          periodo_inicio: periodoIni, periodo_fim: periodoFim,
          observacao: observacao || null, criado_por: u.user?.id ?? null,
          descricao: `Programação ${dataPgto}`,
        }).select("id").single();
        if (error) throw error;

        // adiciona títulos
        const itensIns = titulos.map((t, idx) => ({
          malote_id: m.id, titulo_pagar_id: t.id, ordem: idx + 1,
          valor_programado: Number(t.valor), prioridade,
        }));
        const { error: e2 } = await (supabase as any).from("malote_titulo").insert(itensIns);
        if (e2) throw e2;
        setProgramacaoId(m.id);
        return m.id;
      } else {
        const { error } = await (supabase as any).from("malote_pagamento").update({
          conta_bancaria_id: contaId, data_pagamento: dataPgto,
          prioridade, urgencia, excecao, justificativa: justificativa || null,
          observacao: observacao || null,
        }).eq("id", programacaoId);
        if (error) throw error;
        return programacaoId;
      }
    },
    onSuccess: () => {
      toast.success("Programação salva");
      qc.invalidateQueries({ queryKey: ["malote_pagamento"] });
      qc.invalidateQueries({ queryKey: ["malote_titulo"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submeter = useMutation({
    mutationFn: async () => {
      if (!programacaoId) throw new Error("Salve antes de enviar");
      const { error } = await (supabase as any).rpc("programacao_submeter_aprovacao", { p_programacao_id: programacaoId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Enviado para aprovação"); refetchProg(); refetchAprov(); },
    onError: (e: any) => toast.error(e.message),
  });

  const decidir = useMutation({
    mutationFn: async (decisao: "aprovado" | "rejeitado" | "devolvido") => {
      if (!programacaoId) return;
      if ((decisao === "rejeitado" || decisao === "devolvido") && decisaoJustif.trim().length < 5) {
        throw new Error("Justificativa obrigatória");
      }
      const { error } = await (supabase as any).rpc("programacao_decidir", {
        p_programacao_id: programacaoId, p_decisao: decisao, p_justificativa: decisaoJustif || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, decisao) => {
      toast.success(`Programação ${decisao}`);
      setDecisaoJustif("");
      refetchProg(); refetchAprov();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: async () => {
      if (!programacaoId) return;
      const motivo = window.prompt("Motivo da reabertura?") ?? "";
      if (motivo.length < 3) throw new Error("Motivo obrigatório");
      const { error } = await (supabase as any).rpc("programacao_reabrir", { p_programacao_id: programacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Programação reaberta"); refetchProg(); refetchAprov(); },
    onError: (e: any) => toast.error(e.message),
  });

  const removerTitulo = useMutation({
    mutationFn: async (tituloId: string) => {
      if (!programacaoId) {
        setTitulos((s) => s.filter((t) => t.id !== tituloId));
        return;
      }
      const { error } = await (supabase as any).from("malote_titulo")
        .delete().eq("malote_id", programacaoId).eq("titulo_pagar_id", tituloId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["malote_titulo"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const aplicarDataLote = () => toast.info(`Data ${fmtDate(dataPgto)} aplicada (todos os itens)`);
  const aplicarBancoLote = () => toast.info(`Banco aplicado em todos`);

  const resumoPorBanco = useMemo(() => {
    if (!contaId) return [];
    const c = contas.find((x) => x.id === contaId);
    return [{ banco: `${c?.banco_codigo ?? ""} ${c?.banco_nome ?? ""}`, total: totaisItens.total, qtd: totaisItens.qtd }];
  }, [contaId, contas, totaisItens]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Programação de Pagamentos"
        subtitle="Defina datas, contas e prioridades. Submeta para aprovação e gere lote operacional."
        module="Financeiro"
        breadcrumb={["Financeiro", "Programação de Pagamentos"]}
      />

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Status: {status}</Badge>
          <Badge variant={aprovStatus === "aprovada" ? "default" : aprovStatus === "reprovada" ? "destructive" : "secondary"}>
            Aprovação: {aprovStatus}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cabeçalho da programação</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><Label>Data programada</Label><Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} disabled={!editavel} /></div>
            <div>
              <Label>Conta bancária prevista</Label>
              <Select value={contaId} onValueChange={setContaId} disabled={!editavel}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome} ({c.agencia}/{c.conta})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade} disabled={!editavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="emergencial">Emergencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={urgencia} onCheckedChange={(v) => setUrgencia(!!v)} disabled={!editavel} />Urgência</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={excecao} onCheckedChange={(v) => setExcecao(!!v)} disabled={!editavel} />Exceção</label>
            </div>
            {(urgencia || excecao) && (
              <div className="md:col-span-4">
                <Label>Justificativa (obrigatória) <span className="text-destructive">*</span></Label>
                <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} disabled={!editavel} />
              </div>
            )}
            <div className="md:col-span-4">
              <Label>Observação financeira</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={!editavel} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardDescription>Qtd títulos</CardDescription><CardTitle className="text-xl">{totaisItens.qtd}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Valor total</CardDescription><CardTitle className="text-xl">{fmtMoney(totaisItens.total)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Vencidos na prog.</CardDescription><CardTitle className="text-xl text-destructive">{totaisItens.vencidosNaProg}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Aprovação</CardDescription><CardTitle className="text-base">{aprovStatus}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Status</CardDescription><CardTitle className="text-base">{status}</CardTitle></CardHeader></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !editavel}><Save className="h-4 w-4 mr-2" />Salvar rascunho</Button>
        <Button onClick={() => submeter.mutate()} disabled={!programacaoId || submeter.isPending || aprovStatus === "pendente" || aprovStatus === "aprovada"}>
          <Send className="h-4 w-4 mr-2" />Enviar para aprovação
        </Button>
        <Button variant="outline" onClick={aplicarDataLote} disabled={!editavel}>Aplicar data em lote</Button>
        <Button variant="outline" onClick={aplicarBancoLote} disabled={!editavel}>Aplicar banco em lote</Button>
        {(aprovStatus === "aprovada" || aprovStatus === "reprovada") && (
          <Button variant="outline" onClick={() => reabrir.mutate()}><RotateCcw className="h-4 w-4 mr-2" />Reabrir</Button>
        )}
      </div>

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Títulos</TabsTrigger>
          <TabsTrigger value="data">Resumo por Data</TabsTrigger>
          <TabsTrigger value="banco">Resumo por Banco</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
          <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="itens">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Documento</TableHead><TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {totaisItens.fonte.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum título</TableCell></TableRow>}
                {totaisItens.fonte.map((t: any) => {
                  const venc = t.data_vencimento && new Date(t.data_vencimento) < new Date(dataPgto);
                  return (
                    <TableRow key={t.id} className={venc ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{t.numero_documento}</TableCell>
                      <TableCell>{t.fornecedor?.razao_social ?? "—"}</TableCell>
                      <TableCell>{fmtDate(t.data_vencimento)}{venc && <Badge variant="destructive" className="ml-2">vencido</Badge>}</TableCell>
                      <TableCell className="text-right">{fmtMoney(t.valor)}</TableCell>
                      <TableCell><Badge variant="outline">{t.status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {editavel && <Button size="sm" variant="ghost" onClick={() => removerTitulo.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="data">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Data programada</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody><TableRow><TableCell>{fmtDate(dataPgto)}</TableCell><TableCell className="text-right">{totaisItens.qtd}</TableCell><TableCell className="text-right">{fmtMoney(totaisItens.total)}</TableCell></TableRow></TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="banco">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Banco</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {resumoPorBanco.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Selecione conta bancária</TableCell></TableRow>}
                {resumoPorBanco.map((r) => <TableRow key={r.banco}><TableCell>{r.banco}</TableCell><TableCell className="text-right">{r.qtd}</TableCell><TableCell className="text-right">{fmtMoney(r.total)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pendencias">
          <Card><CardContent className="pt-6 space-y-2">
            {totaisItens.vencidosNaProg > 0 && <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />{totaisItens.vencidosNaProg} título(s) vencido(s) na data programada</div>}
            {!contaId && <div className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-4 w-4" />Conta bancária prevista não definida</div>}
            {(urgencia || excecao) && justificativa.length < 5 && <div className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-4 w-4" />Justificativa obrigatória</div>}
            {totaisItens.vencidosNaProg === 0 && contaId && <div className="text-muted-foreground text-sm">Sem pendências.</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="aprovacoes">
          <Card><CardContent className="pt-6 space-y-4">
            <Table>
              <TableHeader><TableRow><TableHead>Etapa</TableHead><TableHead>Decisão</TableHead><TableHead>Aprovador</TableHead><TableHead>Decidido em</TableHead><TableHead>Justificativa</TableHead></TableRow></TableHeader>
              <TableBody>
                {aprovacoes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Não submetida</TableCell></TableRow>}
                {aprovacoes.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>#{a.etapa}</TableCell>
                    <TableCell><Badge variant={a.decisao === "aprovado" ? "default" : a.decisao === "rejeitado" ? "destructive" : "outline"}>{a.decisao}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{a.aprovador_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell>{a.decidido_em ? new Date(a.decidido_em).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs">{a.justificativa ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {aprovStatus === "pendente" && (
              <div className="space-y-2 border-t pt-4">
                <Label>Justificativa (obrigatória para reprovar/devolver)</Label>
                <Textarea value={decisaoJustif} onChange={(e) => setDecisaoJustif(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => decidir.mutate("aprovado")}><CheckCircle2 className="h-4 w-4 mr-2" />Aprovar</Button>
                  <Button variant="destructive" onClick={() => decidir.mutate("rejeitado")}><XCircle className="h-4 w-4 mr-2" />Reprovar</Button>
                  <Button variant="outline" onClick={() => decidir.mutate("devolvido")}><RotateCcw className="h-4 w-4 mr-2" />Devolver para ajuste</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Usuário</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem histórico</TableCell></TableRow>}
                {logs.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline">{l.acao}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{l.usuario_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="text-xs"><pre className="whitespace-pre-wrap">{l.detalhes ? JSON.stringify(l.detalhes, null, 2) : "—"}</pre></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
