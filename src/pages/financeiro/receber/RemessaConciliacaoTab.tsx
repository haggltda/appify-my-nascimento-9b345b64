import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Send, Upload, RefreshCcw, Download, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDateTime = (d: any) => (d ? new Date(d).toLocaleString("pt-BR") : "-");

export default function RemessaConciliacaoTab() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const [openGerar, setOpenGerar] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  const { data: remessas = [], isLoading } = useQuery<any[]>({
    queryKey: ["remessa-cnab", empresaId],
    queryFn: async () => {
      let q = (supabase as any).from("remessa_cnab")
        .select("*, conta_bancaria(banco_codigo, banco_nome, agencia, conta)")
        .order("created_at", { ascending: false }).limit(100);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.origem === "cobranca");
    },
  });

  const { data: matches = [] } = useQuery<any[]>({
    queryKey: ["conciliacao-pendente", empresaId],
    queryFn: async () => {
      let q = (supabase as any).from("conciliacao_match")
        .select("*, extrato_bancario(data_movimento, descricao, valor, tipo), titulo_receber(numero, sacado_nome, valor)")
        .eq("status", "sugerido")
        .order("created_at", { ascending: false }).limit(50);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const auto = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione uma empresa");
      const { data, error } = await (supabase as any).rpc("conciliacao_auto_match", { _empresa_id: empresaId });
      if (error) throw error;
      return data;
    },
    onSuccess: (r: any) => {
      toast.success(`Conciliação executada: ${r?.matches ?? 0} sugestão(ões)`);
      qc.invalidateQueries({ queryKey: ["conciliacao-pendente"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixarRemessa = (r: any) => {
    const blob = new Blob([r.arquivo_conteudo ?? ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.arquivo_nome ?? `remessa-${r.id}.rem`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardDescription>Remessas geradas</CardDescription><CardTitle className="text-3xl">{remessas.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Conciliações sugeridas</CardDescription><CardTitle className="text-3xl">{matches.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Ambiente CNAB</CardDescription><CardTitle className="text-base">
          <Badge variant="outline">Pronto - pendente integração com banco</Badge>
        </CardTitle></CardHeader></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpenGerar(true)} size="sm"><Send className="h-4 w-4 mr-2" /> Gerar remessa de boletos</Button>
        <Button onClick={() => setOpenImport(true)} size="sm" variant="outline"><Upload className="h-4 w-4 mr-2" /> Importar extrato</Button>
        <Button onClick={() => auto.mutate()} size="sm" variant="outline" disabled={auto.isPending || !empresaId}><RefreshCcw className="h-4 w-4 mr-2" /> Conciliar automaticamente</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Remessas CNAB de cobrança</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Gerada em</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && remessas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma remessa gerada</TableCell></TableRow>}
              {remessas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.arquivo_nome}</TableCell>
                  <TableCell className="text-xs">{r.conta_bancaria?.banco_codigo} {r.conta_bancaria?.banco_nome}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(r.data_geracao_arquivo ?? r.created_at)}</TableCell>
                  <TableCell className="text-right">{r.qtd_registros}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.valor_total)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => baixarRemessa(r)}><Download className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sugestões de conciliação</CardTitle>
          <CardDescription>Match entre extrato bancário e títulos a receber. Confirme para baixar automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data extrato</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Título sugerido</TableHead>
                <TableHead>Sacado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma sugestão pendente</TableCell></TableRow>}
              {matches.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{m.extrato_bancario?.data_movimento}</TableCell>
                  <TableCell className="text-xs truncate max-w-[280px]">{m.extrato_bancario?.descricao}</TableCell>
                  <TableCell className="text-right">{fmtMoney(m.extrato_bancario?.valor)}</TableCell>
                  <TableCell className="font-mono text-xs">{m.titulo_receber?.numero ?? "-"}</TableCell>
                  <TableCell className="text-xs">{m.titulo_receber?.sacado_nome ?? "-"}</TableCell>
                  <TableCell>
                    <ConfirmarMatch matchId={m.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {openGerar && <GerarRemessaDialog onClose={(ok) => { setOpenGerar(false); if (ok) qc.invalidateQueries({ queryKey: ["remessa-cnab"] }); }} />}
      {openImport && <ImportarExtratoDialog onClose={(ok) => { setOpenImport(false); if (ok) qc.invalidateQueries({ queryKey: ["conciliacao-pendente"] }); }} />}
    </div>
  );
}

function ConfirmarMatch({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("conciliacao_match")
        .update({ status: "confirmado", confirmado_em: new Date().toISOString() }).eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Match confirmado"); qc.invalidateQueries({ queryKey: ["conciliacao-pendente"] }); qc.invalidateQueries({ queryKey: ["titulo_receber"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return <Button size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate()}><FileCheck2 className="h-4 w-4 mr-1" /> Confirmar</Button>;
}

function GerarRemessaDialog({ onClose }: { onClose: (ok: boolean) => void }) {
  const empresaId = useEmpresaId();
  const [contaId, setContaId] = useState<string>("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-cnab", empresaId],
    queryFn: async () => {
      let q = (supabase as any).from("conta_bancaria").select("id, banco_codigo, banco_nome, agencia, conta, cnab_convenio").eq("ativa", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q; if (error) throw error;
      return data ?? [];
    },
  });

  const { data: boletos = [] } = useQuery<any[]>({
    queryKey: ["boletos-pendentes-remessa", contaId],
    queryFn: async () => {
      if (!contaId) return [];
      const { data, error } = await (supabase as any).from("cobranca_boleto")
        .select("id, nosso_numero, status_registro, titulo_receber(numero, sacado_nome, valor, data_vencimento)")
        .eq("conta_bancaria_id", contaId)
        .in("status_registro", ["a_enviar", "pendente", "rejeitado"])
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contaId,
  });

  const toggleAll = () => {
    if (selecionados.size === boletos.length) setSelecionados(new Set());
    else setSelecionados(new Set(boletos.map((b) => b.id)));
  };

  const gerar = useMutation({
    mutationFn: async () => {
      if (!contaId) throw new Error("Selecione a conta bancária");
      if (selecionados.size === 0) throw new Error("Selecione pelo menos um boleto");
      const { data, error } = await (supabase as any).rpc("cnab_gerar_remessa_cobranca", {
        _conta_bancaria_id: contaId,
        _boleto_ids: Array.from(selecionados),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (r: any) => { toast.success(`Remessa ${r?.numero} gerada com ${r?.qtd} boleto(s)`); onClose(true); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar remessa CNAB de cobrança</DialogTitle>
          <DialogDescription>Selecione conta bancária e boletos a serem registrados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={(v) => { setContaId(v); setSelecionados(new Set()); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.banco_codigo} {c.banco_nome} {c.agencia}/{c.conta} {!c.cnab_convenio && "⚠️ sem convênio"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {contaId && (
            <div className="border rounded-md max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={boletos.length > 0 && selecionados.size === boletos.length} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead>Nosso Nº</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Sacado</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Nenhum boleto pendente nesta conta</TableCell></TableRow>}
                  {boletos.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Checkbox checked={selecionados.has(b.id)} onCheckedChange={(v) => {
                          setSelecionados((s) => { const ns = new Set(s); if (v) ns.add(b.id); else ns.delete(b.id); return ns; });
                        }} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{b.nosso_numero}</TableCell>
                      <TableCell className="font-mono text-xs">{b.titulo_receber?.numero}</TableCell>
                      <TableCell className="text-xs">{b.titulo_receber?.sacado_nome}</TableCell>
                      <TableCell className="text-right">{fmtMoney(b.titulo_receber?.valor)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{b.status_registro}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => gerar.mutate()} disabled={gerar.isPending || !contaId || selecionados.size === 0}>
            Gerar remessa ({selecionados.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarExtratoDialog({ onClose }: { onClose: (ok: boolean) => void }) {
  const empresaId = useEmpresaId();
  const [contaId, setContaId] = useState<string>("");
  const [formato, setFormato] = useState<string>("ofx");
  const [conteudo, setConteudo] = useState("");

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-import", empresaId],
    queryFn: async () => {
      let q = (supabase as any).from("conta_bancaria").select("id, banco_codigo, banco_nome, agencia, conta").eq("ativa", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q; return data ?? [];
    },
  });

  const importar = useMutation({
    mutationFn: async () => {
      if (!contaId) throw new Error("Selecione a conta bancária");
      if (!conteudo.trim()) throw new Error("Cole o conteúdo do extrato");
      const { data, error } = await (supabase as any).rpc("extrato_importar", {
        _conta_bancaria_id: contaId,
        _formato: formato,
        _conteudo: conteudo,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (r: any) => { toast.success(`Extrato importado: ${r?.qtd_movimentos ?? 0} movimentos`); onClose(true); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar extrato bancário</DialogTitle>
          <DialogDescription>Formatos suportados: OFX, CNAB240 retorno, CSV simples.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta bancária</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} {c.banco_nome} {c.agencia}/{c.conta}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ofx">OFX</SelectItem>
                  <SelectItem value="cnab240">CNAB 240 retorno</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Conteúdo do arquivo</Label>
            <Textarea rows={10} value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Cole aqui o conteúdo do extrato..." className="font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => importar.mutate()} disabled={importar.isPending}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
