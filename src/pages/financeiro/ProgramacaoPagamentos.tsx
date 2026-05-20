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
import { Switch } from "@/components/ui/switch";
import { Save, Send, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ArrowLeft, Trash2, FileInput, Plus, Calculator, MessageSquare, ArrowUpCircle, PackageCheck, Ban, FileText, Building2, Calendar, DollarSign, Banknote, AlertCircle, TrendingDown, Hash } from "lucide-react";
import { TimelineAprovacao } from "@/components/aprovacoes/TimelineAprovacao";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (d: any) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

type TituloSel = {
  id: string; numero_documento: string; data_vencimento: string;
  valor: number; fornecedor?: { razao_social?: string };
};

const KPI_BORDER = {
  blue: "border-t-4 border-t-blue-500",
  green: "border-t-4 border-t-emerald-500",
  amber: "border-t-4 border-t-amber-500",
  violet: "border-t-4 border-t-violet-500",
  rose: "border-t-4 border-t-rose-500",
  slate: "border-t-4 border-t-slate-500",
  red: "border-t-4 border-t-destructive",
} as const;

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
  const [empresaId, setEmpresaId] = useState<string>("");
  const [forma, setForma] = useState<string>("ted");
  const [prioridade, setPrioridade] = useState<string>("normal");
  const [urgencia, setUrgencia] = useState(false);
  const [excecao, setExcecao] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [decisaoJustif, setDecisaoJustif] = useState("");
  const [responsavelNome, setResponsavelNome] = useState<string>("—");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: p } = await (supabase as any).from("profiles")
          .select("empresa_id, display_name, email").eq("id", u.user.id).maybeSingle();
        if (p?.empresa_id) setEmpresaId(p.empresa_id);
        setResponsavelNome(p?.display_name || p?.email || "—");
      }
    })();
  }, []);

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ["empresas_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, razao_social").order("razao_social");
      return data ?? [];
    },
  });

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_bancaria_prog"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta").eq("ativa", true).order("banco_nome");
      return data ?? [];
    },
  });

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
        .select("*, titulo_pagar(numero_documento, valor, data_vencimento, status, data_emissao, conta_bancaria_id, fornecedor(razao_social), conta_bancaria(banco_codigo, banco_nome))")
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

  const fonte = useMemo(() => {
    return programacaoId ? itens.map((i: any) => ({
      id: i.titulo_pagar_id,
      valor: Number(i.valor_programado ?? i.titulo_pagar?.valor ?? 0),
      data_vencimento: i.titulo_pagar?.data_vencimento,
      data_emissao: i.titulo_pagar?.data_emissao,
      numero_documento: i.titulo_pagar?.numero_documento,
      fornecedor: i.titulo_pagar?.fornecedor,
      status: i.titulo_pagar?.status,
      conta_bancaria_id: i.titulo_pagar?.conta_bancaria_id,
      conta_bancaria: i.titulo_pagar?.conta_bancaria,
      prioridade: i.prioridade ?? "normal",
    })) : titulos.map((t: any) => ({ ...t, valor: Number(t.valor), prioridade: "normal" }));
  }, [itens, titulos, programacaoId]);

  const totaisItens = useMemo(() => {
    const total = fonte.reduce((s: number, t: any) => s + Number(t.valor || 0), 0);
    const venc = fonte.filter((t: any) => t.data_vencimento && new Date(t.data_vencimento) < new Date(dataPgto));
    const valorVencidos = venc.reduce((s: number, t: any) => s + Number(t.valor || 0), 0);
    const programadoNaData = fonte.filter((t: any) => true).reduce((s: number, t: any) => s + Number(t.valor || 0), 0);
    return { total, qtd: fonte.length, vencidosNaProg: venc.length, valorVencidos, programadoNaData };
  }, [fonte, dataPgto]);

  const status = prog?.status ?? "rascunho";
  const aprovStatus = prog?.aprovacao_status ?? "nao_submetida";
  const editavel = !programacaoId || (status === "rascunho" && aprovStatus !== "pendente");
  const codigoProg = prog?.codigo ?? prog?.id?.slice(0, 8) ?? "—";
  const dataCriacao = prog?.created_at ?? new Date().toISOString();

  const resumoPorBanco = useMemo(() => {
    const map = new Map<string, { banco: string; qtd: number; total: number }>();
    fonte.forEach((t: any) => {
      const key = t.conta_bancaria?.banco_codigo ? `${t.conta_bancaria.banco_codigo} — ${t.conta_bancaria.banco_nome}` : "Sem banco";
      const cur = map.get(key) ?? { banco: key, qtd: 0, total: 0 };
      cur.qtd += 1; cur.total += Number(t.valor || 0);
      map.set(key, cur);
    });
    if (contaId) {
      const c = contas.find((x) => x.id === contaId);
      if (c) {
        const k = `${c.banco_codigo} — ${c.banco_nome} (previsto)`;
        map.set(k, { banco: k, qtd: totaisItens.qtd, total: totaisItens.total });
      }
    }
    return Array.from(map.values());
  }, [fonte, contaId, contas, totaisItens]);

  const resumoPorData = useMemo(() => {
    const map = new Map<string, { data: string; qtd: number; total: number }>();
    fonte.forEach((t: any) => {
      const k = t.data_vencimento ?? "—";
      const cur = map.get(k) ?? { data: k, qtd: 0, total: 0 };
      cur.qtd += 1; cur.total += Number(t.valor || 0);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [fonte]);

  // ============ Mutations ============
  const salvar = useMutation({
    mutationFn: async () => {
      if (!contaId) throw new Error("Selecione a conta bancária prevista");
      if (titulos.length === 0 && !programacaoId) throw new Error("Sem títulos");
      if ((urgencia || excecao) && justificativa.trim().length < 5) throw new Error("Justificativa obrigatória para urgência/exceção");

      if (!programacaoId) {
        const { data: u } = await supabase.auth.getUser();
        const empresa_id = empresaId;
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

  const recalcular = () => {
    qc.invalidateQueries({ queryKey: ["malote_titulo"] });
    qc.invalidateQueries({ queryKey: ["malote_pagamento"] });
    toast.success("Totais recalculados");
  };

  const importarSelecao = () => {
    if (incoming.length === 0) toast.info("Sem seleção pendente. Volte para Análise por Período.");
    else { setTitulos(incoming); toast.success(`${incoming.length} títulos importados`); }
  };

  const adicionarTitulos = () => navigate("/app/financeiro/contas-pagar?tab=analise");

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={importarSelecao}>
        <FileInput className="h-4 w-4 mr-2" />Importar Seleção
      </Button>
      <Button variant="outline" size="sm" onClick={adicionarTitulos}>
        <Plus className="h-4 w-4 mr-2" />Adicionar Títulos
      </Button>
      <Button variant="outline" size="sm" onClick={recalcular}>
        <Calculator className="h-4 w-4 mr-2" />Recalcular Totais
      </Button>
      <Button size="sm" onClick={() => submeter.mutate()} disabled={!programacaoId || submeter.isPending || aprovStatus === "pendente" || aprovStatus === "aprovada"}>
        <Send className="h-4 w-4 mr-2" />Enviar para Aprovação
      </Button>
    </>
  );

  const urgentes = fonte.filter((t: any) => t.prioridade === "alta" || t.prioridade === "emergencial").length;
  const excecoes = excecao ? 1 : 0;
  const aprovadosCount = aprovacoes.filter((a) => a.decisao === "aprovado").length;
  const pendentesAprov = aprovStatus === "pendente" ? 1 : 0;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Programação de Pagamentos"
        subtitle="Defina datas, bancos, prioridades e aprove a programação de pagamentos."
        module="Financeiro"
        breadcrumb={["Financeiro", "Programação de Pagamentos", programacaoId ? "Edição" : "Nova Programação"]}
        actions={headerActions}
      />

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Status: {status}</Badge>
          <Badge variant={aprovStatus === "aprovada" ? "default" : aprovStatus === "reprovada" ? "destructive" : "secondary"}>
            Aprovação: {aprovStatus}
          </Badge>
        </div>
      </div>

      {/* Cabeçalho rico */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Código da Programação</Label>
              <Input value={codigoProg} disabled className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Empresa <span className="text-destructive">*</span></Label>
              <Select value={empresaId} onValueChange={setEmpresaId} disabled={!editavel || !!programacaoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Período Analisado</Label>
              <div className="flex gap-2">
                <Input type="date" value={periodoIni ?? ""} disabled />
                <Input type="date" value={periodoFim ?? ""} disabled />
              </div>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={responsavelNome} disabled />
            </div>
            <div>
              <Label className="text-xs">Data de Criação</Label>
              <Input value={fmtDateTime(dataCriacao)} disabled />
            </div>
            <div>
              <Label className="text-xs">Data Programada de Pagamento <span className="text-destructive">*</span></Label>
              <Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} disabled={!editavel} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Conta Bancária Prevista <span className="text-destructive">*</span></Label>
              <Select value={contaId} onValueChange={setContaId} disabled={!editavel || contas.length === 0}>
                <SelectTrigger><SelectValue placeholder={contas.length === 0 ? "Nenhuma conta cadastrada — vá em Integração Bancária" : "Selecione..."} /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome} ({c.agencia}/{c.conta})</SelectItem>)}
                </SelectContent>
              </Select>
              {contas.length === 0 && <p className="text-[11px] text-destructive mt-1">Cadastre uma conta em Financeiro › Integração Bancária.</p>}
            </div>
            <div>
              <Label className="text-xs">Forma de Pagamento <span className="text-destructive">*</span></Label>
              <Select value={forma} onValueChange={setForma} disabled={!editavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ted">TED/DOC</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="debito_automatico">Débito automático</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade <span className="text-destructive">*</span></Label>
              <Select value={prioridade} onValueChange={setPrioridade} disabled={!editavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">● Baixa</SelectItem>
                  <SelectItem value="normal">● Normal</SelectItem>
                  <SelectItem value="alta">● Alta</SelectItem>
                  <SelectItem value="emergencial">● Emergencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">Marcar como Urgência</Label>
              <div className="h-10 flex items-center"><Switch checked={urgencia} onCheckedChange={setUrgencia} disabled={!editavel} /></div>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">Marcar como Exceção</Label>
              <div className="h-10 flex items-center"><Switch checked={excecao} onCheckedChange={setExcecao} disabled={!editavel} /></div>
            </div>
            {(urgencia || excecao) && (
              <div className="md:col-span-2">
                <Label className="text-xs">Justificativa (Urgência/Exceção) <span className="text-destructive">*</span></Label>
                <Select value={justificativa.split("|")[0] || ""} onValueChange={(v) => setJustificativa(v)} disabled={!editavel}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prazo contratual">Prazo contratual</SelectItem>
                    <SelectItem value="Multa por atraso">Multa por atraso</SelectItem>
                    <SelectItem value="Negociação comercial">Negociação comercial</SelectItem>
                    <SelectItem value="Operacional crítico">Operacional crítico</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={(urgencia || excecao) ? "md:col-span-4" : "md:col-span-6"}>
              <Label className="text-xs">Observação</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={!editavel} rows={2} maxLength={500} />
              <div className="text-[11px] text-muted-foreground text-right">{observacao.length}/500</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs grandes */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard borderClass={KPI_BORDER.slate} icon={<Hash className="h-4 w-4" />} label="Total de Títulos" value={String(totaisItens.qtd)} hint="Selecionados" />
        <KpiCard borderClass={KPI_BORDER.green} icon={<DollarSign className="h-4 w-4" />} label="Valor Total Selecionado" value={fmtMoney(totaisItens.total)} hint="Valor bruto" />
        <KpiCard borderClass={KPI_BORDER.blue} icon={<Calendar className="h-4 w-4" />} label="Programado na Data" value={fmtMoney(totaisItens.programadoNaData)} hint={fmtDate(dataPgto)} />
        <KpiCard borderClass={KPI_BORDER.violet} icon={<Banknote className="h-4 w-4" />} label="Valor por Banco" value={fmtMoney(totaisItens.total)} hint={`Distribuído em ${resumoPorBanco.length} bancos`} />
        <KpiCard borderClass={KPI_BORDER.slate} icon={<Building2 className="h-4 w-4" />} label="Valor por Empresa" value={fmtMoney(totaisItens.total)} hint="Empresa atual" />
        <KpiCard borderClass={KPI_BORDER.red} icon={<AlertTriangle className="h-4 w-4" />} label="Vencidos na Programação" value={String(totaisItens.vencidosNaProg)} hint={fmtMoney(totaisItens.valorVencidos)} valueClass="text-destructive" />
        <KpiCard borderClass={KPI_BORDER.amber} icon={<AlertCircle className="h-4 w-4" />} label="Pendências" value={String(totaisItens.vencidosNaProg + (contaId ? 0 : 1))} hint="Requerem atenção" />
        <KpiCard borderClass={KPI_BORDER.green} icon={<TrendingDown className="h-4 w-4" />} label="Impacto de Caixa Previsto" value={`-${fmtMoney(totaisItens.total)}`} hint="Saída prevista" valueClass="text-emerald-600" />
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="itens">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="itens">Títulos Programados ({fonte.length})</TabsTrigger>
          <TabsTrigger value="data">Resumo por Data</TabsTrigger>
          <TabsTrigger value="banco">Resumo por Banco</TabsTrigger>
          <TabsTrigger value="empresa">Resumo por Empresa</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências ({totaisItens.vencidosNaProg})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
        </TabsList>

        <TabsContent value="itens">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Título</TableHead><TableHead>Fornecedor</TableHead>
                <TableHead>Documento / NF</TableHead><TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead><TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Valor Original</TableHead>
                <TableHead className="text-right">Valor em Aberto</TableHead>
                <TableHead>Data Prog.</TableHead><TableHead>Banco / Conta</TableHead>
                <TableHead>Forma Pgto.</TableHead><TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead><TableHead>Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fonte.length === 0 && <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">Nenhum título</TableCell></TableRow>}
                {fonte.map((t: any) => {
                  const venc = t.data_vencimento && new Date(t.data_vencimento) < new Date(dataPgto);
                  const dias = t.data_vencimento ? Math.floor((new Date(t.data_vencimento).getTime() - new Date(dataPgto).getTime()) / 86400000) : 0;
                  return (
                    <TableRow key={t.id} className={venc ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{t.id?.slice(0, 8)}</TableCell>
                      <TableCell>{t.fornecedor?.razao_social ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{t.numero_documento}</TableCell>
                      <TableCell className="text-xs">{fmtDate(t.data_emissao)}</TableCell>
                      <TableCell className={venc ? "text-destructive font-semibold" : ""}>{fmtDate(t.data_vencimento)}</TableCell>
                      <TableCell className={`text-right text-xs ${venc ? "text-destructive" : ""}`}>{dias}</TableCell>
                      <TableCell className="text-right">{fmtMoney(t.valor)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(t.valor)}</TableCell>
                      <TableCell>{fmtDate(dataPgto)}</TableCell>
                      <TableCell className="text-xs">{t.conta_bancaria ? `${t.conta_bancaria.banco_codigo} ${t.conta_bancaria.banco_nome}` : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-[10px]">{forma}</Badge></TableCell>
                      <TableCell><PrioridadeBadge p={t.prioridade} /></TableCell>
                      <TableCell><StatusItemBadge status={t.status} venc={venc} /></TableCell>
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
              <TableBody>
                {resumoPorData.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados</TableCell></TableRow>}
                {resumoPorData.map((r) => <TableRow key={r.data}><TableCell>{fmtDate(r.data)}</TableCell><TableCell className="text-right">{r.qtd}</TableCell><TableCell className="text-right">{fmtMoney(r.total)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="banco">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Banco</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">% do total</TableHead></TableRow></TableHeader>
              <TableBody>
                {resumoPorBanco.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Selecione conta bancária</TableCell></TableRow>}
                {resumoPorBanco.map((r) => (
                  <TableRow key={r.banco}>
                    <TableCell>{r.banco}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.total)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{totaisItens.total > 0 ? ((r.total / totaisItens.total) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="empresa">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{empresas.find((e: any) => e.id === empresaId)?.razao_social ?? "—"}</TableCell>
                  <TableCell className="text-right">{totaisItens.qtd}</TableCell>
                  <TableCell className="text-right">{fmtMoney(totaisItens.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pendencias">
          <Card><CardContent className="pt-6 space-y-2">
            {totaisItens.vencidosNaProg > 0 && <div className="flex items-center gap-2 text-destructive p-3 bg-destructive/5 rounded border border-destructive/20"><AlertTriangle className="h-4 w-4" />{totaisItens.vencidosNaProg} título(s) vencido(s) na data programada — {fmtMoney(totaisItens.valorVencidos)}</div>}
            {!contaId && <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 rounded border border-amber-200"><AlertTriangle className="h-4 w-4" />Conta bancária prevista não definida</div>}
            {(urgencia || excecao) && justificativa.length < 5 && <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 rounded border border-amber-200"><AlertTriangle className="h-4 w-4" />Justificativa obrigatória para urgência/exceção</div>}
            {totaisItens.vencidosNaProg === 0 && contaId && <div className="text-muted-foreground text-sm">Sem pendências.</div>}
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
                    <TableCell className="text-xs">{fmtDateTime(l.created_at)}</TableCell>
                    <TableCell><Badge variant="outline">{l.acao}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{l.usuario_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="text-xs"><pre className="whitespace-pre-wrap">{l.detalhes ? JSON.stringify(l.detalhes, null, 2) : "—"}</pre></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                    <TableCell>{fmtDateTime(a.decidido_em)}</TableCell>
                    <TableCell className="text-xs">{a.justificativa ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {aprovStatus === "pendente" && (
              <div className="space-y-2 border-t pt-4">
                <Label>Justificativa (obrigatória para reprovar/devolver)</Label>
                <Textarea value={decisaoJustif} onChange={(e) => setDecisaoJustif(e.target.value)} />
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Toolbar inferior fixa */}
      <Card className="sticky bottom-0 shadow-lg border-t-2 border-t-primary">
        <CardContent className="py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-3 mr-auto">
              <StatusPill label="Títulos Selecionados" value={fonte.length} color="bg-slate-100 text-slate-700" />
              <StatusPill label="Pendente Aprovação" value={pendentesAprov} color="bg-amber-100 text-amber-700" />
              <StatusPill label="Aprovado" value={aprovadosCount} color="bg-emerald-100 text-emerald-700" />
              <StatusPill label="Urgente" value={urgentes} color="bg-rose-100 text-rose-700" />
              <StatusPill label="Exceção" value={excecoes} color="bg-violet-100 text-violet-700" />
            </div>
            <Button size="sm" variant="outline" onClick={() => salvar.mutate()} disabled={salvar.isPending || !editavel}>
              <Save className="h-4 w-4 mr-2" />Salvar Rascunho
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => decidir.mutate("aprovado")} disabled={aprovStatus !== "pendente"}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Aprovar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decidir.mutate("rejeitado")} disabled={aprovStatus !== "pendente"}>
              <XCircle className="h-4 w-4 mr-2" />Reprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => decidir.mutate("devolvido")} disabled={aprovStatus !== "pendente"}>
              <RotateCcw className="h-4 w-4 mr-2" />Devolver para Ajuste
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.info("Solicitação de esclarecimento registrada")}>
              <MessageSquare className="h-4 w-4 mr-2" />Solicitar Esclarecimento
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.info("Encaminhado para alçada superior")}>
              <ArrowUpCircle className="h-4 w-4 mr-2" />Encaminhar para Alçada Superior
            </Button>
            <Button size="sm" variant="default" onClick={() => toast.success("Lote operacional gerado")} disabled={aprovStatus !== "aprovada"}>
              <PackageCheck className="h-4 w-4 mr-2" />Gerar Lote Operacional
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => reabrir.mutate()} disabled={!programacaoId || aprovStatus === "nao_submetida"}>
              <Ban className="h-4 w-4 mr-2" />Cancelar Programação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ borderClass, icon, label, value, hint, valueClass }: { borderClass: string; icon: React.ReactNode; label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <Card className={borderClass}>
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-base font-bold ${valueClass ?? ""}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function PrioridadeBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    baixa: "bg-slate-100 text-slate-700",
    normal: "bg-blue-100 text-blue-700",
    alta: "bg-rose-100 text-rose-700",
    emergencial: "bg-red-100 text-red-800",
  };
  return <Badge className={`${map[p] ?? map.normal} hover:${map[p] ?? map.normal} border-0`}>{(p ?? "normal").replace(/^./, c => c.toUpperCase())}</Badge>;
}

function StatusItemBadge({ status, venc }: { status?: string; venc?: boolean }) {
  if (venc) return <Badge variant="destructive">Vencido</Badge>;
  if (status === "pago") return <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100">Pago</Badge>;
  if (status === "agendado") return <Badge className="bg-blue-100 text-blue-700 border-0 hover:bg-blue-100">Programado</Badge>;
  return <Badge variant="outline">{status ?? "—"}</Badge>;
}

function StatusPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`px-3 py-1.5 rounded-md ${color} text-center min-w-[110px]`}>
      <div className="text-base font-bold leading-none">{value}</div>
      <div className="text-[10px] mt-1 leading-tight">{label}</div>
    </div>
  );
}
