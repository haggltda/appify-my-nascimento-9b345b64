import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, Search, ChevronLeft, ChevronRight, Lock } from "lucide-react";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 50;

type Row = {
  id: string;
  versao_id: string;
  periodo_id: string;
  dre_linha_id: string;
  centro_custo_id: string | null;
  valor: number;
  memoria_calculo: string | null;
  // joined
  linha_codigo?: string;
  linha_descricao?: string;
  cc_codigo?: string | null;
  cc_nome?: string | null;
  mes?: number;
};

export default function OrcamentoCompleto() {
  const { roles } = usePermissoes();
  const canEdit = roles.includes("admin") || roles.includes("controladoria") || roles.includes("presidencia");

  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [empresaId, setEmpresaId] = useState<string | undefined>();
  const [versaoId, setVersaoId] = useState<string | undefined>();
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroCC, setFiltroCC] = useState("");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [dirty, setDirty] = useState<Record<string, { valor?: number; centro_custo_id?: string | null; memoria_calculo?: string | null }>>({});
  const qc = useQueryClient();

  const empresasQ = useQuery({
    queryKey: ["empresas-orc"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("empresas").select("id, codigo, razao_social").eq("ativa", true).order("codigo");
      if (error) throw error;
      return data as Array<{ id: string; codigo: string; razao_social: string }>;
    },
  });

  useEffect(() => {
    if (!empresaId && empresasQ.data?.length) setEmpresaId(empresasQ.data[0].id);
  }, [empresasQ.data, empresaId]);

  const versoesQ = useQuery({
    queryKey: ["versoes-orc", empresaId, ano],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obz_versoes")
        .select("id, nome, versao, revisao, status")
        .eq("empresa_id", empresaId).eq("ano", ano)
        .order("revisao", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; nome: string; versao: number; revisao: number; status: string }>;
    },
  });

  useEffect(() => {
    if (versoesQ.data?.length) setVersaoId(versoesQ.data[0].id);
    else setVersaoId(undefined);
  }, [versoesQ.data]);

  const ccsQ = useQuery({
    queryKey: ["ccs-orc", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("centros_custo").select("id, codigo, nome, tipo")
        .eq("empresa_id", empresaId).eq("ativo", true).order("codigo");
      if (error) throw error;
      return data as Array<{ id: string; codigo: string; nome: string; tipo: string }>;
    },
  });

  const linhasQ = useQuery({
    queryKey: ["dre-linhas-orc", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dre_linhas").select("id, codigo, descricao, natureza, ordem")
        .eq("empresa_id", empresaId).eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Array<{ id: string; codigo: string; descricao: string; natureza: string; ordem: number }>;
    },
  });

  const periodosQ = useQuery({
    queryKey: ["periodos-orc", versaoId],
    enabled: !!versaoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obz_periodos").select("id, mes, status").eq("versao_id", versaoId).order("mes");
      if (error) throw error;
      return data as Array<{ id: string; mes: number; status: string }>;
    },
  });

  const valoresQ = useQuery({
    queryKey: ["obz-valores", versaoId],
    enabled: !!versaoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obz_valores")
        .select("id, versao_id, periodo_id, dre_linha_id, centro_custo_id, valor, memoria_calculo")
        .eq("versao_id", versaoId).limit(50000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const rows: Row[] = useMemo(() => {
    const linhaMap = new Map(linhasQ.data?.map((l) => [l.id, l]) ?? []);
    const ccMap = new Map(ccsQ.data?.map((c) => [c.id, c]) ?? []);
    const perMap = new Map(periodosQ.data?.map((p) => [p.id, p.mes]) ?? []);
    return (valoresQ.data ?? []).map((r) => ({
      ...r,
      linha_codigo: linhaMap.get(r.dre_linha_id)?.codigo,
      linha_descricao: linhaMap.get(r.dre_linha_id)?.descricao,
      cc_codigo: r.centro_custo_id ? ccMap.get(r.centro_custo_id)?.codigo ?? null : null,
      cc_nome: r.centro_custo_id ? ccMap.get(r.centro_custo_id)?.nome ?? null : null,
      mes: perMap.get(r.periodo_id),
    }));
  }, [valoresQ.data, linhasQ.data, ccsQ.data, periodosQ.data]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filtroMes !== "todos" && r.mes !== Number(filtroMes)) return false;
      if (filtroLinha && !((r.linha_codigo ?? "") + " " + (r.linha_descricao ?? "")).toLowerCase().includes(filtroLinha.toLowerCase())) return false;
      if (filtroCC && !((r.cc_codigo ?? "") + " " + (r.cc_nome ?? "")).toLowerCase().includes(filtroCC.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.linha_codigo ?? "").localeCompare(b.linha_codigo ?? "") || (a.mes ?? 0) - (b.mes ?? 0));
  }, [rows, filtroLinha, filtroCC, filtroMes]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [filtroLinha, filtroCC, filtroMes, versaoId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(dirty);
      for (const [id, patch] of updates) {
        const { error } = await (supabase as any).from("obz_valores").update(patch).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Orçamento salvo", description: `${Object.keys(dirty).length} linha(s) atualizada(s).` });
      setDirty({});
      qc.invalidateQueries({ queryKey: ["obz-valores", versaoId] });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const totalGeral = useMemo(() => filtered.reduce((s, r) => s + Number(dirty[r.id]?.valor ?? r.valor ?? 0), 0), [filtered, dirty]);

  return (
    <div className="space-y-4">
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Controladoria", "Orçamento Completo"]}
        title="Orçamento Completo (OBZ) — Edição"
        subtitle="Visualize e edite o orçamento linha a linha. Permissão de edição: Presidência, Controladoria e Admin."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled={!Object.keys(dirty).length} onClick={() => setDirty({})}>
              <RotateCcw className="mr-2 h-4 w-4" /> Descartar
            </Button>
            <Button disabled={!canEdit || !Object.keys(dirty).length || saveMut.isPending} onClick={() => saveMut.mutate()}>
              <Save className="mr-2 h-4 w-4" /> Salvar {Object.keys(dirty).length > 0 && `(${Object.keys(dirty).length})`}
            </Button>
          </div>
        }
      />

      {!canEdit && (
        <div className="card-elevated flex items-center gap-2 border-l-4 border-warning p-3 text-sm">
          <Lock className="h-4 w-4 text-warning" />
          Você está em modo somente leitura. Apenas Presidência, Controladoria e Admin podem editar.
        </div>
      )}

      <div className="card-elevated grid gap-3 p-4 md:grid-cols-6">
        <div>
          <Label>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {(empresasQ.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ano</Label>
          <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())} />
        </div>
        <div className="md:col-span-2">
          <Label>Versão OBZ</Label>
          <Select value={versaoId} onValueChange={setVersaoId}>
            <SelectTrigger><SelectValue placeholder="Selecione uma versão" /></SelectTrigger>
            <SelectContent>
              {(versoesQ.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  v{v.versao}.{v.revisao} — {v.nome} [{v.status}]
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Filtrar Linha DRE</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} placeholder="Código ou descrição" className="pl-8" />
          </div>
        </div>
        <div>
          <Label>Filtrar Centro de Custo</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={filtroCC} onChange={(e) => setFiltroCC(e.target.value)} placeholder="Código ou nome" className="pl-8" />
          </div>
        </div>
        <div>
          <Label>Mês</Label>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-elevated p-4">
          <p className="text-xs uppercase text-muted-foreground">Linhas filtradas</p>
          <p className="font-display text-2xl font-bold">{filtered.length.toLocaleString("pt-BR")}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs uppercase text-muted-foreground">Total (filtro atual)</p>
          <p className={`font-display text-2xl font-bold ${totalGeral < 0 ? "text-destructive" : ""}`}>{fmt(totalGeral)}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs uppercase text-muted-foreground">Alterações pendentes</p>
          <p className="font-display text-2xl font-bold text-info">{Object.keys(dirty).length}</p>
        </div>
      </div>

      <div className="card-elevated overflow-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 bg-muted/70 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Linha DRE</th>
              <th className="px-3 py-2 text-left">Centro de Custo</th>
              <th className="px-3 py-2 text-center w-20">Mês</th>
              <th className="px-3 py-2 text-right w-40">Valor (R$)</th>
              <th className="px-3 py-2 text-left">Memória de cálculo</th>
            </tr>
          </thead>
          <tbody>
            {valoresQ.isLoading && (
              <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!valoresQ.isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">
                {versaoId ? "Nenhuma linha encontrada com os filtros aplicados." : "Selecione uma versão OBZ."}
              </td></tr>
            )}
            {pageRows.map((r) => {
              const patch = dirty[r.id] ?? {};
              const valor = patch.valor ?? Number(r.valor);
              const cc = patch.centro_custo_id ?? r.centro_custo_id;
              const memo = patch.memoria_calculo ?? r.memoria_calculo ?? "";
              const isDirty = !!dirty[r.id];
              return (
                <tr key={r.id} className={`border-t border-border/60 ${isDirty ? "bg-warning/5" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-primary">{r.linha_codigo}</div>
                    <div>{r.linha_descricao}</div>
                  </td>
                  <td className="px-3 py-2 min-w-[240px]">
                    {canEdit ? (
                      <Select
                        value={cc ?? "__none__"}
                        onValueChange={(v) => setDirty((d) => ({ ...d, [r.id]: { ...d[r.id], centro_custo_id: v === "__none__" ? null : v } }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Sem CC —</SelectItem>
                          {(ccsQ.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs">{r.cc_codigo ? `${r.cc_codigo} — ${r.cc_nome}` : "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="outline">{r.mes ? MESES[r.mes - 1] : "—"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={valor}
                        onChange={(e) => setDirty((d) => ({ ...d, [r.id]: { ...d[r.id], valor: Number(e.target.value) } }))}
                        className="h-8 text-right tabular-nums"
                      />
                    ) : (
                      <span className={`tabular-nums ${valor < 0 ? "text-destructive" : ""}`}>{fmt(valor)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Input
                        value={memo}
                        onChange={(e) => setDirty((d) => ({ ...d, [r.id]: { ...d[r.id], memoria_calculo: e.target.value } }))}
                        className="h-8 text-xs"
                        placeholder="Ex.: 12 × R$ 5.000 (folha)"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{memo || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Página {page + 1} de {pageCount} — exibindo {pageRows.length} de {filtered.length.toLocaleString("pt-BR")} linhas ({PAGE_SIZE}/página)
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
