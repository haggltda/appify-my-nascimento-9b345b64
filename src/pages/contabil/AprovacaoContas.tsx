import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, Pencil, Search, AlertTriangle, DatabaseZap } from "lucide-react";
import { toast } from "sonner";

type AprovStatus = "AGUARDANDO_APROVACAO_USUARIO" | "APROVADA" | "REJEITADA" | "AJUSTAR";

interface Aprovacao {
  id_sugestao_conta: string;
  codigo_conta_sugerido: string | null;
  nome_conta_sugerido: string | null;
  codigo_conta_pai_sugerido: string | null;
  nome_conta_pai_sugerido: string | null;
  classe_contabil_sugerida: string | null;
  tipo_gerencial_padrao: string | null;
  direto_indireto_padrao: string | null;
  fixo_variavel_padrao: string | null;
  linha_dre_padrao: string | null;
  qtd_lancamentos_afetados: number | null;
  valor_total_abs_afetado: number | null;
  origens_afetadas: string | null;
  motivo_sugestao: string | null;
  status_aprovacao: string | null;
  decisao_usuario: string | null;
  observacao_usuario: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
}

const fmtBRL = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toUpperCase();
  if (s === "APROVADA")
    return <Badge className="bg-success-soft text-success border-success/20"><CheckCircle2 className="mr-1 h-3 w-3" />Aprovada</Badge>;
  if (s === "REJEITADA")
    return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejeitada</Badge>;
  if (s === "AJUSTAR")
    return <Badge className="bg-warning-soft text-warning border-warning/20"><AlertTriangle className="mr-1 h-3 w-3" />Ajustar</Badge>;
  return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Aguardando</Badge>;
}

