import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, FileText, CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, type NotaFiscal, type NfTipo, type NfOrigem } from "./types";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function NotasFiscais() {
  const { data: empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [openEmitir, setOpenEmitir] = useState(false);
  const [openCancelar, setOpenCancelar] = useState<NotaFiscal | null>(null);
  const [motivoCancel, setMotivoCancel] = useState("");

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas_fiscais", empresaId, filtroStatus],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase.from("nota_fiscal").select("*").eq("empresa_id", empresaId!).order("created_at", { ascending: false }).limit(200);
      if (filtroStatus !== "todos") q = q.eq("status", filtroStatus as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as NotaFiscal[];
    },
  });

  const autorizar = useMutation({
    mutationFn: async (nf_id: string) => {
      const { error } = await supabase.rpc("nota_fiscal_autorizar" as any, { _nf_id: nf_id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nota autorizada"); qc.invalidateQueries({ queryKey: ["notas_fiscais"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      if (!openCancelar) return;
      const { error } = await supabase.rpc("nota_fiscal_cancelar" as any, { _nf_id: openCancelar.id, _motivo: motivoCancel });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota cancelada");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      setOpenCancelar(null); setMotivoCancel("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const kpis = {
    autorizadas: notas.filter(n => n.status === "autorizada").length,
    rascunho: notas.filter(n => n.status === "rascunho").length,
    valorTotal: notas.filter(n => n.status === "autorizada").reduce((s, n) => s + Number(n.valor_total || 0), 0),
    impostos: notas.filter(n => n.status === "autorizada").reduce((s, n) => s + Number(n.valor_iss || 0) + Number(n.valor_pis || 0) + Number(n.valor_cofins || 0), 0),
  };

  if (!empresaId) return <div className="p-6 text-muted-foreground">Selecione uma empresa para visualizar notas fiscais.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Autorizadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpis.autorizadas}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Em rascunho</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{kpis.rascunho}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Faturado (autorizadas)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(kpis.valorTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Impostos retidos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(kpis.impostos)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notas Fiscais</CardTitle>
          <div className="flex gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="autorizada">Autorizada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="rejeitada">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={openEmitir} onOpenChange={setOpenEmitir}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Emitir nota</Button>
              </DialogTrigger>
              <EmitirDialog empresaId={empresaId} onClose={() => setOpenEmitir(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["notas_fiscais"] })} />
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : notas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
              Nenhuma nota fiscal encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº/Série</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tomador</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">ISS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-mono text-xs">{nf.numero ?? "—"}/{nf.serie ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{nf.tipo.toUpperCase()}</Badge></TableCell>
                    <TableCell>
                      <div className="text-sm">{nf.tomador_nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">{nf.tomador_documento}</div>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(nf.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(nf.valor_total))}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(Number(nf.valor_iss))}</TableCell>
                    <TableCell><Badge className={STATUS_COLOR[nf.status]}>{STATUS_LABEL[nf.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(nf.status === "rascunho" || nf.status === "emitida") && (
                          <Button size="sm" variant="ghost" onClick={() => autorizar.mutate(nf.id)} title="Autorizar">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {nf.status === "autorizada" && (
                          <Button size="sm" variant="ghost" onClick={() => setOpenCancelar(nf)} title="Cancelar">
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {nf.link_pdf && (
                          <a href={nf.link_pdf} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openCancelar} onOpenChange={(o) => !o && setOpenCancelar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar nota {openCancelar?.numero}/{openCancelar?.serie}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Motivo do cancelamento (mínimo 15 caracteres)</Label>
            <Textarea value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} rows={3} placeholder="Descreva o motivo legal do cancelamento..." />
            <div className="text-xs text-muted-foreground">{motivoCancel.length}/15 caracteres</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancelar(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => cancelar.mutate()} disabled={motivoCancel.length < 15 || cancelar.isPending}>
              {cancelar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmitirDialog({ empresaId, onClose, onSaved }: { empresaId: string; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<NfTipo>("nfse");
  const [origem, setOrigem] = useState<NfOrigem>("avulsa");
  const [tomadorNome, setTomadorNome] = useState("");
  const [tomadorDoc, setTomadorDoc] = useState("");
  const [tomadorEmail, setTomadorEmail] = useState("");
  const [valorServ, setValorServ] = useState("");
  const [valorProd, setValorProd] = useState("");
  const [discriminacao, setDiscriminacao] = useState("");
  const [codigoServ, setCodigoServ] = useState("");
  const [tituloId, setTituloId] = useState<string>("");

  const { data: titulos = [] } = useQuery({
    queryKey: ["titulos_para_nf", empresaId],
    enabled: !!empresaId && origem === "titulo",
    queryFn: async () => {
      const { data } = await supabase.from("titulo_receber").select("id, numero, sacado_nome, sacado_documento, valor_total")
        .eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const emitir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("nota_fiscal_emitir" as any, {
        _empresa_id: empresaId, _tipo: tipo, _origem: origem,
        _tomador_nome: tomadorNome, _tomador_documento: tomadorDoc,
        _tomador_email: tomadorEmail || null,
        _valor_servicos: Number(valorServ) || 0,
        _valor_produtos: Number(valorProd) || 0,
        _discriminacao: discriminacao || null,
        _codigo_servico: codigoServ || null,
        _titulo_receber_id: origem === "titulo" && tituloId ? tituloId : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Nota criada em rascunho"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Emitir nova nota fiscal</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
              <SelectItem value="nfe">NF-e (Produtos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Origem</Label>
          <Select value={origem} onValueChange={(v: any) => setOrigem(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avulsa">Avulsa</SelectItem>
              <SelectItem value="titulo">Vincular a título</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {origem === "titulo" && (
          <div className="col-span-2">
            <Label>Título a receber</Label>
            <Select value={tituloId} onValueChange={(v) => {
              setTituloId(v);
              const t: any = titulos.find((x: any) => x.id === v);
              if (t) {
                setTomadorNome(t.sacado_nome || "");
                setTomadorDoc(t.sacado_documento || "");
                setValorServ(String(t.valor_total || ""));
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione um título..." /></SelectTrigger>
              <SelectContent>
                {titulos.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.numero} — {t.sacado_nome} — {fmt(Number(t.valor_total))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="col-span-2">
          <Label>Nome do tomador *</Label>
          <Input value={tomadorNome} onChange={(e) => setTomadorNome(e.target.value)} />
        </div>
        <div>
          <Label>CNPJ/CPF *</Label>
          <Input value={tomadorDoc} onChange={(e) => setTomadorDoc(e.target.value)} placeholder="Apenas números" />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={tomadorEmail} onChange={(e) => setTomadorEmail(e.target.value)} />
        </div>
        <div>
          <Label>Valor serviços</Label>
          <Input type="number" step="0.01" value={valorServ} onChange={(e) => setValorServ(e.target.value)} />
        </div>
        <div>
          <Label>Valor produtos</Label>
          <Input type="number" step="0.01" value={valorProd} onChange={(e) => setValorProd(e.target.value)} />
        </div>
        {tipo === "nfse" && (
          <div className="col-span-2">
            <Label>Código do serviço (LC 116)</Label>
            <Input value={codigoServ} onChange={(e) => setCodigoServ(e.target.value)} placeholder="Ex: 17.01" />
          </div>
        )}
        <div className="col-span-2">
          <Label>Discriminação / descrição</Label>
          <Textarea value={discriminacao} onChange={(e) => setDiscriminacao(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => emitir.mutate()} disabled={!tomadorNome || !tomadorDoc || emitir.isPending}>
          {emitir.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Criar em rascunho
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
