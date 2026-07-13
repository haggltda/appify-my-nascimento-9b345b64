import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Receipt, FileSearch, ChevronRight, CalendarRange, Send } from "lucide-react";
import { toast } from "sonner";
import { useEmitirTituloDeCronograma, useEmitirTitulosLote } from "@/hooks/useTituloReceber";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "-");

export default function FaturamentoContratoTab({ onFaturado }: { onFaturado?: () => void }) {
  const [contratoId, setContratoId] = useState<string>("");
  const [competencia, setCompetencia] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [valor, setValor] = useState<string>("");
  const [vencimento, setVencimento] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [meio, setMeio] = useState<string>("boleto");
  const [contaId, setContaId] = useState<string>("");
  const [sacadoNome, setSacadoNome] = useState("");
  const [sacadoDoc, setSacadoDoc] = useState("");
  const [sacadoEmail, setSacadoEmail] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: contratos = [] } = useQuery<any[]>({
    queryKey: ["contratos-ativos-faturar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contrato")
        .select("id, numero, orgao, valor_total, faturamento_mensal, vigencia_inicio, vigencia_fim, status, empresa_id")
        .order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias-fat"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("conta_bancaria")
        .select("id, banco_codigo, banco_nome, agencia, conta")
        .eq("ativa", true).order("banco_nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const contrato = useMemo(() => contratos.find((c) => c.id === contratoId), [contratoId, contratos]);

  // Pré-popula valor com faturamento_mensal quando troca contrato
  const aplicarSugestaoValor = () => {
    if (contrato?.faturamento_mensal) setValor(String(contrato.faturamento_mensal));
    if (contrato?.orgao && !sacadoNome) setSacadoNome(contrato.orgao);
  };

  const { data: jaFaturados = [] } = useQuery<any[]>({
    queryKey: ["faturados-contrato", contratoId],
    queryFn: async () => {
      if (!contratoId) return [];
      const { data, error } = await (supabase as any).from("titulo_receber")
        .select("id, numero, competencia, valor, data_vencimento, status")
        .eq("contrato_id", contratoId).order("competencia", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contratoId,
  });

  const faturar = useMutation({
    mutationFn: async () => {
      if (!contratoId) throw new Error("Selecione um contrato");
      if (!valor || Number(valor) <= 0) throw new Error("Informe um valor válido");
      const { data, error } = await (supabase as any).rpc("faturar_contrato_competencia", {
        _contrato_id: contratoId,
        _competencia: competencia,
        _valor: Number(valor),
        _data_vencimento: vencimento,
        _meio_cobranca: meio,
        _conta_bancaria_id: contaId || null,
        _sacado_nome: sacadoNome || null,
        _sacado_documento: sacadoDoc || null,
        _sacado_email: sacadoEmail || null,
        _descricao: descricao || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Título ${d.numero} gerado!`);
      setValor("");
      onFaturado?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Parcelas pendentes do cronograma do contrato selecionado
  const { data: parcelasCronograma = [] } = useQuery<any[]>({
    queryKey: ["cronograma-pendentes", contratoId],
    queryFn: async () => {
      if (!contratoId) return [];
      const { data, error } = await (supabase as any)
        .from("cronograma_faturamento")
        .select("id, competencia, valor_previsto, valor_emitido, status, data_recebimento_previsto, numero_nf")
        .eq("contrato_id", contratoId)
        .order("competencia");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contratoId,
  });

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const emitirSingle = useEmitirTituloDeCronograma();
  const emitirLote = useEmitirTitulosLote();

  const elegiveis = parcelasCronograma.filter((p) => p.status === "previsto" || p.status === "atrasado");
  const totalSelecionado = elegiveis
    .filter((p) => selecionadas.has(p.id))
    .reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0);

  const toggle = (id: string) => {
    setSelecionadas((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelecionadas((s) => (s.size === elegiveis.length ? new Set() : new Set(elegiveis.map((p) => p.id))));
  };

  const handleEmitirLote = async () => {
    const ids = Array.from(selecionadas);
    if (ids.length === 0) return;
    if (!confirm(`Emitir ${ids.length} título(s) totalizando ${fmtMoney(totalSelecionado)}?`)) return;
    await emitirLote.mutateAsync({ ids, meio_cobranca: meio, conta_bancaria_id: contaId || null });
    setSelecionadas(new Set());
    onFaturado?.();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      previsto: "bg-info-soft text-info",
      emitido: "bg-warning-soft text-warning",
      recebido: "bg-success-soft text-success",
      atrasado: "bg-destructive/15 text-destructive",
      cancelado: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={`text-[10px] ${map[s] ?? ""}`}>{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      {contratoId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarRange className="h-4 w-4" /> Cronograma do contrato
                </CardTitle>
                <CardDescription>
                  Selecione parcelas previstas e emita os títulos a receber.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {selecionadas.size} selecionada(s) · {fmtMoney(totalSelecionado)}
                </span>
                <Button
                  size="sm"
                  onClick={handleEmitirLote}
                  disabled={selecionadas.size === 0 || emitirLote.isPending}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Emitir selecionados
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={elegiveis.length > 0 && selecionadas.size === elegiveis.length}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor previsto</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasCronograma.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                      Nenhuma parcela no cronograma. Gere o orçamento do contrato primeiro.
                    </TableCell>
                  </TableRow>
                )}
                {parcelasCronograma.map((p) => {
                  const isElegivel = p.status === "previsto" || p.status === "atrasado";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={selecionadas.has(p.id)}
                          disabled={!isElegivel}
                          onCheckedChange={() => toggle(p.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {new Date(p.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{fmtMoney(p.valor_previsto)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.data_recebimento_previsto)}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{p.numero_nf ?? "-"}</TableCell>
                      <TableCell>
                        {isElegivel && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={emitirSingle.isPending}
                            onClick={() =>
                              emitirSingle.mutate({
                                cronograma_id: p.id,
                                meio_cobranca: meio,
                                conta_bancaria_id: contaId || null,
                              })
                            }
                          >
                            <Send className="h-3 w-3 mr-1" /> Emitir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Faturar contrato (manual por medição)</CardTitle>
          <CardDescription>Gera um título a receber para a competência selecionada do contrato.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Contrato</Label>
              <Select value={contratoId} onValueChange={(v) => { setContratoId(v); setTimeout(aplicarSugestaoValor, 0); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um contrato..." /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} - {c.orgao} ({fmtMoney(c.faturamento_mensal)}/mês)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {contrato && (
              <div className="md:col-span-2 rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div><strong>Vigência:</strong> {fmtDate(contrato.vigencia_inicio)} → {fmtDate(contrato.vigencia_fim)}</div>
                <div><strong>Valor total:</strong> {fmtMoney(contrato.valor_total)} • <strong>Faturamento mensal:</strong> {fmtMoney(contrato.faturamento_mensal)}</div>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={aplicarSugestaoValor}>
                  Usar valor mensal sugerido
                </Button>
              </div>
            )}

            <div>
              <Label>Competência (mês de referência)</Label>
              <Input type="month" value={competencia.slice(0, 7)} onChange={(e) => setCompetencia(`${e.target.value}-01`)} />
            </div>
            <div><Label>Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>
            <div>
              <Label>Meio de cobrança</Label>
              <Select value={meio} onValueChange={setMeio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Conta bancária (recebimento)</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} - {c.banco_nome} {c.agencia}/{c.conta}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Dados do sacado (opcional - sobrescreve o do contrato)</p>
            </div>
            <div><Label>Sacado / Tomador</Label><Input value={sacadoNome} onChange={(e) => setSacadoNome(e.target.value)} placeholder="Razão social" /></div>
            <div><Label>CNPJ/CPF</Label><Input value={sacadoDoc} onChange={(e) => setSacadoDoc(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>E-mail</Label><Input type="email" value={sacadoEmail} onChange={(e) => setSacadoEmail(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Discriminação dos serviços..." /></div>
          </div>

          <Button onClick={() => faturar.mutate()} disabled={faturar.isPending || !contratoId} className="w-full" size="lg">
            <Receipt className="h-4 w-4 mr-2" /> Gerar título a receber
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileSearch className="h-4 w-4" /> Já faturados</CardTitle>
          <CardDescription>Últimos títulos deste contrato</CardDescription>
        </CardHeader>
        <CardContent>
          {!contratoId ? (
            <p className="text-sm text-muted-foreground text-center py-8">Selecione um contrato</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comp.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jaFaturados.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Nenhum título</TableCell></TableRow>}
                {jaFaturados.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{new Date(t.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" })}</TableCell>
                    <TableCell className="text-right text-xs">{fmtMoney(t.valor)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