export default function AprovacaoContas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [tab, setTab] = useState<"todas" | "pendentes" | "aprovadas" | "rejeitadas" | "ajustar">("pendentes");
  const [editing, setEditing] = useState<Aprovacao | null>(null);
  const [decisao, setDecisao] = useState<AprovStatus>("APROVADA");
  const [observacao, setObservacao] = useState("");

  const { data: lista = [], isLoading } = useQuery<Aprovacao[]>({
    queryKey: ["stg_aprovacao_contas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stg_aprovacao_contas")
        .select("*")
        .order("id_sugestao_conta", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sugestoes = [] } = useQuery<any[]>({
    queryKey: ["stg_sugestoes_novas_contas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stg_sugestoes_novas_contas")
        .select("id_sugestao_conta,grau_confianca,impacta_dre,impacta_caixa,exemplos_historico_ou_item")
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const sugestoesById = useMemo(() => {
    const m = new Map<string, any>();
    sugestoes.forEach((s) => m.set(s.id_sugestao_conta, s));
    return m;
  }, [sugestoes]);

  const counters = useMemo(() => {
    const c = { todas: lista.length, pendentes: 0, aprovadas: 0, rejeitadas: 0, ajustar: 0 };
    lista.forEach((r) => {
      const s = (r.status_aprovacao ?? "").toUpperCase();
      if (s === "APROVADA") c.aprovadas++;
      else if (s === "REJEITADA") c.rejeitadas++;
      else if (s === "AJUSTAR") c.ajustar++;
      else c.pendentes++;
    });
    return c;
  }, [lista]);

  const filtrada = useMemo(() => {
    let arr = lista;
    if (tab !== "todas") {
      arr = arr.filter((r) => {
        const s = (r.status_aprovacao ?? "").toUpperCase();
        if (tab === "pendentes") return s !== "APROVADA" && s !== "REJEITADA" && s !== "AJUSTAR";
        if (tab === "aprovadas") return s === "APROVADA";
        if (tab === "rejeitadas") return s === "REJEITADA";
        if (tab === "ajustar") return s === "AJUSTAR";
        return true;
      });
    }
    if (filtro.trim()) {
      const f = filtro.toLowerCase();
      arr = arr.filter((r) =>
        [r.id_sugestao_conta, r.codigo_conta_sugerido, r.nome_conta_sugerido, r.classe_contabil_sugerida, r.linha_dre_padrao, r.motivo_sugestao]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(f)),
      );
    }
    return arr;
  }, [lista, tab, filtro]);

  const decidir = useMutation({
    mutationFn: async ({ ids, status, obs }: { ids: string[]; status: AprovStatus; obs?: string }) => {
      const payload: any = {
        status_aprovacao: status,
        decisao_usuario: status,
        aprovado_por: user?.id ?? null,
        aprovado_em: new Date().toISOString(),
      };
      if (obs !== undefined) payload.observacao_usuario = obs;
      const { error } = await (supabase as any)
        .from("stg_aprovacao_contas")
        .update(payload)
        .in("id_sugestao_conta", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stg_aprovacao_contas"] });
      toast.success("Decisão registrada");
      setEditing(null);
      setObservacao("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar decisão"),
  });

  const openEdit = (row: Aprovacao) => {
    setEditing(row);
    const s = (row.status_aprovacao ?? "").toUpperCase();
    setDecisao((["APROVADA", "REJEITADA", "AJUSTAR"].includes(s) ? s : "APROVADA") as AprovStatus);
    setObservacao(row.observacao_usuario ?? "");
  };

  const cards = [
    { l: "Total sugeridas", v: counters.todas, t: "info", i: Clock },
    { l: "Pendentes", v: counters.pendentes, t: "warning", i: Clock },
    { l: "Aprovadas", v: counters.aprovadas, t: "success", i: CheckCircle2 },
    { l: "Rejeitadas", v: counters.rejeitadas, t: "destructive", i: XCircle },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        module="Contábil"
        title="Aprovação de Contas Sugeridas"
        breadcrumb={["Contábil", "Aprovação de Contas"]}
        subtitle="Revise as contas sugeridas pelo pacote de migração antes de promovê-las ao plano de contas definitivo."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              const t = toast.loading("Carregando dados do Pacote 02…");
              try {
                const { data, error } = await supabase.functions.invoke("pacote02-load", { body: {} });
                if (error) throw error;
                toast.success("Pacote 02 carregado", { id: t, description: JSON.stringify((data as any)?.counts ?? {}) });
                qc.invalidateQueries();
              } catch (e: any) {
                toast.error("Falha ao carregar Pacote 02", { id: t, description: e?.message ?? String(e) });
              }
            }}
          >
            <DatabaseZap className="mr-2 h-4 w-4" />
            Carregar Pacote 02
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((s) => (
          <div key={s.l} className="card-elevated flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</p>
              <p className={`mt-2 font-display text-3xl font-bold text-${s.t}`}>{s.v}</p>
            </div>
            <div className={`grid h-10 w-10 place-items-center rounded-lg bg-${s.t}-soft text-${s.t}`}>
              <s.i className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      <section className="card-elevated p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="pendentes">Pendentes ({counters.pendentes})</TabsTrigger>
              <TabsTrigger value="aprovadas">Aprovadas ({counters.aprovadas})</TabsTrigger>
              <TabsTrigger value="rejeitadas">Rejeitadas ({counters.rejeitadas})</TabsTrigger>
              <TabsTrigger value="ajustar">Ajustar ({counters.ajustar})</TabsTrigger>
              <TabsTrigger value="todas">Todas ({counters.todas})</TabsTrigger>
            </TabsList>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por código, nome, classe…"
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value={tab} className="m-0">
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">ID</TableHead>
                    <TableHead className="w-[150px]">Código</TableHead>
                    <TableHead>Nome sugerido</TableHead>
                    <TableHead>Classe / Linha DRE</TableHead>
                    <TableHead className="text-right">Lançamentos</TableHead>
                    <TableHead className="text-right">Valor Abs.</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                  )}
                  {!isLoading && filtrada.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma conta nessa categoria.</TableCell></TableRow>
                  )}
                  {filtrada.map((r) => (
                    <TableRow key={r.id_sugestao_conta}>
                      <TableCell className="font-mono text-xs">{r.id_sugestao_conta}</TableCell>
                      <TableCell className="font-mono">{r.codigo_conta_sugerido ?? "—"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.nome_conta_sugerido ?? "—"}</div>
                        {r.nome_conta_pai_sugerido && (
                          <div className="text-xs text-muted-foreground">↳ {r.nome_conta_pai_sugerido}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{r.classe_contabil_sugerida ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.linha_dre_padrao ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.qtd_lancamentos_afetados ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(r.valor_total_abs_afetado)}</TableCell>
                      <TableCell><StatusBadge status={r.status_aprovacao} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />Decidir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Decidir conta sugerida</DialogTitle>
            <DialogDescription>{editing?.id_sugestao_conta} · {editing?.codigo_conta_sugerido} — {editing?.nome_conta_sugerido}</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
                <div><span className="text-muted-foreground">Pai:</span> {editing.codigo_conta_pai_sugerido ?? "—"} {editing.nome_conta_pai_sugerido ?? ""}</div>
                <div><span className="text-muted-foreground">Classe:</span> {editing.classe_contabil_sugerida ?? "—"}</div>
                <div><span className="text-muted-foreground">Tipo gerencial:</span> {editing.tipo_gerencial_padrao ?? "—"}</div>
                <div><span className="text-muted-foreground">Linha DRE:</span> {editing.linha_dre_padrao ?? "—"}</div>
                <div><span className="text-muted-foreground">Direto/Indireto:</span> {editing.direto_indireto_padrao ?? "—"}</div>
                <div><span className="text-muted-foreground">Fixo/Variável:</span> {editing.fixo_variavel_padrao ?? "—"}</div>
                <div><span className="text-muted-foreground">Lançamentos afetados:</span> {editing.qtd_lancamentos_afetados ?? 0}</div>
                <div><span className="text-muted-foreground">Valor abs.:</span> {fmtBRL(editing.valor_total_abs_afetado)}</div>
                {sugestoesById.get(editing.id_sugestao_conta)?.grau_confianca && (
                  <div><span className="text-muted-foreground">Confiança:</span> {sugestoesById.get(editing.id_sugestao_conta).grau_confianca}</div>
                )}
                {editing.origens_afetadas && (
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Origens:</span> {editing.origens_afetadas}</div>
                )}
                {editing.motivo_sugestao && (
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Motivo:</span> {editing.motivo_sugestao}</div>
                )}
                {sugestoesById.get(editing.id_sugestao_conta)?.exemplos_historico_ou_item && (
                  <div className="sm:col-span-2 text-xs"><span className="text-muted-foreground">Exemplos:</span> {sugestoesById.get(editing.id_sugestao_conta).exemplos_historico_ou_item}</div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decisão</label>
                  <Select value={decisao} onValueChange={(v) => setDecisao(v as AprovStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APROVADA">Aprovar</SelectItem>
                      <SelectItem value="REJEITADA">Rejeitar</SelectItem>
                      <SelectItem value="AJUSTAR">Solicitar ajuste</SelectItem>
                      <SelectItem value="AGUARDANDO_APROVACAO_USUARIO">Voltar para pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observação</label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Justifique a decisão (opcional)…"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              disabled={decidir.isPending}
              onClick={() => editing && decidir.mutate({ ids: [editing.id_sugestao_conta], status: decisao, obs: observacao })}
            >
              {decidir.isPending ? "Salvando…" : "Salvar decisão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        As decisões registradas aqui ficam em <code>stg_aprovacao_contas</code>. Apenas após aprovação, em um próximo pacote, as contas marcadas como <strong>APROVADA</strong> serão promovidas para o plano de contas definitivo.
      </p>
    </div>
  );
}
