import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { toast } from "sonner";

const fmtMoney = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

interface NotaRegistro {
  id: string;
  empresa_id: string | null;
  empresa_codigo: string;
  cliente_contrato: string;
  nota: string;
  competencia: string | null;
  data_referencia: string;
  valor: number;
  dias_atraso: number;
  contrato_id: string | null;
  contrato_descontinuado: boolean;
}

interface ContratoOpcao {
  id: string;
  nome: string;
  empresa_id: string;
  status: string;
}

export default function RegistroNotasTab() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState("TODAS");
  const [somentePendentes, setSomentePendentes] = useState(false);

  const { data: notas = [], isLoading } = useQuery<NotaRegistro[]>({
    queryKey: ["cobranca-relatorio-nota-registro"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cobranca_relatorio_nota")
        .select("id, empresa_id, empresa_codigo, cliente_contrato, nota, competencia, data_referencia, valor, dias_atraso, contrato_id, contrato_descontinuado")
        .order("cliente_contrato", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contratos = [] } = useQuery<ContratoOpcao[]>({
    queryKey: ["contratos-para-vinculo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("contratos").select("id, nome, empresa_id, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const contratoPorId = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cobranca-relatorio-nota-registro"] });
    qc.invalidateQueries({ queryKey: ["cobranca-relatorio-nota"] });
  };

  const vincular = useMutation({
    mutationFn: async ({ clienteContrato, contratoId }: { clienteContrato: string; contratoId: string }) => {
      const { error } = await (supabase as any)
        .from("cobranca_relatorio_nota")
        .update({ contrato_id: contratoId, contrato_descontinuado: false })
        .eq("cliente_contrato", clienteContrato);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(`Contrato vinculado a todas as notas de "${vars.clienteContrato}".`);
      invalidar();
    },
    onError: (err: any) => toast.error("Erro ao vincular: " + err.message),
  });

  const marcarDescontinuado = useMutation({
    mutationFn: async (clienteContrato: string) => {
      const { error } = await (supabase as any)
        .from("cobranca_relatorio_nota")
        .update({ contrato_descontinuado: true })
        .eq("cliente_contrato", clienteContrato);
      if (error) throw error;
    },
    onSuccess: (_data, clienteContrato) => {
      toast.success(`"${clienteContrato}" marcado como contrato descontinuado.`);
      invalidar();
    },
    onError: (err: any) => toast.error("Erro ao marcar: " + err.message),
  });

  const empresas = useMemo(() => Array.from(new Set(notas.map((n) => n.empresa_codigo))).sort(), [notas]);

  const notasFiltradas = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    return notas
      .filter((n) => empresaFiltro === "TODAS" || n.empresa_codigo === empresaFiltro)
      .filter((n) => !somentePendentes || (!n.contrato_id && !n.contrato_descontinuado))
      .filter((n) => !termo || n.cliente_contrato.toUpperCase().includes(termo) || n.nota.includes(termo));
  }, [notas, busca, empresaFiltro, somentePendentes]);

  const totalPendente = notas.filter((n) => !n.contrato_id && !n.contrato_descontinuado).length;
  const totalDescontinuado = notas.filter((n) => n.contrato_descontinuado).length;

  const opcoesContratoPara = (empresaId: string | null): SearchableOption[] =>
    contratos
      .filter((c) => !empresaId || c.empresa_id === empresaId)
      .map((c) => ({ value: c.id, label: c.nome, hint: c.status !== "ativo" ? c.status : undefined }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Cliente/contrato ou nota"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as empresas</SelectItem>
            {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={somentePendentes} onCheckedChange={(v) => setSomentePendentes(v === true)} />
          Só pendências de vínculo
        </label>
        <div className="ml-auto flex gap-2">
          {totalPendente > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
              {totalPendente} pendente(s) de vínculo
            </Badge>
          )}
          {totalDescontinuado > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              {totalDescontinuado} contrato(s) descontinuado(s)
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">Empresa</th>
                  <th className="px-2 py-2 text-left">Cliente/Contrato (planilha)</th>
                  <th className="px-2 py-2 text-left">Nota</th>
                  <th className="px-2 py-2 text-left">Competência</th>
                  <th className="px-2 py-2 text-left">Data Ref.</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-right">Dias</th>
                  <th className="px-2 py-2 text-left">Vínculo com contrato ERP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!isLoading && notasFiltradas.length === 0 && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">Nenhuma nota encontrada.</td></tr>
                )}
                {notasFiltradas.map((n) => {
                  const contrato = n.contrato_id ? contratoPorId.get(n.contrato_id) : null;
                  return (
                    <tr key={n.id} className="border-t">
                      <td className="px-2 py-1">{n.empresa_codigo}</td>
                      <td className="px-2 py-1 max-w-[220px] truncate" title={n.cliente_contrato}>{n.cliente_contrato}</td>
                      <td className="px-2 py-1">{n.nota}</td>
                      <td className="px-2 py-1">{n.competencia || "—"}</td>
                      <td className="px-2 py-1">{fmtData(n.data_referencia)}</td>
                      <td className="px-2 py-1 text-right">{fmtMoney(Number(n.valor))}</td>
                      <td className="px-2 py-1 text-right">{n.dias_atraso}</td>
                      <td className="px-2 py-1 min-w-[280px]">
                        {n.contrato_id ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-[10px]">vinculado</Badge>
                            {contrato && contrato.status !== "ativo" && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                contrato {contrato.status}
                              </Badge>
                            )}
                          </div>
                        ) : n.contrato_descontinuado ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">contrato descontinuado</Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <SearchableSelect
                              value={null}
                              onChange={(contratoId) => vincular.mutate({ clienteContrato: n.cliente_contrato, contratoId })}
                              options={opcoesContratoPara(n.empresa_id)}
                              placeholder="Vincular contrato..."
                              searchPlaceholder="Buscar contrato..."
                              triggerClassName="h-7 text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2 text-[10px] text-muted-foreground"
                              onClick={() => marcarDescontinuado.mutate(n.cliente_contrato)}
                            >
                              Descontinuado
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
