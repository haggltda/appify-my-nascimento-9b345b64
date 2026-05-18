import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, RotateCcw, Inbox as InboxIcon, Wallet, ShoppingCart, Calculator, Target } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

type Origem = "financeiro" | "compras" | "obz" | "plano";

interface ItemAprov {
  id: string;
  origem: Origem;
  ref_id: string;          // id do objeto a aprovar (programacao, requisicao, etc.)
  titulo: string;
  descricao: string;
  valor: number | null;
  data: string | null;
  empresa_id: string;
  link: string;
}

const ORIGEM_META: Record<Origem, { label: string; icon: any; cls: string }> = {
  financeiro: { label: "Financeiro", icon: Wallet, cls: "border-l-4 border-l-emerald-500" },
  compras:    { label: "Compras",    icon: ShoppingCart, cls: "border-l-4 border-l-amber-500" },
  obz:        { label: "OBZ",        icon: Calculator, cls: "border-l-4 border-l-violet-500" },
  plano:      { label: "Plano",      icon: Target, cls: "border-l-4 border-l-blue-500" },
};

export default function InboxAprovacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<"todos" | Origem>("todos");
  const [decisao, setDecisao] = useState<{ item: ItemAprov; tipo: "aprovado" | "rejeitado" | "devolvido" } | null>(null);
  const [justif, setJustif] = useState("");

  // Origem 1: financeiro_pagamento_aprovacao pendentes para mim
  const financeiroQ = useQuery({
    queryKey: ["inbox-financeiro"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await (supabase as any)
        .from("financeiro_pagamento_aprovacao")
        .select("id, programacao_id, empresa_id, etapa, valor_aprovado, data_pagamento_aprovada, created_at, malote_pagamento:programacao_id(descricao, qtd_titulos)")
        .eq("aprovador_id", u.user.id)
        .eq("decisao", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any): ItemAprov => ({
        id: r.id,
        origem: "financeiro",
        ref_id: r.programacao_id,
        titulo: `Programação de pagamento — etapa ${r.etapa}`,
        descricao: r.malote_pagamento?.descricao ?? `${r.malote_pagamento?.qtd_titulos ?? 0} título(s)`,
        valor: Number(r.valor_aprovado || 0),
        data: r.data_pagamento_aprovada,
        empresa_id: r.empresa_id,
        link: `/app/financeiro/programacao-pagamentos?id=${r.programacao_id}`,
      }));
    },
  });

  const itens = useMemo(() => {
    const all: ItemAprov[] = [...(financeiroQ.data ?? [])];
    // TODO: agregar compras (sup_aprov_instancia), obz (obz_versao), plano (plano_acao)
    return filtro === "todos" ? all : all.filter((x) => x.origem === filtro);
  }, [financeiroQ.data, filtro]);

  const counts = useMemo(() => {
    const all = [...(financeiroQ.data ?? [])];
    return {
      todos: all.length,
      financeiro: all.filter((x) => x.origem === "financeiro").length,
      compras: 0, obz: 0, plano: 0,
    };
  }, [financeiroQ.data]);

  const totalValor = useMemo(() => itens.reduce((s, i) => s + (i.valor ?? 0), 0), [itens]);

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
      setDecisao(null); setJustif("");
      qc.invalidateQueries({ queryKey: ["inbox-financeiro"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Aguardando Minha Aprovação"
        subtitle="Inbox unificado: tudo que depende da sua decisão, em todas as áreas."
        module="Aprovações"
        breadcrumb={["Aprovações", "Inbox"]}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase">Pendentes comigo</CardDescription>
            <CardTitle className="text-2xl">{counts.todos}</CardTitle></CardHeader>
        </Card>
        <Card className="border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase">Valor total</CardDescription>
            <CardTitle className="text-2xl">{fmtMoney(totalValor)}</CardTitle></CardHeader>
        </Card>
        <Card className="border-t-4 border-t-amber-500">
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase">Financeiro</CardDescription>
            <CardTitle className="text-2xl">{counts.financeiro}</CardTitle></CardHeader>
        </Card>
        <Card className="border-t-4 border-t-slate-400">
          <CardHeader className="pb-2"><CardDescription className="text-[11px] font-semibold uppercase">Outros módulos</CardDescription>
            <CardTitle className="text-2xl">{counts.compras + counts.obz + counts.plano}</CardTitle></CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base"><InboxIcon className="h-4 w-4" />Pendências</CardTitle>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
              <TabsList>
                <TabsTrigger value="todos">Todos ({counts.todos})</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro ({counts.financeiro})</TabsTrigger>
                <TabsTrigger value="compras" disabled>Compras (em breve)</TabsTrigger>
                <TabsTrigger value="obz" disabled>OBZ (em breve)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {financeiroQ.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="font-medium">Nada para aprovar agora ✨</p>
              <p className="text-sm text-muted-foreground">Quando algo entrar na sua alçada, aparecerá aqui e no sino.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => {
                  const meta = ORIGEM_META[it.origem]; const Icon = meta.icon;
                  return (
                    <TableRow key={`${it.origem}-${it.id}`} className={meta.cls}>
                      <TableCell><Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" />{meta.label}</Badge></TableCell>
                      <TableCell className="font-medium">{it.titulo}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{it.descricao}</TableCell>
                      <TableCell className="text-right font-mono">{fmtMoney(it.valor ?? 0)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(it.data)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => navigate(it.link)}>Ver</Button>
                          <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setDecisao({ item: it, tipo: "aprovado" }); setJustif(""); }}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setDecisao({ item: it, tipo: "devolvido" }); setJustif(""); }}>
                            <RotateCcw className="h-4 w-4 mr-1" />Devolver
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setDecisao({ item: it, tipo: "rejeitado" }); setJustif(""); }}>
                            <XCircle className="h-4 w-4 mr-1" />Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!decisao} onOpenChange={(o) => !o && setDecisao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao?.tipo === "aprovado" ? "Aprovar item" : decisao?.tipo === "devolvido" ? "Devolver para ajuste" : "Rejeitar item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">{decisao?.item.titulo}</div>
            <div className="text-sm text-muted-foreground">{decisao?.item.descricao} — {fmtMoney(decisao?.item.valor ?? 0)}</div>
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
