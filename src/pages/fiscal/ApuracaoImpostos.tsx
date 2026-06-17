import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";
import { IMPOSTO_LABEL, type ApuracaoImposto } from "./types";

const fmt = (v: number | null) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export default function ApuracaoImpostos() {
  const { data: empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const today = new Date();
  const [competencia, setCompetencia] = useState(monthOf(new Date(today.getFullYear(), today.getMonth() - 1, 1)));

  const { data: apuracoes = [], isLoading } = useQuery({
    queryKey: ["apuracoes", empresaId, competencia],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("apuracao_imposto").select("*")
        .eq("empresa_id", empresaId!).eq("competencia", competencia).order("vencimento");
      if (error) throw error;
      return (data || []) as ApuracaoImposto[];
    },
  });

  const apurar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("apurar_impostos_competencia" as any, {
        _empresa_id: empresaId, _competencia: competencia,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Apuração calculada"); qc.invalidateQueries({ queryKey: ["apuracoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalDevido = apuracoes.reduce((s, a) => s + Number(a.valor_a_pagar), 0);
  const totalPago = apuracoes.filter(a => a.status === "pago").reduce((s, a) => s + Number(a.valor_pago || 0), 0);

  if (!empresaId) return <div className="p-6 text-muted-foreground">Selecione uma empresa.</div>;

  const monthLabel = new Date(competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Competência</CardTitle></CardHeader><CardContent><div className="text-xl font-bold capitalize">{monthLabel}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total devido</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(totalDevido)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pago</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{fmt(totalPago)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Apuração tributária</CardTitle>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Competência</Label>
              <Input type="month" value={competencia.slice(0, 7)} onChange={(e) => setCompetencia(`${e.target.value}-01`)} className="w-44" />
            </div>
            <Button onClick={() => apurar.mutate()} disabled={apurar.isPending}>
              {apurar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
              Calcular apuração
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : apuracoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma apuração para {monthLabel}. Clique em "Calcular apuração" para gerar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imposto</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                  <TableHead className="text-right">Devido</TableHead>
                  <TableHead className="text-right">A pagar</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apuracoes.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant="outline">{IMPOSTO_LABEL[a.imposto]}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(a.base_calculo)}</TableCell>
                    <TableCell className="text-right">{Number(a.aliquota).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{fmt(a.valor_devido)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(a.valor_a_pagar)}</TableCell>
                    <TableCell className="text-sm">{a.vencimento ? new Date(a.vencimento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge>{a.status}</Badge></TableCell>
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
