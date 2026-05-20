import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileDown, FileSpreadsheet, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

const fmtBRL = (n: number | string | null) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

type Linha = {
  total_count: number;
  origem: string;
  data_lcto: string;
  lcto_numero: string | null;
  conta_classif: string | null;
  conta_desc: string | null;
  conta_natureza: string | null;
  conta_grupo: string | null;
  cc_codigo: string | null;
  cc_nome: string | null;
  contrato_num: string | null;
  historico: string | null;
  documento: string | null;
  debito: number | string;
  credito: number | string;
};

export default function RazaoDetalhado() {
  const { data: empresaId } = useEmpresaId();
  const { user } = useAuth();
  const location = useLocation();

  const today = new Date();
  const [dataIni, setDataIni] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [dataFim, setDataFim] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10),
  );
  const [contaId, setContaId] = useState<string>("__all__");
  const [classifPrefix, setClassifPrefix] = useState("");
  const [classifDe, setClassifDe] = useState("");
  const [classifAte, setClassifAte] = useState("");
  const [natureza, setNatureza] = useState<string>("__all__");
  const [grupo, setGrupo] = useState<string>("__all__");
  const [ccId, setCcId] = useState<string>("__all__");
  const [contratoId, setContratoId] = useState<string>("__all__");
  const [origem, setOrigem] = useState<string>("__all__");
  const [busca, setBusca] = useState("");
  const [incluirSaldoAnterior, setIncluirSaldoAnterior] = useState(false);
  const [page, setPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

  function aplicarPreset(preset: string) {
    const t = new Date();
    const y = t.getFullYear();
    const m = t.getMonth();
    let di: Date, df: Date;
    switch (preset) {
      case "mes": di = new Date(y, m, 1); df = new Date(y, m + 1, 0); break;
      case "mes_ant": di = new Date(y, m - 1, 1); df = new Date(y, m, 0); break;
      case "trim": di = new Date(y, m - 2, 1); df = new Date(y, m + 1, 0); break;
      case "ano": di = new Date(y, 0, 1); df = new Date(y, 11, 31); break;
      case "ano_ant": di = new Date(y - 1, 0, 1); df = new Date(y - 1, 11, 31); break;
      case "acumulado": di = new Date(y, 0, 1); df = t; break;
      default: return;
    }
    setDataIni(di.toISOString().slice(0, 10));
    setDataFim(df.toISOString().slice(0, 10));
    setPage(1);
  }

  // Combos
  const contasQ = useQuery({
    queryKey: ["rd-contas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_contabil")
        .select("id, classificacao, descricao, natureza, grupo_dre")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("classificacao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ccsQ = useQuery({
    queryKey: ["rd-ccs", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const contratosQ = useQuery({
    queryKey: ["rd-contratos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contrato")
        .select("id, numero, objeto")
        .eq("empresa_id", empresaId!)
        .order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const gruposDre = useMemo(() => {
    const set = new Set<string>();
    (contasQ.data ?? []).forEach((c: any) => {
      if (c.grupo_dre) set.add(String(c.grupo_dre));
    });
    return Array.from(set).sort();
  }, [contasQ.data]);

  const baseFilters = useMemo(
    () => ({
      _empresa_id: empresaId!,
      _data_ini: dataIni,
      _data_fim: dataFim,
      _conta_id: contaId === "__all__" ? null : contaId,
      _classificacao_prefix: classifPrefix.trim() || null,
      _natureza: natureza === "__all__" ? null : natureza,
      _grupo_dre: grupo === "__all__" ? null : grupo,
      _cc_id: ccId === "__all__" ? null : ccId,
      _contrato_id: contratoId === "__all__" ? null : contratoId,
      _origem: origem === "__all__" ? null : origem,
      _busca: busca.trim() || null,
      _classif_de: classifDe.trim() || null,
      _classif_ate: classifAte.trim() || null,
    }),
    [empresaId, dataIni, dataFim, contaId, classifPrefix, natureza, grupo, ccId, contratoId, origem, busca, classifDe, classifAte],
  );

  const linhasQ = useQuery({
    queryKey: ["razao-detalhado", baseFilters, page],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "razao_unificado_listar",
        { ...baseFilters, _limit: PAGE_SIZE, _offset: (page - 1) * PAGE_SIZE },
      );
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const saldoAntQ = useQuery({
    queryKey: ["razao-saldo-ant", baseFilters],
    enabled: !!empresaId && incluirSaldoAnterior,
    queryFn: async () => {
      const { _data_fim, _busca, ...rest } = baseFilters as any;
      const { data, error } = await (supabase.rpc as any)("razao_saldo_anterior", rest);
      if (error) throw error;
      return (data?.[0] ?? { total_debito: 0, total_credito: 0, saldo: 0 }) as {
        total_debito: number | string; total_credito: number | string; saldo: number | string;
      };
    },
  });

  const linhas = linhasQ.data ?? [];
  const total = Number(linhas[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totD = linhas.reduce((s, r) => s + Number(r.debito || 0), 0);
  const totC = linhas.reduce((s, r) => s + Number(r.credito || 0), 0);

  // Buscar tudo (sem paginar) para exportar
  async function fetchAll(maxRows = 20000): Promise<Linha[]> {
    const out: Linha[] = [];
    const chunk = 1000;
    let offset = 0;
    while (offset < maxRows) {
      const { data, error } = await (supabase.rpc as any)(
        "razao_unificado_listar",
        { ...baseFilters, _limit: chunk, _offset: offset },
      );
      if (error) throw error;
      const arr = (data ?? []) as Linha[];
      out.push(...arr);
      if (arr.length < chunk) break;
      offset += chunk;
    }
    return out;
  }

  const filtroResumo = useMemo(() => {
    const parts: string[] = [`${fmtDate(dataIni)} a ${fmtDate(dataFim)}`];
    if (contaId !== "__all__") {
      const c = (contasQ.data ?? []).find((x: any) => x.id === contaId);
      if (c) parts.push(`Conta: ${c.classificacao} ${c.descricao}`);
    }
    if (classifPrefix) parts.push(`Grupo: ${classifPrefix}*`);
    if (classifDe || classifAte) parts.push(`Faixa: ${classifDe || "início"} → ${classifAte || "fim"}`);
    if (natureza !== "__all__") parts.push(`Natureza: ${natureza}`);
    if (grupo !== "__all__") parts.push(`Grupo DRE: ${grupo}`);
    if (ccId !== "__all__") {
      const cc = (ccsQ.data ?? []).find((x: any) => x.id === ccId);
      if (cc) parts.push(`CC: ${cc.codigo} ${cc.nome}`);
    }
    if (contratoId !== "__all__") {
      const ct = (contratosQ.data ?? []).find((x: any) => x.id === contratoId);
      if (ct) parts.push(`Contrato: ${ct.numero}`);
    }
    if (origem !== "__all__") parts.push(`Origem: ${origem}`);
    if (busca) parts.push(`Busca: "${busca}"`);
    return parts.join("  ·  ");
  }, [
    dataIni,
    dataFim,
    contaId,
    classifPrefix,
    natureza,
    grupo,
    ccId,
    contratoId,
    origem,
    busca,
    contasQ.data,
    ccsQ.data,
    contratosQ.data,
  ]);

  async function exportExcel() {
    try {
      setExportLoading(true);
      const all = await fetchAll(100000);
      const XLSX = await import("xlsx");
      const aoa: (string | number)[][] = [
        [
          "Data",
          "Lançamento",
          "Origem",
          "Conta",
          "Descrição da Conta",
          "Natureza",
          "Grupo DRE",
          "CC Código",
          "CC Nome",
          "Contrato",
          "Histórico",
          "Documento",
          "Débito",
          "Crédito",
        ],
      ];
      let sd = 0,
        sc = 0;
      for (const r of all) {
        const d = Number(r.debito || 0);
        const c = Number(r.credito || 0);
        sd += d;
        sc += c;
        aoa.push([
          fmtDate(r.data_lcto),
          r.lcto_numero ?? "",
          r.origem,
          r.conta_classif ?? "",
          r.conta_desc ?? "",
          r.conta_natureza ?? "",
          r.conta_grupo ?? "",
          r.cc_codigo ?? "",
          r.cc_nome ?? "",
          r.contrato_num ?? "",
          r.historico ?? "",
          r.documento ?? "",
          d,
          c,
        ]);
      }
      aoa.push([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "TOTAIS",
        sd,
        sc,
      ]);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 11 },
        { wch: 14 },
        { wch: 10 },
        { wch: 14 },
        { wch: 36 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 26 },
        { wch: 14 },
        { wch: 40 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Razão Detalhado");
      const fname = `razao-detalhado_${dataIni}_a_${dataFim}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast.success(`Excel gerado: ${all.length} linhas`);
    } catch (e: any) {
      toast.error(`Falha ao gerar Excel: ${e?.message ?? e}`);
    } finally {
      setExportLoading(false);
    }
  }

  async function exportPDF() {
    try {
      setExportLoading(true);
      const all = await fetchAll(20000);
      if (all.length >= 20000) {
        toast.warning(
          "Limite de 20.000 linhas no PDF atingido — refine os filtros ou use Excel.",
        );
      }
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const dataGer = new Date().toLocaleString("pt-BR");
      const userEmail = user?.email ?? "—";
      const path = location.pathname;
      const reportName = "Razão Contábil Detalhado";

      let sd = 0,
        sc = 0;
      const body = all.map((r) => {
        const d = Number(r.debito || 0);
        const c = Number(r.credito || 0);
        sd += d;
        sc += c;
        return [
          fmtDate(r.data_lcto),
          r.lcto_numero ?? "",
          r.origem,
          r.conta_classif ?? "",
          (r.conta_desc ?? "").slice(0, 38),
          r.cc_codigo ?? "",
          (r.cc_nome ?? "").slice(0, 22),
          r.contrato_num ?? "",
          (r.historico ?? "").slice(0, 50),
          r.documento ?? "",
          d ? fmtBRL(d) : "",
          c ? fmtBRL(c) : "",
        ];
      });

      autoTable(doc, {
        head: [
          [
            "Data",
            "Lanç.",
            "Origem",
            "Conta",
            "Descrição",
            "CC",
            "CC Nome",
            "Contrato",
            "Histórico",
            "Doc.",
            "Débito",
            "Crédito",
          ],
        ],
        body,
        foot: [
          [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "TOTAIS",
            fmtBRL(sd),
            fmtBRL(sc),
          ],
        ],
        startY: 28,
        margin: { top: 28, left: 8, right: 8, bottom: 14 },
        styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
        headStyles: { fillColor: [40, 60, 100], textColor: 255, fontSize: 7.5 },
        footStyles: {
          fillColor: [230, 230, 230],
          textColor: 0,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 22 },
          2: { cellWidth: 16 },
          3: { cellWidth: 20 },
          4: { cellWidth: 50 },
          5: { cellWidth: 14 },
          6: { cellWidth: 32 },
          7: { cellWidth: 20 },
          8: { cellWidth: 60 },
          9: { cellWidth: 20 },
          10: { cellWidth: 22, halign: "right" },
          11: { cellWidth: 22, halign: "right" },
        },
        didDrawPage: (data) => {
          // Cabeçalho
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(reportName, 8, 10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(`Período: ${filtroResumo}`, 8, 15);
          doc.text(`Gerado em: ${dataGer}`, 8, 19.5);
          doc.text(
            `Usuário: ${userEmail}  ·  Caminho: ${path}`,
            8,
            24,
          );
          doc.setDrawColor(180);
          doc.line(8, 26, pageW - 8, 26);

          // Rodapé
          const pageNumber = (doc as any).internal.getNumberOfPages
            ? (doc as any).internal.getNumberOfPages()
            : data.pageNumber;
          doc.setFontSize(7);
          doc.text(
            `Página ${data.pageNumber} de ${pageNumber}`,
            pageW - 8,
            pageH - 6,
            { align: "right" },
          );
          doc.text(
            `${reportName} — Lovable Cloud`,
            8,
            pageH - 6,
          );
        },
      });

      const fname = `razao-detalhado_${dataIni}_a_${dataFim}.pdf`;
      doc.save(fname);
      toast.success(`PDF gerado: ${all.length} linhas`);
    } catch (e: any) {
      toast.error(`Falha ao gerar PDF: ${e?.message ?? e}`);
    } finally {
      setExportLoading(false);
    }
  }

  function limparFiltros() {
    setContaId("__all__");
    setClassifPrefix("");
    setClassifDe("");
    setClassifAte("");
    setNatureza("__all__");
    setGrupo("__all__");
    setCcId("__all__");
    setContratoId("__all__");
    setOrigem("__all__");
    setBusca("");
    setPage(1);
  }

  if (!empresaId) {
    return (
      <div className="card-elevated p-6 text-sm text-muted-foreground">
        Selecione uma empresa.
      </div>
    );
  }

  // Páginas a exibir (compactas)
  const visiblePages: (number | "…")[] = (() => {
    const arr: (number | "…")[] = [];
    const window = 2;
    for (let p = 1; p <= totalPages; p++) {
      if (
        p === 1 ||
        p === totalPages ||
        (p >= page - window && p <= page + window)
      )
        arr.push(p);
      else if (arr[arr.length - 1] !== "…") arr.push("…");
    }
    return arr;
  })();

  return (
    <div>
      <PageHeader
        module="Contábil"
        breadcrumb={["Contábil", "Razão Detalhado"]}
        title="Razão Contábil Detalhado"
        subtitle="Consulta linha-a-linha unificando partidas oficiais (NFs, baixas, regras automáticas) com a carga histórica migrada. Filtros, exportação Excel/PDF e paginação."
      />

      <div className="space-y-4">
        {/* Filtros */}
        <div className="card-elevated p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <span className="text-xs text-muted-foreground mr-1">Período rápido:</span>
            {[
              { id: "mes", label: "Mês atual" },
              { id: "mes_ant", label: "Mês anterior" },
              { id: "trim", label: "Trimestre" },
              { id: "ano", label: "Exercício" },
              { id: "ano_ant", label: "Exercício anterior" },
              { id: "acumulado", label: "Acumulado" },
            ].map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => aplicarPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Início</Label>
              <Input
                type="date"
                value={dataIni}
                onChange={(e) => {
                  setDataIni(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Select
                value={origem}
                onValueChange={(v) => {
                  setOrigem(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as origens</SelectItem>
                  <SelectItem value="app">App (NFs, baixas, regras)</SelectItem>
                  <SelectItem value="mz_carga">Carga histórica (mz)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Natureza</Label>
              <Select
                value={natureza}
                onValueChange={(v) => {
                  setNatureza(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="patrimonial">Patrimonial</SelectItem>
                  <SelectItem value="resultado">Resultado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Conta contábil</Label>
              <Select
                value={contaId}
                onValueChange={(v) => {
                  setContaId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todas as contas</SelectItem>
                  {(contasQ.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.classificacao} — {c.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Grupo (prefixo da classificação)</Label>
              <Input
                placeholder="Ex: 3 (Receitas), 4.1 (Custos)…"
                value={classifPrefix}
                onChange={(e) => {
                  setClassifPrefix(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Conta inicial (classificação)</Label>
              <Input
                placeholder="Ex: 1.0.0.00"
                value={classifDe}
                onChange={(e) => { setClassifDe(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <Label className="text-xs">Conta final (classificação)</Label>
              <Input
                placeholder="Ex: 5.1.1.01"
                value={classifAte}
                onChange={(e) => { setClassifAte(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <Label className="text-xs">Grupo DRE</Label>
              <Select
                value={grupo}
                onValueChange={(v) => {
                  setGrupo(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {gruposDre.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Centro de custo</Label>
              <Select
                value={ccId}
                onValueChange={(v) => {
                  setCcId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todos os CCs" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos os CCs</SelectItem>
                  {(ccsQ.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Contrato</Label>
              <Select
                value={contratoId}
                onValueChange={(v) => {
                  setContratoId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todos os contratos" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos os contratos</SelectItem>
                  {(contratosQ.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} — {(c.objeto ?? "").slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs">Busca livre (histórico, documento, lançamento, conta)</Label>
              <Input
                placeholder="Ex: nota fiscal, transferência, fornecedor X…"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => {
                  setPage(1);
                  linhasQ.refetch();
                }}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Aplicar
              </Button>
              <Button variant="outline" onClick={limparFiltros} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={incluirSaldoAnterior}
                  onChange={(e) => setIncluirSaldoAnterior(e.target.checked)}
                />
                Incluir Saldo Anterior
              </label>
              <div className="text-xs text-muted-foreground">
                {linhasQ.isLoading
                  ? "Carregando…"
                  : `${total.toLocaleString("pt-BR")} lançamentos · Página ${page} de ${totalPages}`}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportExcel}
                disabled={exportLoading || total === 0}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportPDF}
                disabled={exportLoading || total === 0}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                PDF (paisagem)
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Lançamento</TableHead>
                  <TableHead className="text-xs">Origem</TableHead>
                  <TableHead className="text-xs">Conta</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">CC</TableHead>
                  <TableHead className="text-xs">Contrato</TableHead>
                  <TableHead className="text-xs">Histórico</TableHead>
                  <TableHead className="text-xs">Doc.</TableHead>
                  <TableHead className="text-xs text-right">Débito</TableHead>
                  <TableHead className="text-xs text-right">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incluirSaldoAnterior && page === 1 && saldoAntQ.data && (
                  <TableRow className="bg-muted/40 font-medium text-xs">
                    <TableCell colSpan={9} className="uppercase tracking-wider text-muted-foreground">
                      Saldo Anterior (até {fmtDate(dataIni)})
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtBRL(Number(saldoAntQ.data.total_debito) || 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtBRL(Number(saldoAntQ.data.total_credito) || 0)}
                    </TableCell>
                  </TableRow>
                )}
                {linhasQ.isLoading && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!linhasQ.isLoading && linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Nenhum lançamento encontrado no período/filtros.
                    </TableCell>
                  </TableRow>
                )}
                {linhas.map((r, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="whitespace-nowrap">{fmtDate(r.data_lcto)}</TableCell>
                    <TableCell className="font-mono">{r.lcto_numero ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.origem === "app" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {r.origem}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-primary">{r.conta_classif ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate" title={r.conta_desc ?? ""}>
                      {r.conta_desc ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={`${r.cc_codigo ?? ""} ${r.cc_nome ?? ""}`}>
                      {r.cc_codigo ? `${r.cc_codigo} ${r.cc_nome ?? ""}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono">{r.contrato_num ?? "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate" title={r.historico ?? ""}>
                      {r.historico ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono">{r.documento ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.debito || 0) > 0 ? fmtBRL(r.debito) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.credito || 0) > 0 ? fmtBRL(r.credito) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {linhas.length > 0 && (
                <tfoot className="bg-muted/40 text-xs font-semibold">
                  <tr>
                    <td colSpan={9} className="px-4 py-2 text-right uppercase tracking-wider">
                      Totais da página
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(totD)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(totC)}</td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {visiblePages.map((p, i) =>
                p === "…" ? (
                  <PaginationItem key={`e${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p as number);
                      }}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                  className={
                    page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
