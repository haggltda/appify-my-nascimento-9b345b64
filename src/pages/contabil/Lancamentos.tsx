import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ChevronRight, ChevronDown, Undo2, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

interface Partida {
  id: string;
  dc: "D" | "C";
  valor: number;
  historico: string | null;
  conta_contabil: { classificacao: string; descricao: string } | null;
  centro_custo: { codigo: string; nome: string } | null;
}

interface Lancamento {
  id: string;
  numero: string;
  data_lancamento: string;
  competencia: string | null;
  historico: string;
  valor_total: number;
  origem: string | null;
  origem_tipo: string | null;
  origem_id: string | null;
  status: "rascunho" | "efetivado" | "estornado";
  hash_dedup: string | null;
}

export default function Lancamentos() {
  const { data: empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [estornoTarget, setEstornoTarget] = useState<Lancamento | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [filtros, setFiltros] = useState({
    inicio: firstDay.toISOString().slice(0, 10),
    fim: today.toISOString().slice(0, 10),
    status: "all",
    origem: "all", // all | auto | manual | estorno
    busca: "",
  });

  const lancamentosQ = useQuery({
    queryKey: ["lancamentos-contabeis", empresaId, filtros],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("lancamento_contabil")
        .select("*")
        .eq("empresa_id", empresaId!)
        .gte("data_lancamento", filtros.inicio)
        .lte("data_lancamento", filtros.fim)
        .order("data_lancamento", { ascending: false })
        .order("numero", { ascending: false })
        .limit(500);
      if (filtros.status !== "all") q = q.eq("status", filtros.status as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Lancamento[];
    },
  });

  const filtrados = useMemo(() => {
    let list = lancamentosQ.data ?? [];
    if (filtros.origem === "auto") list = list.filter((l) => l.origem?.startsWith("auto:"));
    else if (filtros.origem === "manual") list = list.filter((l) => !l.origem || l.origem === "manual");
    else if (filtros.origem === "estorno") list = list.filter((l) => l.origem === "estorno");
    if (filtros.busca.trim()) {
      const t = filtros.busca.toLowerCase();
      list = list.filter(
        (l) => l.historico?.toLowerCase().includes(t) || l.numero?.toLowerCase().includes(t),
      );
    }
    return list;
  }, [lancamentosQ.data, filtros.origem, filtros.busca]);

  const totals = useMemo(() => {
    const ef = filtrados.filter((l) => l.status === "efetivado").reduce((s, l) => s + Number(l.valor_total), 0);
    const es = filtrados.filter((l) => l.status === "estornado").reduce((s, l) => s + Number(l.valor_total), 0);
    return { ef, es, count: filtrados.length };
  }, [filtrados]);

  const estornar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase.rpc("estornar_lancamento_contabil" as any, {
        p_lancamento_id: id,
        p_motivo: motivo || "Estorno manual",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Lançamento estornado", description: "Espelho gerado com D↔C invertidos" });
      qc.invalidateQueries({ queryKey: ["lancamentos-contabeis"] });
      setEstornoTarget(null);
      setMotivoEstorno("");
    },
    onError: (e: any) => toast({ title: "Erro ao estornar", description: e.message, variant: "destructive" }),
  });

  if (!empresaId) {
    return (
      <div>
        <PageHeader module="Contábil" title="Lançamentos Contábeis" breadcrumb={["Lançamentos"]} />
        <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        module="Contábil"
        breadcrumb={["Lançamentos"]}
        title="Lançamentos Contábeis"
        subtitle="Cabeçalho + partidas D/C. Lançamentos automáticos pelo motor são prefixados por 'auto:EVT-XXX'."
      />

      {/* Filtros */}
      <div className="card-elevated p-3 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" value={filtros.inicio} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" value={filtros.fim} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filtros.status} onValueChange={(v) => setFiltros({ ...filtros, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="efetivado">Efetivado</SelectItem>
              <SelectItem value="estornado">Estornado</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Origem</Label>
          <Select value={filtros.origem} onValueChange={(v) => setFiltros({ ...filtros, origem: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="auto">Automáticas (motor)</SelectItem>
              <SelectItem value="manual">Manuais</SelectItem>
              <SelectItem value="estorno">Estornos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Buscar histórico/número</Label>
          <Input value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Faturamento, EVT-005, 2026/000123…" />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-elevated p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Lançamentos</div>
          <div className="text-2xl font-semibold">{totals.count}</div>
        </div>
        <div className="card-elevated p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Efetivados</div>
          <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRL(totals.ef)}</div>
        </div>
        <div className="card-elevated p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Estornados</div>
          <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400">{fmtBRL(totals.es)}</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8"></th>
              <th className="px-3 py-2 text-left">Número</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Histórico</th>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lancamentosQ.isLoading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!lancamentosQ.isLoading && filtrados.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nenhum lançamento no período.</td></tr>
            )}
            {filtrados.map((l) => (
              <LancamentoRow
                key={l.id}
                lanc={l}
                expanded={expanded === l.id}
                onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                onEstornar={() => setEstornoTarget(l)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog estorno */}
      <Dialog open={!!estornoTarget} onOpenChange={(o) => { if (!o) { setEstornoTarget(null); setMotivoEstorno(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Estornar lançamento {estornoTarget?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Será gerado um lançamento espelho com débito e crédito invertidos. O lançamento original permanece visível, mas marcado como <Badge variant="outline">estornado</Badge>.
            </div>
            <div>
              <Label>Motivo</Label>
              <Textarea value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)} placeholder="Ex.: cancelamento de NF, lançamento em duplicidade…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstornoTarget(null)}>Cancelar</Button>
            <Button onClick={() => estornoTarget && estornar.mutate({ id: estornoTarget.id, motivo: motivoEstorno })} disabled={estornar.isPending}>
              {estornar.isPending ? "Estornando…" : "Confirmar estorno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LancamentoRow({
  lanc, expanded, onToggle, onEstornar,
}: { lanc: Lancamento; expanded: boolean; onToggle: () => void; onEstornar: () => void }) {
  const partidasQ = useQuery({
    queryKey: ["lancamento-partidas", lanc.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamento_partida")
        .select("id, dc, valor, historico, conta_contabil:conta_contabil_id(classificacao,descricao), centro_custo:centro_custo_id(codigo,nome)")
        .eq("lancamento_id", lanc.id)
        .order("dc");
      if (error) throw error;
      return (data ?? []) as unknown as Partida[];
    },
  });

  const isAuto = lanc.origem?.startsWith("auto:");
  const evento = isAuto ? lanc.origem!.replace("auto:", "") : null;

  return (
    <>
      <tr className="border-t border-border/60 hover:bg-muted/30">
        <td className="px-2">
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </td>
        <td className="px-3 py-2 font-mono text-xs">{lanc.numero}</td>
        <td className="px-3 py-2">{fmtDate(lanc.data_lancamento)}</td>
        <td className="px-3 py-2">
          <div className="line-clamp-1 max-w-md">{lanc.historico}</div>
        </td>
        <td className="px-3 py-2 text-xs">
          {evento && <Badge variant="outline" className="font-mono">{evento}</Badge>}
          {lanc.origem === "estorno" && <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400">estorno</Badge>}
          {!isAuto && lanc.origem !== "estorno" && <span className="text-muted-foreground">{lanc.origem ?? "—"}</span>}
        </td>
        <td className="px-3 py-2 text-right font-medium">{fmtBRL(lanc.valor_total)}</td>
        <td className="px-3 py-2 text-center">
          <Badge
            variant="outline"
            className={
              lanc.status === "efetivado" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" :
              lanc.status === "estornado" ? "border-rose-500/40 text-rose-600 dark:text-rose-400" :
              "border-amber-500/40 text-amber-600 dark:text-amber-400"
            }
          >
            {lanc.status}
          </Badge>
        </td>
        <td className="px-3 py-2 text-right">
          {lanc.status === "efetivado" && lanc.origem !== "estorno" && (
            <Button size="sm" variant="ghost" onClick={onEstornar} className="gap-1 text-xs">
              <Undo2 className="h-3.5 w-3.5" />Estornar
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border/40 bg-muted/20">
          <td colSpan={8} className="px-6 py-3">
            {partidasQ.isLoading && <div className="text-xs text-muted-foreground">Carregando partidas…</div>}
            {partidasQ.data && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Partidas
                  {lanc.origem_tipo && <span>· origem: {lanc.origem_tipo}</span>}
                </div>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1 w-12">D/C</th>
                      <th className="text-left px-2 py-1">Conta</th>
                      <th className="text-left px-2 py-1">Centro de Custo</th>
                      <th className="text-right px-2 py-1">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidasQ.data.map((p) => (
                      <tr key={p.id} className="border-t border-border/40">
                        <td className="px-2 py-1">
                          <Badge variant="outline" className={p.dc === "D" ? "border-sky-500/40 text-sky-600" : "border-violet-500/40 text-violet-600"}>{p.dc}</Badge>
                        </td>
                        <td className="px-2 py-1">
                          {p.conta_contabil ? (
                            <><span className="font-mono">{p.conta_contabil.classificacao}</span> {p.conta_contabil.descricao}</>
                          ) : <span className="text-muted-foreground italic">—</span>}
                        </td>
                        <td className="px-2 py-1">
                          {p.centro_custo ? `${p.centro_custo.codigo} ${p.centro_custo.nome}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">{fmtBRL(p.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
