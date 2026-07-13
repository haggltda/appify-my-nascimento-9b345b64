import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Conta = { id: string; classificacao: string; descricao: string; natureza: string; tipo: string };
type Linha = {
  data_lancamento: string;
  numero: string | null;
  historico: string;
  contrapartida: string | null;
  dc: string;
  debito: number;
  credito: number;
  saldo: number;
};

export default function Razao() {
  const { data: empresaId } = useEmpresaId();
  const today = new Date();
  const [dataIni, setDataIni] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [dataFim, setDataFim] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
  );
  const [contaId, setContaId] = useState<string>("");
  const [filtro, setFiltro] = useState("");
  const [trigger, setTrigger] = useState(0);

  const contasQ = useQuery({
    queryKey: ["razao-contas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_contabil")
        .select("id, classificacao, descricao, natureza, tipo")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("classificacao");
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const contasFiltradas = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    const arr = (contasQ.data ?? []).filter((c) => c.tipo === "analitica" || c.tipo === "ANALITICA" || !c.tipo);
    if (!t) return arr;
    return arr.filter(
      (c) =>
        c.classificacao?.toLowerCase().includes(t) ||
        c.descricao?.toLowerCase().includes(t)
    );
  }, [contasQ.data, filtro]);

  const razaoQ = useQuery({
    queryKey: ["razao", empresaId, contaId, dataIni, dataFim, trigger],
    enabled: !!empresaId && !!contaId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("razao_contabil", {
        _empresa_id: empresaId!,
        _conta_id: contaId,
        _data_ini: dataIni,
        _data_fim: dataFim,
      });
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const totD = (razaoQ.data ?? []).reduce((s, r) => s + Number(r.debito || 0), 0);
  const totC = (razaoQ.data ?? []).reduce((s, r) => s + Number(r.credito || 0), 0);
  const contaAtual = (contasQ.data ?? []).find((c) => c.id === contaId);

  if (!empresaId)
    return <div className="card-elevated p-6 text-sm text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="card-elevated p-3 space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto">
        <Label className="text-xs">Buscar conta</Label>
        <Input
          placeholder="Classificação ou descrição"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <div className="space-y-1 pt-2">
          {contasQ.isLoading && <div className="text-xs text-muted-foreground">Carregando…</div>}
          {contasFiltradas.map((c) => (
            <button
              key={c.id}
              onClick={() => setContaId(c.id)}
              className={`w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors ${
                contaId === c.id ? "bg-primary/10 ring-1 ring-primary/40" : ""
              }`}
            >
              <div className="font-mono text-primary">{c.classificacao}</div>
              <div className="text-foreground/80 line-clamp-1">{c.descricao}</div>
            </button>
          ))}
          {!contasQ.isLoading && contasFiltradas.length === 0 && (
            <div className="text-xs text-muted-foreground">Nenhuma conta.</div>
          )}
        </div>
      </aside>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Início</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <Button onClick={() => setTrigger((t) => t + 1)} className="gap-2" disabled={!contaId}>
            <Search className="h-4 w-4" />
            Gerar
          </Button>
          {contaAtual && (
            <div className="ml-auto text-xs text-muted-foreground">
              <span className="font-mono text-primary">{contaAtual.classificacao}</span>{" "}
              <span className="text-foreground">{contaAtual.descricao}</span>{" "}
              <span className="ml-2">Nat. {contaAtual.natureza}</span>
            </div>
          )}
        </div>

        {!contaId && (
          <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
            Selecione uma conta à esquerda para ver o razão.
          </div>
        )}

        {contaId && (
          <div className="card-elevated overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Lanç.</th>
                  <th className="px-3 py-2 text-left">Histórico</th>
                  <th className="px-3 py-2 text-left">Contrapartida</th>
                  <th className="px-3 py-2 text-right">Débito</th>
                  <th className="px-3 py-2 text-right">Crédito</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {razaoQ.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                )}
                {(razaoQ.data ?? []).map((r, i) => {
                  const isSaldoAnt = r.historico === "SALDO ANTERIOR";
                  return (
                    <tr
                      key={i}
                      className={`border-t border-border/60 ${isSaldoAnt ? "bg-muted/30 font-medium" : ""}`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(r.data_lancamento).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.numero ?? "-"}</td>
                      <td className="px-3 py-2">{r.historico}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.contrapartida ?? ""}</td>
                      <td className="px-3 py-2 text-right">
                        {r.debito ? fmt(Number(r.debito)) : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.credito ? fmt(Number(r.credito)) : ""}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          Number(r.saldo) < 0 ? "text-red-500" : ""
                        }`}
                      >
                        {fmt(Number(r.saldo))}
                      </td>
                    </tr>
                  );
                })}
                {!razaoQ.isLoading && (razaoQ.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Sem movimentos no período.
                    </td>
                  </tr>
                )}
              </tbody>
              {(razaoQ.data ?? []).length > 0 && (
                <tfoot className="bg-muted/40 text-xs">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wider text-muted-foreground">
                      Totais do período
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(totD)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(totC)}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
