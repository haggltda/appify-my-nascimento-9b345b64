import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { CheckCircle2, AlertTriangle, ClipboardCheck, PackageCheck, Eye } from "lucide-react";
import { toast } from "sonner";

const statusBadge = (s: string) => {
  const map: Record<string, { v: any; l: string }> = {
    aguardando: { v: "outline", l: "Aguardando" },
    em_conferencia: { v: "default", l: "Em conferência" },
    recebido: { v: "default", l: "Recebido" },
    recebido_com_ocorrencia: { v: "destructive", l: "Com ocorrência" },
    cancelado: { v: "secondary", l: "Cancelado" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

const ocorStatusBadge = (s: string) => {
  const map: Record<string, any> = {
    aberta: { v: "destructive", l: "Aberta" },
    em_tratativa: { v: "default", l: "Em tratativa" },
    resolvida: { v: "outline", l: "Resolvida" },
    cancelada: { v: "secondary", l: "Cancelada" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

export default function Recebimentos() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("recebimentos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const { data: recebimentos = [], isLoading } = useQuery<any[]>({
    queryKey: ["recebimento_nf"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("recebimento_nf")
        .select("*, nf_entrada(numero, serie, fornecedor_razao, valor_total, origem)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ocorrencias = [] } = useQuery<any[]>({
    queryKey: ["recebimento_ocorrencia"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("recebimento_ocorrencia")
        .select("*").order("aberta_em", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtradas = useMemo(() => recebimentos.filter((r) =>
    filtroStatus === "todos" || r.status === filtroStatus
  ), [recebimentos, filtroStatus]);

  const kpis = useMemo(() => ({
    total: recebimentos.length,
    aguardando: recebimentos.filter((r) => r.status === "aguardando").length,
    conferencia: recebimentos.filter((r) => r.status === "em_conferencia").length,
    ocorrencias: recebimentos.filter((r) => r.status === "recebido_com_ocorrencia").length,
    abertas: ocorrencias.filter((o) => o.status === "aberta").length,
  }), [recebimentos, ocorrencias]);

  // Detalhe / conferência
  const [recebSel, setRecebSel] = useState<any>(null);
  const [openDet, setOpenDet] = useState(false);

  const { data: itens = [] } = useQuery<any[]>({
    queryKey: ["recebimento_nf_item", recebSel?.id],
    queryFn: async () => {
      if (!recebSel?.id) return [];
      const { data, error } = await (supabase as any).from("recebimento_nf_item")
        .select("*, produto(codigo, descricao)")
        .eq("recebimento_id", recebSel.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!recebSel?.id,
  });

  const updItem = useMutation({
    mutationFn: async ({ id, patch }: any) => {
      const { error } = await (supabase as any).from("recebimento_nf_item").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recebimento_nf_item", recebSel?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const iniciar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("recebimento_nf")
        .update({ status: "em_conferencia", iniciado_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conferência iniciada"); qc.invalidateQueries({ queryKey: ["recebimento_nf"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("recebimento_confirmar", { _recebimento_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Recebimento confirmado: ${d?.itens_lancados ?? 0} item(ns) no estoque, ${d?.ocorrencias_abertas ?? 0} ocorrência(s).`, { duration: 6000 });
      qc.invalidateQueries({ queryKey: ["recebimento_nf"] });
      qc.invalidateQueries({ queryKey: ["recebimento_ocorrencia"] });
      qc.invalidateQueries({ queryKey: ["nf_entrada"] });
      setOpenDet(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Ocorrência - tratar
  const [ocorSel, setOcorSel] = useState<any>(null);
  const [tratativa, setTratativa] = useState("");
  const tratarOcor = useMutation({
    mutationFn: async (status: "em_tratativa" | "resolvida" | "cancelada") => {
      const patch: any = { status, tratativa };
      if (status === "resolvida") {
        const { data: u } = await supabase.auth.getUser();
        patch.resolvida_por = u.user?.id; patch.resolvida_em = new Date().toISOString();
      }
      const { error } = await (supabase as any).from("recebimento_ocorrencia").update(patch).eq("id", ocorSel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência atualizada");
      qc.invalidateQueries({ queryKey: ["recebimento_ocorrencia"] });
      setOcorSel(null); setTratativa("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recebimento de Mercadorias"
        subtitle="Conferência física obrigatória antes da entrada no estoque."
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{kpis.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Aguardando</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{kpis.aguardando}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Em conferência</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{kpis.conferencia}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Com ocorrência</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{kpis.ocorrencias}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ocor. abertas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{kpis.abertas}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="recebimentos"><ClipboardCheck className="h-4 w-4 mr-2" />Recebimentos</TabsTrigger>
          <TabsTrigger value="ocorrencias"><AlertTriangle className="h-4 w-4 mr-2" />Ocorrências ({kpis.abertas})</TabsTrigger>
        </TabsList>

        <TabsContent value="recebimentos" className="space-y-3">
          <div className="flex gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="em_conferencia">Em conferência</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="recebido_com_ocorrencia">Com ocorrência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>NF</TableHead><TableHead>Fornecedor</TableHead><TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead><TableHead>Criado</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
                  {!isLoading && filtradas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum recebimento</TableCell></TableRow>}
                  {filtradas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nf_entrada?.numero ?? "-"}/{r.nf_entrada?.serie ?? "1"}</TableCell>
                      <TableCell className="text-sm">{r.nf_entrada?.fornecedor_razao ?? "-"}</TableCell>
                      <TableCell><Badge variant="outline">{r.nf_entrada?.origem ?? "-"}</Badge></TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => { setRecebSel(r); setOpenDet(true); }}>
                          <Eye className="h-4 w-4 mr-1" />Conferir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ocorrencias">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead>
                  <TableHead>Aberta em</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ocorrencias.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma ocorrência</TableCell></TableRow>}
                  {ocorrencias.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell><Badge variant="outline">{o.tipo}</Badge></TableCell>
                      <TableCell className="text-sm">{o.descricao}</TableCell>
                      <TableCell>{ocorStatusBadge(o.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.aberta_em).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        {o.status !== "resolvida" && o.status !== "cancelada" && (
                          <Button size="sm" variant="outline" onClick={() => { setOcorSel(o); setTratativa(o.tratativa ?? ""); }}>Tratar</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalhe / Conferência */}
      <Dialog open={openDet} onOpenChange={setOpenDet}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência - NF {recebSel?.nf_entrada?.numero}/{recebSel?.nf_entrada?.serie}</DialogTitle>
          </DialogHeader>
          {recebSel && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {statusBadge(recebSel.status)}
                <Badge variant="outline">{recebSel.nf_entrada?.origem}</Badge>
                <span className="text-sm text-muted-foreground">{recebSel.nf_entrada?.fornecedor_razao}</span>
              </div>
              {recebSel.status === "aguardando" && (
                <Button onClick={() => iniciar.mutate(recebSel.id)} disabled={iniciar.isPending}>
                  Iniciar conferência
                </Button>
              )}

              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd NF</TableHead>
                  <TableHead className="text-right w-32">Qtd Recebida</TableHead>
                  <TableHead className="w-40">Condição</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24">Conferido</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.id} className={i.qtd_recebida !== i.qtd_nf || i.condicao !== "ok" ? "bg-warning/10" : ""}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{i.produto?.codigo ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{i.produto?.descricao}</div>
                      </TableCell>
                      <TableCell className="text-right">{Number(i.qtd_nf).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <Input type="number" step="0.0001" value={i.qtd_recebida}
                          disabled={recebSel.status !== "em_conferencia"}
                          onChange={(e) => updItem.mutate({ id: i.id, patch: { qtd_recebida: parseFloat(e.target.value) || 0 } })}
                          className="text-right" />
                      </TableCell>
                      <TableCell>
                        <Select value={i.condicao} disabled={recebSel.status !== "em_conferencia"}
                          onValueChange={(v) => updItem.mutate({ id: i.id, patch: { condicao: v } })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ok">OK</SelectItem>
                            <SelectItem value="avariado">Avariado</SelectItem>
                            <SelectItem value="trocado">Trocado</SelectItem>
                            <SelectItem value="faltante">Faltante</SelectItem>
                            <SelectItem value="excedente">Excedente</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input value={i.observacoes ?? ""} disabled={recebSel.status !== "em_conferencia"}
                          onChange={(e) => updItem.mutate({ id: i.id, patch: { observacoes: e.target.value } })} />
                      </TableCell>
                      <TableCell>
                        <input type="checkbox" checked={i.conferido} disabled={recebSel.status !== "em_conferencia"}
                          onChange={(e) => updItem.mutate({ id: i.id, patch: { conferido: e.target.checked, conferido_em: new Date().toISOString() } })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                ℹ️ Itens com quantidade ou condição divergentes geram <strong>ocorrência automática</strong> ao confirmar (estoque entra mesmo assim - política "aceitar e abrir ocorrência").
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDet(false)}>Fechar</Button>
            {recebSel && recebSel.status === "em_conferencia" && (
              <Button onClick={() => confirmar.mutate(recebSel.id)} disabled={confirmar.isPending}>
                <PackageCheck className="h-4 w-4 mr-2" />Confirmar e lançar no estoque
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tratar ocorrência */}
      <Dialog open={!!ocorSel} onOpenChange={(o) => !o && setOcorSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tratar ocorrência</DialogTitle></DialogHeader>
          {ocorSel && (
            <div className="space-y-3">
              <div className="text-sm"><strong>Tipo:</strong> {ocorSel.tipo}</div>
              <div className="text-sm"><strong>Descrição:</strong> {ocorSel.descricao}</div>
              <div>
                <Label>Tratativa</Label>
                <Textarea value={tratativa} onChange={(e) => setTratativa(e.target.value)}
                  placeholder="Ex: solicitada nota de débito ao fornecedor / aceito ressarcimento / produto devolvido…" rows={4} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => tratarOcor.mutate("em_tratativa")} disabled={tratarOcor.isPending}>Em tratativa</Button>
            <Button variant="destructive" onClick={() => tratarOcor.mutate("cancelada")} disabled={tratarOcor.isPending}>Cancelar</Button>
            <Button onClick={() => tratarOcor.mutate("resolvida")} disabled={tratarOcor.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
