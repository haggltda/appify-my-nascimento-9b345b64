import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Send, Check, X, ArrowRight, FileText, Paperclip, Download, Trash2,
  FileSpreadsheet, Receipt, Building2, Wallet, AlertCircle, Sparkles
} from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const BUCKET = "pre-titulos-fiscal";

const statusBadge = (s: string) => {
  const map: Record<string, any> = {
    rascunho: { v: "outline", l: "Rascunho" },
    em_aprovacao: { v: "secondary", l: "Em aprovação" },
    aprovado: { v: "default", l: "Aprovado" },
    rejeitado: { v: "destructive", l: "Rejeitado" },
    promovido: { v: "default", l: "Promovido" },
    cancelado: { v: "secondary", l: "Cancelado" },
  };
  const c = map[s] ?? { v: "outline", l: s };
  return <Badge variant={c.v}>{c.l}</Badge>;
};

export default function PreTitulosTab() {
  const qc = useQueryClient();
  const [openNovo, setOpenNovo] = useState(false);
  const [openRejeitar, setOpenRejeitar] = useState<string | null>(null);
  const [openDetalhe, setOpenDetalhe] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["pre_titulo_pagar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pre_titulo_pagar")
        .select("*, fornecedor(razao_social), conta_contabil(classificacao, descricao), centros_custo(codigo, nome)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const totalAberto = rows
      .filter((r) => ["rascunho", "em_aprovacao", "aprovado"].includes(r.status))
      .reduce((s, r) => s + Number(r.valor || 0), 0);
    const totalAprov = rows.filter((r) => r.status === "em_aprovacao").length;
    const totalPromov = rows.filter((r) => r.status === "promovido").length;
    return { totalAberto, totalAprov, totalPromov, totalLanc: rows.length };
  }, [rows]);

  const submeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("pre_titulo_submeter", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submetido para aprovação");
      qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("pre_titulo_aprovar", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aprovado");
      qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const promover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("pre_titulo_promover", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Título a pagar criado");
      qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] });
      qc.invalidateQueries({ queryKey: ["titulo_pagar"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <Receipt className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Lançamento de Notas Fiscais</h2>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Pré-título
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Lance NF, rescisões e demais documentos com rateio por centro de custo e
                anexo do PDF/XML. Fluxo: rascunho → aprovação → título a pagar.
              </p>
            </div>
          </div>
          <Button size="lg" className="gap-2 shadow-md" onClick={() => setOpenNovo(true)}>
            <Plus className="h-5 w-5" />
            Novo lançamento
          </Button>
        </div>

        <div className="relative mt-6 grid gap-3 md:grid-cols-4">
          <KpiCard icon={<Wallet className="h-4 w-4" />} label="Em aberto" value={fmtMoney(kpis.totalAberto)} />
          <KpiCard icon={<AlertCircle className="h-4 w-4" />} label="Aguardando aprovação" value={String(kpis.totalAprov)} />
          <KpiCard icon={<Check className="h-4 w-4" />} label="Promovidos" value={String(kpis.totalPromov)} />
          <KpiCard icon={<FileText className="h-4 w-4" />} label="Total de lançamentos" value={String(kpis.totalLanc)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos recentes</CardTitle>
          <CardDescription>Clique em uma linha para ver rateios e anexos</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum pré-título — clique em "Novo lançamento" para começar
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setOpenDetalhe(r.id)}
                  >
                    <TableCell className="font-mono text-xs">{r.numero_documento ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.descricao}</TableCell>
                    <TableCell>{r.fornecedor?.razao_social ?? "—"}</TableCell>
                    <TableCell>{fmtDate(r.data_vencimento)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(r.valor)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      {r.status === "rascunho" && (
                        <Button size="sm" variant="outline" onClick={() => submeter.mutate(r.id)}>
                          <Send className="h-4 w-4 mr-1" />
                          Submeter
                        </Button>
                      )}
                      {r.status === "em_aprovacao" && (
                        <>
                          <Button size="sm" onClick={() => aprovar.mutate(r.id)}>
                            <Check className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setOpenRejeitar(r.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {r.status === "aprovado" && (
                        <Button size="sm" onClick={() => promover.mutate(r.id)}>
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Promover
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openNovo && (
        <NovoPreTituloDialog
          onClose={() => {
            setOpenNovo(false);
            qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] });
          }}
        />
      )}
      {openRejeitar && (
        <RejeitarDialog
          id={openRejeitar}
          onClose={() => {
            setOpenRejeitar(null);
            qc.invalidateQueries({ queryKey: ["pre_titulo_pagar"] });
          }}
        />
      )}
      {openDetalhe && <DetalheDialog id={openDetalhe} onClose={() => setOpenDetalhe(null)} />}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/80 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

type RateioItem = {
  centro_custo_id: string;
  conta_contabil_id?: string;
  descricao?: string;
  modo: "percentual" | "valor";
  percentual: string;
  valor: string;
};

type AnexoItem = { file: File; tipo: string };

type ParcelaItem = {
  valor: string;
  data_vencimento: string;
};

const MAX_PARCELAS = 24;

function addDays(iso: string, days: number) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NovoPreTituloDialog({ onClose }: { onClose: () => void }) {
  const [empresaId, setEmpresaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [numDoc, setNumDoc] = useState("");
  const [valor, setValor] = useState("");
  const [emissao, setEmissao] = useState(new Date().toISOString().slice(0, 10));
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 10));
  const [contaContabilId, setContaContabilId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState("2");
  const [distribuicao, setDistribuicao] = useState<"manual" | "igual">("igual");
  const [parcelas, setParcelas] = useState<ParcelaItem[]>([]);
  const [rateios, setRateios] = useState<RateioItem[]>([
    { centro_custo_id: "", modo: "percentual", percentual: "100", valor: "", descricao: "" },
  ]);
  const [anexos, setAnexos] = useState<AnexoItem[]>([]);

  const valorNum = Number(valor) || 0;

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ["empresas-ativas"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("empresas").select("id, razao_social").order("razao_social");
      return data ?? [];
    },
  });
  const { data: fornecedores = [] } = useQuery<any[]>({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("fornecedor").select("id, razao_social").order("razao_social").limit(500);
      return data ?? [];
    },
  });
  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ["conta_contabil_dre", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conta_contabil")
        .select("id, classificacao, descricao, natureza, grupo_dre, centro_custo_padrao, empresa_id, ativo, tipo")
        .eq("tipo", "analitica")
        .eq("ativo", true)
        .eq("grupo_dre", "dre")
        .eq("empresa_id", empresaId)
        .order("classificacao");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: ccs = [] } = useQuery<any[]>({
    queryKey: ["centros_custo_empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("centros_custo")
        .select("id, codigo, nome, empresa_id")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("codigo");
      return data ?? [];
    },
  });

  // Mapa CC.codigo -> conta de resultado vinculada (centro_custo_padrao)
  const ccCodigoToContaId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contas) {
      if (c.centro_custo_padrao && !m.has(c.centro_custo_padrao)) {
        m.set(String(c.centro_custo_padrao), c.id);
      }
    }
    return m;
  }, [contas]);

  const totalRateio = rateios.reduce((s, r) => {
    if (r.modo === "percentual") return s + (Number(r.percentual) || 0) * valorNum / 100;
    return s + (Number(r.valor) || 0);
  }, 0);
  const diff = +(valorNum - totalRateio).toFixed(2);

  const addRateio = () =>
    setRateios((r) => [
      ...r,
      { centro_custo_id: "", modo: "percentual", percentual: "", valor: "", descricao: "" },
    ]);
  const updateRateio = (i: number, patch: Partial<RateioItem>) =>
    setRateios((r) =>
      r.map((x, k) => {
        if (k !== i) return x;
        const next = { ...x, ...patch };
        // Auto-sugerir conta contábil ao escolher CC (não sobrescreve escolha manual)
        if (patch.centro_custo_id && !x.conta_contabil_id) {
          const cc = ccs.find((c) => c.id === patch.centro_custo_id);
          if (cc) {
            const sugerida = ccCodigoToContaId.get(String(cc.codigo));
            if (sugerida) next.conta_contabil_id = sugerida;
          }
        }
        return next;
      }),
    );
  const removeRateio = (i: number) => setRateios((r) => r.filter((_, k) => k !== i));

  const handleEmpresaChange = (v: string) => {
    setEmpresaId(v);
    setContaContabilId("");
    setRateios((r) => r.map((x) => ({ ...x, centro_custo_id: "", conta_contabil_id: "" })));
  };

  const distribuirIgual = () => {
    if (rateios.length === 0) return;
    const pct = +(100 / rateios.length).toFixed(4);
    setRateios((r) => r.map((x) => ({ ...x, modo: "percentual", percentual: String(pct), valor: "" })));
  };

  // --- Parcelamento ---
  const nParc = Math.max(1, Math.min(MAX_PARCELAS, Number(numParcelas) || 1));

  const gerarParcelasIgual = (n: number, total: number, baseVenc: string): ParcelaItem[] => {
    if (n <= 0 || total <= 0) return [];
    const base = Math.floor((total * 100) / n) / 100;
    const arr: ParcelaItem[] = [];
    let soma = 0;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? +(total - soma).toFixed(2) : base;
      soma += v;
      arr.push({ valor: v.toFixed(2), data_vencimento: addDays(baseVenc, i * 30) });
    }
    return arr;
  };

  // (re)gera parcelas quando parcelado ligado, n, valor ou vencimento mudam (modo igual)
  useEffect(() => {
    if (!parcelado) {
      setParcelas([]);
      return;
    }
    if (distribuicao === "igual") {
      setParcelas(gerarParcelasIgual(nParc, valorNum, vencimento));
    } else {
      // manual: ajusta o tamanho preservando valores existentes
      setParcelas((cur) => {
        const next = [...cur];
        if (next.length < nParc) {
          for (let i = next.length; i < nParc; i++) {
            next.push({ valor: "", data_vencimento: addDays(vencimento, i * 30) });
          }
        } else if (next.length > nParc) {
          next.length = nParc;
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelado, nParc, valorNum, vencimento, distribuicao]);

  const totalParcelas = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const diffParcelas = +(valorNum - totalParcelas).toFixed(2);

  const updateParcela = (i: number, patch: Partial<ParcelaItem>) =>
    setParcelas((arr) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const removeParcela = (i: number) => {
    setParcelas((arr) => arr.filter((_, k) => k !== i));
    setNumParcelas((s) => String(Math.max(1, (Number(s) || 1) - 1)));
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const list: AnexoItem[] = Array.from(files).map((f) => ({ file: f, tipo: "nf" }));
    setAnexos((a) => [...a, ...list]);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empresaId || !descricao || !valor || !vencimento)
        throw new Error("Preencha empresa, descrição, valor e vencimento");
      if (rateios.length > 0 && Math.abs(diff) > 0.01)
        throw new Error(`Rateio não fecha (diferença ${fmtMoney(diff)})`);
      if (rateios.some((r) => !r.centro_custo_id))
        throw new Error("Toda linha de rateio precisa de um centro de custo");

      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

      const { data: pretit, error } = await (supabase as any)
        .from("pre_titulo_pagar")
        .insert({
          empresa_id: empresaId,
          fornecedor_id: fornecedorId || null,
          descricao,
          numero_documento: numDoc || null,
          valor: valorNum,
          data_emissao: emissao,
          data_vencimento: vencimento,
          competencia: competencia || null,
          conta_contabil_id: contaContabilId || null,
          observacoes: observacoes || null,
          solicitante_id: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const preId = pretit.id as string;

      // Rateios
      if (rateios.length > 0) {
        const payload = rateios.map((r) => {
          const v =
            r.modo === "percentual"
              ? +((Number(r.percentual) || 0) * valorNum / 100).toFixed(2)
              : +(Number(r.valor) || 0).toFixed(2);
          return {
            pre_titulo_id: preId,
            centro_custo_id: r.centro_custo_id,
            conta_contabil_id: r.conta_contabil_id || null,
            descricao: r.descricao || null,
            percentual: r.modo === "percentual" ? Number(r.percentual) : null,
            valor: v,
          };
        });
        const { error: er } = await (supabase as any).from("pre_titulo_rateio").insert(payload);
        if (er) throw er;
      }

      // Anexos
      for (const a of anexos) {
        const path = `${preId}/${Date.now()}-${a.file.name}`;
        const up = await supabase.storage.from(BUCKET).upload(path, a.file, {
          contentType: a.file.type,
          upsert: false,
        });
        if (up.error) throw up.error;
        const { error: anErr } = await (supabase as any).from("pre_titulo_anexo").insert({
          pre_titulo_id: preId,
          storage_path: path,
          file_name: a.file.name,
          mime_type: a.file.type,
          size_bytes: a.file.size,
          tipo: a.tipo,
          uploaded_by: userId,
        });
        if (anErr) throw anErr;
      }
    },
    onSuccess: () => {
      toast.success("Pré-título criado em rascunho");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[min(1600px,98vw)] sm:!max-w-[min(1600px,98vw)] w-[98vw] max-h-[94vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Novo lançamento de NF / pré-título
          </DialogTitle>
          <DialogDescription>
            Preencha os dados, ratee por centro de custo (obrigatório, mesmo que seja apenas 1) e anexe o documento fiscal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

        {/* Bloco 1: Documento */}
        <section className="rounded-xl border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-primary" /> Dados do documento
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3">
            <div className="md:col-span-3 lg:col-span-4">
              <Label className="text-xs">Empresa *</Label>
              <Select value={empresaId} onValueChange={handleEmpresaChange}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 lg:col-span-4">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs">Nº documento</Label>
              <Input value={numDoc} onChange={(e) => setNumDoc(e.target.value)} />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs">Valor total *</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="font-semibold text-lg" />
            </div>
            <div className="md:col-span-4 lg:col-span-6">
              <Label className="text-xs">Descrição *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Rescisão João da Silva — Obra Centro" />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs">Emissão *</Label>
              <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs">Vencimento *</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs">Competência</Label>
              <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="md:col-span-3 lg:col-span-6">
              <Label className="text-xs">Conta contábil (default)</Label>
              <Select value={contaContabilId} onValueChange={setContaContabilId} disabled={!empresaId}>
                <SelectTrigger><SelectValue placeholder={empresaId ? (contas.length ? "Opcional — usada quando a linha de rateio não tiver conta" : "Nenhuma conta de resultado para esta empresa") : "Selecione a empresa primeiro"} /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.classificacao} — {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-6 lg:col-span-6">
              <Label className="text-xs">Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
        </section>

        {/* Bloco 2: Rateio */}
        <section className="rounded-xl border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> Rateio por centro de custo <span className="text-xs text-muted-foreground font-normal">(obrigatório — mesmo que seja 1 só)</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={distribuirIgual} disabled={rateios.length === 0}>
                Dividir igual
              </Button>
              <Button type="button" size="sm" onClick={addRateio}>
                <Plus className="h-4 w-4 mr-1" /> Linha
              </Button>
            </div>
          </div>

          {rateios.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Adicione pelo menos 1 centro de custo clicando em <strong>+ Linha</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Centro de custo</TableHead>
                    <TableHead className="w-[24%]">Conta / verba</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[110px]">Modo</TableHead>
                    <TableHead className="w-[110px] text-right">%</TableHead>
                    <TableHead className="w-[140px] text-right">Valor</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateios.map((r, i) => {
                    const calcValor =
                      r.modo === "percentual"
                        ? (Number(r.percentual) || 0) * valorNum / 100
                        : Number(r.valor) || 0;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Select value={r.centro_custo_id} onValueChange={(v) => updateRateio(i, { centro_custo_id: v })} disabled={!empresaId}>
                            <SelectTrigger><SelectValue placeholder={empresaId ? "CC..." : "Selecione a empresa"} /></SelectTrigger>
                            <SelectContent>
                              {ccs.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={r.conta_contabil_id ?? ""} onValueChange={(v) => updateRateio(i, { conta_contabil_id: v })} disabled={!empresaId}>
                            <SelectTrigger><SelectValue placeholder={empresaId ? "Auto pelo CC..." : "Selecione a empresa"} /></SelectTrigger>
                            <SelectContent>
                              {contas.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.classificacao} — {c.descricao}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.descricao ?? ""}
                            onChange={(e) => updateRateio(i, { descricao: e.target.value })}
                            placeholder="Verba / obra..."
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={r.modo} onValueChange={(v: any) => updateRateio(i, { modo: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentual">%</SelectItem>
                              <SelectItem value="valor">R$</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={r.percentual}
                            disabled={r.modo !== "percentual"}
                            onChange={(e) => updateRateio(i, { percentual: e.target.value })}
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {r.modo === "percentual" ? (
                            <span className="text-sm font-medium">{fmtMoney(calcValor)}</span>
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              value={r.valor}
                              onChange={(e) => updateRateio(i, { valor: e.target.value })}
                              className="text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeRateio(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Separator className="my-3" />
              <div className="flex flex-wrap items-center justify-end gap-6 text-sm">
                <div>NF: <span className="font-semibold">{fmtMoney(valorNum)}</span></div>
                <div>Rateado: <span className="font-semibold">{fmtMoney(totalRateio)}</span></div>
                <div className={Math.abs(diff) > 0.01 ? "text-destructive font-bold" : "text-emerald-600 font-bold"}>
                  Diferença: {fmtMoney(diff)}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Bloco 3: Anexos */}
        <section className="rounded-xl border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Paperclip className="h-4 w-4 text-primary" /> Anexos (NF, rescisão, boletos)
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <span className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                <Plus className="h-4 w-4" /> Adicionar arquivo
              </span>
            </label>
          </div>
          {anexos.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Arraste arquivos ou clique em "Adicionar arquivo" — PDF, XML, imagens.
            </div>
          ) : (
            <ul className="space-y-2">
              {anexos.map((a, i) => (
                <li key={i} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{a.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(a.file.size / 1024).toFixed(1)} KB · {a.file.type || "?"}
                    </div>
                  </div>
                  <Select value={a.tipo} onValueChange={(v) => setAnexos((arr) => arr.map((x, k) => (k === i ? { ...x, tipo: v } : x)))}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nf">Nota fiscal</SelectItem>
                      <SelectItem value="rescisao">Rescisão</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setAnexos((arr) => arr.filter((_, k) => k !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        </div>

        <DialogFooter className="px-6 py-3 border-t sticky bottom-0 bg-background z-10 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar rascunho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: pretit } = useQuery<any>({
    queryKey: ["pre_titulo_pagar", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pre_titulo_pagar")
        .select("*, fornecedor(razao_social), conta_contabil(classificacao, descricao)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });
  const { data: rateios = [] } = useQuery<any[]>({
    queryKey: ["pre_titulo_rateio", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pre_titulo_rateio")
        .select("*, centros_custo(codigo, nome), conta_contabil(classificacao, descricao)")
        .eq("pre_titulo_id", id);
      return data ?? [];
    },
  });
  const { data: anexos = [] } = useQuery<any[]>({
    queryKey: ["pre_titulo_anexo", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pre_titulo_anexo")
        .select("*")
        .eq("pre_titulo_id", id);
      return data ?? [];
    },
  });

  const baixar = async (a: any) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Pré-título {pretit?.numero_documento ? `· ${pretit.numero_documento}` : ""}
          </DialogTitle>
          <DialogDescription>{pretit?.descricao}</DialogDescription>
        </DialogHeader>

        {pretit && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Valor" value={fmtMoney(pretit.valor)} highlight />
            <Info label="Vencimento" value={fmtDate(pretit.data_vencimento)} />
            <Info label="Emissão" value={fmtDate(pretit.data_emissao)} />
            <Info label="Status" value={pretit.status} />
            <Info label="Fornecedor" value={pretit.fornecedor?.razao_social ?? "—"} />
            <Info label="Conta" value={pretit.conta_contabil ? `${pretit.conta_contabil.classificacao} — ${pretit.conta_contabil.descricao}` : "—"} />
          </div>
        )}

        <Separator />

        <div>
          <div className="font-semibold flex items-center gap-2 mb-2">
            <FileSpreadsheet className="h-4 w-4" /> Rateio ({rateios.length})
          </div>
          {rateios.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem rateio.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CC</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateios.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.centros_custo?.codigo}</TableCell>
                    <TableCell>{r.conta_contabil ? `${r.conta_contabil.classificacao} — ${r.conta_contabil.descricao}` : "—"}</TableCell>
                    <TableCell>{r.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.percentual ? `${r.percentual}%` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(r.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Separator />

        <div>
          <div className="font-semibold flex items-center gap-2 mb-2">
            <Paperclip className="h-4 w-4" /> Anexos ({anexos.length})
          </div>
          {anexos.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum anexo.</div>
          ) : (
            <ul className="space-y-2">
              {anexos.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{a.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.tipo ?? "—"} · {((a.size_bytes ?? 0) / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => baixar(a)}>
                    <Download className="h-4 w-4 mr-1" /> Abrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${highlight ? "text-lg font-bold" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function RejeitarDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [motivo, setMotivo] = useState("");
  const rejeitar = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) throw new Error("Informe o motivo");
      const { error } = await (supabase as any).rpc("pre_titulo_rejeitar", { _id: id, _motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejeitado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rejeitar pré-título</DialogTitle></DialogHeader>
        <div>
          <Label>Motivo</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => rejeitar.mutate()} disabled={rejeitar.isPending}>
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
