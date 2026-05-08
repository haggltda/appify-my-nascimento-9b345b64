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
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

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

  return (
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
                      {c.numero} — {c.orgao} ({fmtMoney(c.faturamento_mensal)}/mês)
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
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco_codigo} — {c.banco_nome} {c.agencia}/{c.conta}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Dados do sacado (opcional — sobrescreve o do contrato)</p>
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
  );
}
