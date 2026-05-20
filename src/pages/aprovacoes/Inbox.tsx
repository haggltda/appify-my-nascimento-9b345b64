import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CheckCircle2, XCircle, RotateCcw, Wallet, ShoppingCart, Search,
  Users, DollarSign, FolderOpen, Clock, FileIcon, Eye,
} from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (d: any) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const diasAte = (d: any) => {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

type Origem = "financeiro" | "compras" | "contratos";

interface ItemAprov {
  id: string;
  origem: Origem;
  tipo: string;
  ref_id: string;
  titulo: string;
  numero_doc: string | null;
  fornecedor_nome: string | null;
  fornecedor_doc: string | null;
  valor: number;
  emissao: string | null;
  vencimento: string | null;
  competencia: string | null;
  lancamento: string | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  centro_custo: string | null;
  contrato_numero: string | null;
  etapa: number;
  responsavel: string | null;
  empresa_id: string;
  link: string;
  raw: any;
  // sup_aprov (novo motor)
  sup_aprov?: {
    instancia_id: string;
    etapa_id: string;
    etapa_nome: string;
    tipo_parecer: "bloqueante" | "consultivo" | "ciencia";
    criticidade: string;
    horas_paradas: number;
    prazo_horas: number | null;
  };
}

const ORIGEM_META: Record<Origem, { label: string; icon: any; chip: string }> = {
  financeiro: { label: "Financeiro", icon: Wallet, chip: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" },
  compras:    { label: "Compras", icon: ShoppingCart, chip: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
  contratos:  { label: "Contratos/Outros", icon: FolderOpen, chip: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300" },
};

export default function InboxAprovacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<"todos" | Origem>("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<ItemAprov | null>(null);
  const [decisao, setDecisao] = useState<{ item: ItemAprov; tipo: "aprovado" | "rejeitado" | "devolvido" } | null>(null);
  const [justif, setJustif] = useState("");

  // Query principal — financeiro
  const financeiroQ = useQuery({
    queryKey: ["inbox-financeiro-v2"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await (supabase as any)
        .from("financeiro_pagamento_aprovacao")
        .select(`
          id, programacao_id, empresa_id, etapa, valor_aprovado, data_pagamento_aprovada, created_at,
          malote:programacao_id (
            descricao, qtd_titulos, valor_total, data_pagamento,
            enviado_aprovacao_em, enviado_aprovacao_por,
            prioridade, urgencia, excecao, justificativa, observacao,
            empresa:empresa_id ( nome_fantasia, razao_social, cnpj )
          )
        `)
        .eq("aprovador_id", u.user.id)
        .eq("decisao", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any): ItemAprov => ({
        id: r.id,
        origem: "financeiro",
        tipo: "Programação de pagamento",
        ref_id: r.programacao_id,
        titulo: r.malote?.descricao || `Programação — etapa ${r.etapa}`,
        numero_doc: `PP · ${String(r.programacao_id).slice(0, 8)}`,
        fornecedor_nome: r.malote?.qtd_titulos ? `${r.malote.qtd_titulos} título(s)` : null,
        fornecedor_doc: null,
        valor: Number(r.valor_aprovado || r.malote?.valor_total || 0),
        emissao: r.malote?.enviado_aprovacao_em ?? r.created_at,
        vencimento: r.data_pagamento_aprovada ?? r.malote?.data_pagamento,
        competencia: r.malote?.data_pagamento ?? null,
        lancamento: r.created_at,
        empresa_nome: r.malote?.empresa?.nome_fantasia || r.malote?.empresa?.razao_social || null,
        empresa_cnpj: r.malote?.empresa?.cnpj || null,
        centro_custo: null,
        contrato_numero: null,
        etapa: r.etapa,
        responsavel: null,
        empresa_id: r.empresa_id,
        link: `/app/financeiro/programacao-pagamentos?id=${r.programacao_id}`,
        raw: r,
      }));
    },
  });

  const itens = useMemo(() => {
    const all: ItemAprov[] = [...(financeiroQ.data ?? [])];
    const filtered = filtro === "todos" ? all : all.filter((x) => x.origem === filtro);
    if (!busca.trim()) return filtered;
    const q = busca.toLowerCase();
    return filtered.filter((i) =>
      [i.titulo, i.fornecedor_nome, i.numero_doc, i.empresa_nome].some((v) => v?.toLowerCase().includes(q))
    );
  }, [financeiroQ.data, filtro, busca]);

  const counts = useMemo(() => {
    const all = [...(financeiroQ.data ?? [])];
    const fin = all.filter((x) => x.origem === "financeiro");
    return {
      todos: all.length,
      total_valor: all.reduce((s, i) => s + i.valor, 0),
      financeiro: { qtd: fin.length, valor: fin.reduce((s, i) => s + i.valor, 0) },
      compras:    { qtd: 0, valor: 0 },
      contratos:  { qtd: 0, valor: 0 },
      novos_hoje: all.filter((i) => {
        const d = new Date(i.lancamento || 0);
        return d.toDateString() === new Date().toDateString();
      }).length,
    };
  }, [financeiroQ.data]);

  const decidir = useMutation({
    mutationFn: async () => {
      if (!decisao) return;
      if ((decisao.tipo === "rejeitado" || decisao.tipo === "devolvido") && justif.trim().length < 5) {
        throw new Error("Justificativa obrigatória (mínimo 5 caracteres)");
      }
      if (decisao.item.origem === "financeiro") {
        const { error } = await (supabase as any).rpc("programacao_decidir", {
          p_programacao_id: decisao.item.ref_id,
          p_decisao: decisao.tipo,
          p_justificativa: justif || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      setDecisao(null); setJustif(""); setSelecionado(null);
      qc.invalidateQueries({ queryKey: ["inbox-financeiro-v2"] });
      qc.invalidateQueries({ queryKey: ["tem-alcada"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aguardando Minha Aprovação"
        subtitle="Inbox unificado de aprovações pendentes. Analise, aprove ou devolva os itens que dependem da sua decisão."
        module="Aprovações"
        breadcrumb={["Aprovações", "Inbox"]}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={Users}
          label="Pendentes Comigo"
          value={String(counts.todos)}
          accent="primary"
          hint={counts.novos_hoje > 0 ? `↑ ${counts.novos_hoje} novos hoje` : "Itens aguardando"}
          highlight
        />
        <KpiCard icon={DollarSign} label="Valor Total Pendente" value={fmtMoney(counts.total_valor)} accent="emerald" hint="Em aprovação" />
        <KpiCard icon={Wallet} label="Financeiro" value={fmtMoney(counts.financeiro.valor)} accent="emerald" hint={`${counts.financeiro.qtd} itens`} />
        <KpiCard icon={ShoppingCart} label="Compras" value={fmtMoney(counts.compras.valor)} accent="amber" hint={`${counts.compras.qtd} itens`} />
        <KpiCard icon={FolderOpen} label="Contratos/Outros" value={fmtMoney(counts.contratos.valor)} accent="blue" hint={`${counts.contratos.qtd} itens`} />
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
              <TabsList>
                <TabsTrigger value="todos">Todos <Badge variant="secondary" className="ml-2">{counts.todos}</Badge></TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro <Badge variant="secondary" className="ml-2">{counts.financeiro.qtd}</Badge></TabsTrigger>
                <TabsTrigger value="compras">Compras <Badge variant="secondary" className="ml-2">{counts.compras.qtd}</Badge></TabsTrigger>
                <TabsTrigger value="contratos">Contratos/Outros <Badge variant="secondary" className="ml-2">{counts.contratos.qtd}</Badge></TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar na tabela..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {financeiroQ.isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando…</div>
          ) : itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="font-medium">Nada para aprovar agora ✨</p>
              <p className="text-sm text-muted-foreground">Quando algo entrar na sua alçada, aparecerá aqui e no sino.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item / Título</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Nº Doc. / NF</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Lançamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it) => {
                    const meta = ORIGEM_META[it.origem]; const Icon = meta.icon;
                    const dias = diasAte(it.vencimento);
                    const isSel = selecionado?.id === it.id;
                    return (
                      <TableRow
                        key={it.id}
                        onClick={() => setSelecionado(it)}
                        className={`cursor-pointer ${isSel ? "bg-accent/50 border-l-4 border-l-primary" : "border-l-4 border-l-transparent hover:bg-accent/30"}`}
                      >
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${meta.chip}`}>
                            <Icon className="h-3 w-3" />{meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{it.tipo}</TableCell>
                        <TableCell className="font-medium max-w-[220px] truncate">{it.titulo}</TableCell>
                        <TableCell className="text-sm">
                          <div>{it.fornecedor_nome ?? "—"}</div>
                          {it.fornecedor_doc && <div className="text-xs text-muted-foreground">{it.fornecedor_doc}</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{it.numero_doc ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmtMoney(it.valor)}</TableCell>
                        <TableCell className="text-sm">{fmtDate(it.emissao)}</TableCell>
                        <TableCell className="text-sm">
                          <div>{fmtDate(it.vencimento)}</div>
                          {dias !== null && (
                            <div className={`text-xs ${dias < 0 ? "text-destructive font-medium" : dias <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {dias < 0 ? `${Math.abs(dias)} dias vencido` : `${dias} dias`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{fmtDate(it.competencia)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(it.lancamento)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setSelecionado(it)}>Ver</Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setDecisao({ item: it, tipo: "aprovado" }); setJustif(""); }}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Drawer de detalhe */}
      <DetailDrawer
        item={selecionado}
        onClose={() => setSelecionado(null)}
        onDecidir={(tipo) => { if (selecionado) { setDecisao({ item: selecionado, tipo }); setJustif(""); } }}
        onVerDetalhes={(link) => navigate(link)}
      />

      {/* Diálogo de confirmação (mantém lógica) */}
      <Dialog open={!!decisao} onOpenChange={(o) => !o && setDecisao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao?.tipo === "aprovado" ? "Aprovar item" : decisao?.tipo === "devolvido" ? "Devolver para ajuste" : "Rejeitar item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm font-medium">{decisao?.item.titulo}</div>
            <div className="text-sm text-muted-foreground">{fmtMoney(decisao?.item.valor ?? 0)}</div>
            <div>
              <label className="text-xs font-medium">
                Justificativa {decisao?.tipo !== "aprovado" && <span className="text-destructive">*</span>}
              </label>
              <Textarea value={justif} onChange={(e) => setJustif(e.target.value)} placeholder="Motivo / observação" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisao(null)}>Cancelar</Button>
            <Button onClick={() => decidir.mutate()} disabled={decidir.isPending}>
              {decidir.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// KPI Card
// ============================================================
function KpiCard({ icon: Icon, label, value, hint, accent, highlight }: {
  icon: any; label: string; value: string; hint?: string;
  accent: "primary" | "emerald" | "amber" | "blue"; highlight?: boolean;
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  };
  return (
    <Card className={highlight ? "border-primary/40 shadow-sm" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-lg ${accentMap[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Detail Drawer
// ============================================================
function DetailDrawer({ item, onClose, onDecidir, onVerDetalhes }: {
  item: ItemAprov | null;
  onClose: () => void;
  onDecidir: (tipo: "aprovado" | "rejeitado" | "devolvido") => void;
  onVerDetalhes: (link: string) => void;
}) {
  // Histórico (etapas anteriores da mesma programação)
  const histQ = useQuery({
    queryKey: ["inbox-detail-hist", item?.ref_id],
    enabled: !!item && item.origem === "financeiro",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financeiro_pagamento_aprovacao")
        .select("id, etapa, decisao, decidido_em, justificativa, aprovador_id")
        .eq("programacao_id", item!.ref_id)
        .order("etapa", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Próxima etapa (alçada por ordem)
  const alcadaQ = useQuery({
    queryKey: ["inbox-detail-alc", item?.empresa_id, item?.etapa],
    enabled: !!item,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("alcada_aprovacao")
        .select("etapa, ordem, responsavel_nome")
        .eq("empresa_id", item!.empresa_id)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!item) return null;
  const dias = diasAte(item.vencimento);
  const proxima = (alcadaQ.data ?? []).find((a: any) => a.ordem > (item.etapa - 1));

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <SheetTitle className="text-base">Detalhamento do título</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-6 py-5">
          {/* Chips status */}
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
              {ORIGEM_META[item.origem].label}
            </Badge>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
              Pendente de aprovação
            </Badge>
          </div>

          {/* Título principal */}
          <div>
            <h2 className="text-xl font-bold leading-tight">{item.tipo} — etapa {item.etapa}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.numero_doc ?? "—"}</p>
          </div>

          {/* Grid principal */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Fornecedor / Itens" value={item.fornecedor_nome ?? "—"} sub={item.fornecedor_doc ?? undefined} />
            <Field label="Valor" value={fmtMoney(item.valor)} valueClass="font-mono font-semibold" />
            <Field label="Emissão" value={fmtDate(item.emissao)} />
            <Field
              label="Vencimento"
              value={fmtDate(item.vencimento)}
              sub={dias !== null ? (dias < 0 ? `${Math.abs(dias)} dias vencido` : `${dias} dias`) : undefined}
              subClass={dias !== null && dias < 0 ? "text-destructive" : dias !== null && dias <= 7 ? "text-amber-600" : ""}
            />
            <Field label="Competência" value={fmtDate(item.competencia)} />
            <Field label="Empresa" value={item.empresa_nome ?? "—"} sub={item.empresa_cnpj ?? undefined} />
            <Field label="Centro de custo" value={item.centro_custo ?? "Não disponível"} />
            <Field label="Contrato" value={item.contrato_numero ?? "Não disponível"} />
          </div>

          {/* Responsável */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsável pelo lançamento</p>
            <p className="mt-1 font-medium">{item.responsavel ?? "Não disponível"}</p>
            <p className="text-xs text-muted-foreground">{ORIGEM_META[item.origem].label}</p>
          </div>

          {/* Timeline */}
          <section>
            <h3 className="mb-3 text-sm font-bold">Linha do tempo</h3>
            <ol className="relative space-y-4 border-l-2 border-border pl-5">
              <TimelineStep
                state="done"
                title="Lançado"
                meta={fmtDateTime(item.lancamento)}
              />
              {(histQ.data ?? []).filter((h: any) => h.decisao !== "pendente").map((h: any) => (
                <TimelineStep
                  key={h.id}
                  state="done"
                  title={`Etapa ${h.etapa} — ${h.decisao}`}
                  meta={fmtDateTime(h.decidido_em)}
                  sub={h.justificativa}
                />
              ))}
              <TimelineStep
                state="current"
                title={`Etapa atual: Aguardando sua aprovação`}
                meta={`Etapa ${item.etapa}`}
              />
              {proxima && (
                <TimelineStep
                  state="pending"
                  title={`Próxima etapa: ${proxima.responsavel_nome ?? "—"}`}
                  meta="Aguardando aprovação"
                />
              )}
            </ol>
          </section>

          {/* Documentos */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Documentos anexados</h3>
              <span className="text-xs text-muted-foreground">0 anexos</span>
            </div>
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <FileIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhum anexo localizado</p>
              <p className="text-xs text-muted-foreground/70">Documentos vinculados aparecerão aqui quando disponíveis.</p>
            </div>
          </section>
        </div>

        {/* Footer fixo */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
          <Button variant="outline" size="sm" onClick={() => onVerDetalhes(item.link)}>
            <Eye className="h-4 w-4 mr-1" />Ver detalhes
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDecidir("devolvido")}>
            <RotateCcw className="h-4 w-4 mr-1" />Devolver
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDecidir("rejeitado")}>
            <XCircle className="h-4 w-4 mr-1" />Rejeitar
          </Button>
          <Button size="sm" className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onDecidir("aprovado")}>
            <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, sub, valueClass, subClass }: {
  label: string; value: string; sub?: string; valueClass?: string; subClass?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className={`text-xs ${subClass ?? "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

function TimelineStep({ state, title, meta, sub }: {
  state: "done" | "current" | "pending"; title: string; meta?: string; sub?: string;
}) {
  const dotCls =
    state === "done" ? "bg-emerald-500 border-emerald-500" :
    state === "current" ? "bg-primary border-primary ring-4 ring-primary/20" :
    "bg-muted border-border";
  return (
    <li className="relative">
      <span className={`absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 ${dotCls}`}>
        {state === "done" && <CheckCircle2 className="h-3 w-3 text-white" />}
        {state === "current" && <Clock className="h-2.5 w-2.5 text-primary-foreground" />}
      </span>
      <p className={`text-sm font-medium ${state === "pending" ? "text-muted-foreground" : ""}`}>{title}</p>
      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      {sub && <p className="mt-0.5 text-xs italic text-muted-foreground">"{sub}"</p>}
    </li>
  );
}
