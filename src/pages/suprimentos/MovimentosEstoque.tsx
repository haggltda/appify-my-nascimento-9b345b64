import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { useList } from "@/hooks/useGenericCrud";
import { fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";

const fmtQtd = (n: any) => Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const tipoLabel: Record<string, { label: string; variant: any }> = {
  entrada: { label: "Entrada", variant: "default" },
  saida: { label: "Saída", variant: "secondary" },
  consumo: { label: "Consumo", variant: "secondary" },
  transferencia: { label: "Transf.", variant: "outline" },
  ajuste: { label: "Ajuste", variant: "outline" },
  reserva: { label: "Reserva", variant: "outline" },
  liberacao_reserva: { label: "Lib. reserva", variant: "outline" },
};

export default function MovimentosEstoque() {
  const { data: almoxarifados = [] } = useList<any>("almoxarifado", { orderBy: "codigo", ascending: true });
  const { data: produtos = [] } = useList<any>("produto", { orderBy: "codigo", ascending: true });

  const [filtroAlmox, setFiltroAlmox] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  const { data: movimentos = [], isLoading } = useQuery<any[]>({
    queryKey: ["estoque_movimento", "list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_movimento")
        .select("*")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const prodMap = useMemo(() => Object.fromEntries(produtos.map((p: any) => [p.id, p])), [produtos]);
  const almoxMap = useMemo(() => Object.fromEntries(almoxarifados.map((a: any) => [a.id, a])), [almoxarifados]);

  const filtrados = movimentos.filter((m) => {
    if (filtroAlmox !== "todos" && m.almoxarifado_id !== filtroAlmox) return false;
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (busca) {
      const p = prodMap[m.produto_id];
      const txt = `${p?.codigo ?? ""} ${p?.descricao ?? ""} ${m.documento ?? ""}`.toLowerCase();
      if (!txt.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Movimentações de Estoque" subtitle="Histórico imutável de todas as entradas, saídas, transferências e ajustes." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">{filtrados.length} movimento(s) - últimos 500</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroAlmox} onValueChange={setFiltroAlmox}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os almoxarifados</SelectItem>
                {almoxarifados.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.codigo} - {a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Almoxarifado</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Custo un.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Documento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((m) => {
                  const p = prodMap[m.produto_id];
                  const a = almoxMap[m.almoxarifado_id];
                  const t = tipoLabel[m.tipo] ?? { label: m.tipo, variant: "outline" };
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.data_movimento).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant={t.variant} className="text-[10px]">{t.label}</Badge></TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{m.origem.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs">{a?.codigo ?? "-"}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{p?.codigo ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{p?.descricao}</div>
                      </TableCell>
                      <TableCell className="text-right">{fmtQtd(m.quantidade)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(m.custo_unitario)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBRL(m.valor_total)}</TableCell>
                      <TableCell className="text-xs">{m.documento ?? "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
