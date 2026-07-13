import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { LicitacaoAprovacaoBox } from "@/components/aprovacoes/LicitacaoAprovacaoBox";
import { usePermissoes } from "@/context/PermissoesContext";
import { useAuth } from "@/hooks/useAuth";
import { useLicitacao } from "@/hooks/useLicitacao";
import { isUuid } from "@/utils/isUuid";

import {
  useBdi,
  type BdiPosto,
  type BdiVerbaFolha,
  type BdiItem,
  type BdiItemGrupo,
  type BdiItemTipo,
} from "@/hooks/useBdi";
// Slider local removido - alias obrigatório.
import { Slider as UiSlider } from "@/components/ui/slider";
import {
  PieChart,
  Briefcase,
  Calculator,
  Package,
  TrendingUp,
  Save,
  Send,
  Check,
  Building2,
  MapPin,
  Plus,
  Trash2,
  BarChart3,
  Wallet,
  LineChart as LineChartIcon,
  type LucideIcon,
} from "lucide-react";
import { formatBRL } from "@/data/contratos";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type AbaId = "postos" | "encargos" | "insumos" | "impostos" | "dre" | "caixa" | "grafico";

interface AbaDef {
  id: AbaId;
  label: string;
  icon: LucideIcon;
  isAnalytic?: boolean;
}

const abas: AbaDef[] = [
  { id: "postos", label: "Postos e Salários", icon: Briefcase },
  { id: "encargos", label: "Encargos e Benefícios", icon: Calculator },
  { id: "insumos", label: "Insumos e Operação", icon: Package },
  { id: "impostos", label: "Impostos e Margem", icon: TrendingUp },
  { id: "dre", label: "DRE da Licitação", icon: BarChart3, isAnalytic: true },
  { id: "caixa", label: "Caixa Mensal", icon: Wallet, isAnalytic: true },
  { id: "grafico", label: "Orçado x Realizado", icon: LineChartIcon, isAnalytic: true },
];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ============ Tipos de draft ============

type CampoPostoTexto = "cargo" | "local" | "observacao";
type CampoPostoNumero =
  | "qtd"
  | "salario_base"
  | "va"
  | "vt"
  | "uniformes"
  | "epis"
  | "insalubridade_pct"
  | "periculosidade_pct"
  | "ordem";

interface PostoDraft {
  id: string;
  cargo: string;
  qtd: number;
  local: string | null;
  salario_base: number;
  va: number;
  vt: number;
  uniformes: number;
  epis: number;
  insalubridade_pct: number;
  periculosidade_pct: number;
  ordem: number;
  observacao: string | null;
  _dirty: boolean;
}

function toPostoDraft(p: BdiPosto): PostoDraft {
  return {
    id: p.id,
    cargo: p.cargo,
    qtd: Number(p.qtd ?? 0),
    local: p.local,
    salario_base: Number(p.salario_base ?? 0),
    va: Number(p.va ?? 0),
    vt: Number(p.vt ?? 0),
    uniformes: Number(p.uniformes ?? 0),
    epis: Number(p.epis ?? 0),
    insalubridade_pct: Number(p.insalubridade_pct ?? 0),
    periculosidade_pct: Number(p.periculosidade_pct ?? 0),
    ordem: Number(p.ordem ?? 0),
    observacao: p.observacao,
    _dirty: false,
  };
}

interface VerbaDraft {
  id: string;
  rubrica: string;
  percentual: number;
  ordem: number;
  observacao: string | null;
  _dirty: boolean;
}

function toVerbaDraft(v: BdiVerbaFolha): VerbaDraft {
  return {
    id: v.id,
    rubrica: v.rubrica,
    percentual: Number(v.percentual ?? 0),
    ordem: Number(v.ordem ?? 0),
    observacao: v.observacao,
    _dirty: false,
  };
}

type CampoItemTexto = "label" | "unidade" | "observacao" | "campo_key";
type CampoItemNumero = "quantidade" | "valor_unitario_estimado" | "valor" | "ordem";

interface ItemDraft {
  id: string | null;
  grupo: BdiItemGrupo;
  tipo: BdiItemTipo | null;
  campo_key: string;
  label: string;
  unidade: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  valor: number;
  ordem: number;
  observacao: string | null;
  produto_servico_id: string | null;
  _dirty: boolean;
  _localKey: string;
}

function toItemDraft(it: BdiItem): ItemDraft {
  return {
    id: it.id,
    grupo: it.grupo,
    tipo: it.tipo,
    campo_key: it.campo_key,
    label: it.label,
    unidade: it.unidade,
    quantidade: Number(it.quantidade ?? 0),
    valor_unitario_estimado: Number(it.valor_unitario_estimado ?? 0),
    valor: Number(it.valor ?? 0),
    ordem: Number(it.ordem ?? 0),
    observacao: it.observacao,
    produto_servico_id: it.produto_servico_id,
    _dirty: false,
    _localKey: it.id,
  };
}

interface VersaoDraft {
  margem_pct?: number;
  tributos_pct?: number;
  custo_indireto_pct?: number;
}

// ============ Componente ============

export default function Composicao() {
  const { can } = usePermissoes();
  const canIncluir = can("incluir", "licitacoes", "composicao");
  const canAlterar = can("alterar", "licitacoes", "composicao");
  const canAprovar = can("aprovar", "licitacoes", "composicao");

  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const licitacaoIdParam = searchParams.get("licitacao");

  const licitacao = useLicitacao(licitacaoIdParam);
  const bdi = useBdi(licitacaoIdParam);

  const isResponsavel =
    !!user && !!licitacao.data?.responsavel_user_id &&
    licitacao.data.responsavel_user_id === user.id;

  const licitacaoStatus = licitacao.data?.status ?? null;
  // Edição liberada apenas para o responsável real em status rascunho e com permissão de alterar.
  const canEdit = isResponsavel && licitacaoStatus === "rascunho" && canAlterar;

  // === Drafts ===
  const [postoDrafts, setPostoDrafts] = useState<Record<string, PostoDraft>>({});
  const [verbaDrafts, setVerbaDrafts] = useState<Record<string, VerbaDraft>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [versaoDraft, setVersaoDraft] = useState<VersaoDraft>({});

  useEffect(() => {
    const next: Record<string, PostoDraft> = {};
    for (const p of bdi.postos) next[p.id] = toPostoDraft(p);
    setPostoDrafts(next);
  }, [bdi.postos]);

  useEffect(() => {
    const next: Record<string, VerbaDraft> = {};
    for (const v of bdi.verbas) next[v.id] = toVerbaDraft(v);
    setVerbaDrafts(next);
  }, [bdi.verbas]);

  useEffect(() => {
    const next: Record<string, ItemDraft> = {};
    for (const it of bdi.itens) next[it.id] = toItemDraft(it);
    setItemDrafts(next);
  }, [bdi.itens]);

  useEffect(() => {
    // reseta draft ao trocar versão do servidor
    setVersaoDraft({});
  }, [bdi.versao?.id]);

  const margem =
    versaoDraft.margem_pct ?? bdi.versao?.margem_pct ?? 0;
  const tributos =
    versaoDraft.tributos_pct ?? bdi.versao?.tributos_pct ?? 0;
  const custoIndireto =
    versaoDraft.custo_indireto_pct ?? bdi.versao?.custo_indireto_pct ?? 0;

  const [abaAtiva, setAbaAtiva] = useState<AbaId>("postos");

  // === Cálculo local (preview) ===
  const totais = useMemo(() => {
    const totalEncargosPct = bdi.verbas.reduce(
      (a, v) => a + Number(v.percentual ?? 0),
      0,
    );
    const beneficiosMes = bdi.postos.reduce(
      (s, p) =>
        s +
        (Number(p.va ?? 0) +
          Number(p.vt ?? 0) +
          Number(p.uniformes ?? 0) +
          Number(p.epis ?? 0)) *
          Number(p.qtd ?? 0),
      0,
    );
    const folhaMes = bdi.postos.reduce((s, p) => {
      const sal = Number(p.salario_base ?? 0);
      const folha = sal * (1 + totalEncargosPct / 100);
      const insalub = (sal * Number(p.insalubridade_pct ?? 0)) / 100;
      return s + (folha + insalub) * Number(p.qtd ?? 0);
    }, 0);
    const itensMes = bdi.itens.reduce(
      (s, it) => s + Number(it.valor ?? 0),
      0,
    );
    const custoDiretoMes = folhaMes + beneficiosMes + itensMes;
    const indiretos = (custoDiretoMes * custoIndireto) / 100;
    const subtotal = custoDiretoMes + indiretos;
    const trib = (subtotal * tributos) / 100;
    const lucro = (subtotal * margem) / 100;
    const total = subtotal + trib + lucro;
    const bdiPct =
      custoDiretoMes > 0 ? ((total - custoDiretoMes) / custoDiretoMes) * 100 : 0;
    return {
      custoDiretoMes,
      folhaMes,
      beneficiosMes,
      itensMes,
      indiretos,
      subtotal,
      trib,
      lucro,
      total,
      bdi: bdiPct,
      totalEncargosPct,
    };
  }, [bdi.postos, bdi.verbas, bdi.itens, margem, tributos, custoIndireto]);

  // === Projeção 12m derivada (mock derivado - DRE/Caixa/Gráfico = FONTE_REAL_NAO_LOCALIZADA) ===
  const projecao = useMemo(() => {
    const seed = bdi.postos.length + Math.round(margem * 10);
    const rand = (i: number) => {
      const x = Math.sin((seed + i) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return MESES.map((mes, i) => {
      const receita = totais.total;
      const folha = totais.folhaMes;
      const beneficios = totais.beneficiosMes;
      const indiretos = totais.indiretos;
      const trib = totais.trib;
      const custoTotal = folha + beneficios + indiretos;
      const lucroOrcado = receita - custoTotal - trib;
      const realizado = i < 6;
      const fatorRec = 1 + (rand(i) - 0.5) * 0.18;
      const fatorCusto = 1 + (rand(i + 50) - 0.5) * 0.12;
      const recReal = realizado ? receita * fatorRec : 0;
      const custoReal = realizado ? custoTotal * fatorCusto : 0;
      const tribReal = realizado ? trib * fatorRec : 0;
      const lucroReal = realizado ? recReal - custoReal - tribReal : 0;
      return {
        mes,
        receitaOrc: receita,
        custoOrc: custoTotal,
        tribOrc: trib,
        lucroOrc: lucroOrcado,
        receitaReal: recReal,
        custoReal,
        tribReal,
        lucroReal,
        caixaOrc: receita - custoTotal - trib,
        caixaReal: realizado ? recReal - custoReal - tribReal : 0,
        realizado,
      };
    });
  }, [totais, bdi.postos.length, margem]);

  const dreTotais = useMemo(() => {
    const sum = (k: keyof (typeof projecao)[number]) =>
      projecao.reduce((s, p) => s + (p[k] as number), 0);
    return {
      receitaOrc: sum("receitaOrc"),
      custoOrc: sum("custoOrc"),
      tribOrc: sum("tribOrc"),
      lucroOrc: sum("lucroOrc"),
      receitaReal: sum("receitaReal"),
      custoReal: sum("custoReal"),
      tribReal: sum("tribReal"),
      lucroReal: sum("lucroReal"),
    };
  }, [projecao]);

  // === Handlers (drafts + commits onBlur/onValueCommit) ===

  const updatePostoTexto = useCallback(
    (id: string, campo: CampoPostoTexto, v: string) => {
      setPostoDrafts((prev) => ({
        ...prev,
        [id]: { ...prev[id], [campo]: v, _dirty: true },
      }));
    },
    [],
  );

  const updatePostoNumero = useCallback(
    (id: string, campo: CampoPostoNumero, v: number) => {
      setPostoDrafts((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [campo]: Number.isFinite(v) ? v : 0,
          _dirty: true,
        },
      }));
    },
    [],
  );

  const commitPosto = useCallback(
    async (id: string) => {
      const d = postoDrafts[id];
      if (!d || !d._dirty || !canEdit) return;
      if (!d.cargo?.trim()) {
        toast.error("Posto sem cargo");
        return;
      }
      await bdi.salvarPosto.mutateAsync({
        id: d.id,
        cargo: d.cargo,
        qtd: d.qtd,
        local: d.local ?? null,
        salario_base: d.salario_base,
        va: d.va,
        vt: d.vt,
        uniformes: d.uniformes,
        epis: d.epis,
        insalubridade_pct: d.insalubridade_pct,
        periculosidade_pct: d.periculosidade_pct,
        ordem: d.ordem,
        observacao: d.observacao,
      });
      setPostoDrafts((prev) => ({
        ...prev,
        [id]: { ...prev[id], _dirty: false },
      }));
    },
    [postoDrafts, canEdit, bdi.salvarPosto],
  );

  const addPosto = useCallback(async () => {
    if (!canEdit) return;
    await bdi.salvarPosto.mutateAsync({
      id: null,
      cargo: "Novo posto",
      qtd: 1,
      local: null,
      salario_base: 0,
      va: 0,
      vt: 0,
      uniformes: 0,
      epis: 0,
      insalubridade_pct: 0,
      periculosidade_pct: 0,
      ordem: bdi.postos.length + 1,
      observacao: null,
    });
  }, [canEdit, bdi.salvarPosto, bdi.postos.length]);

  const removePosto = useCallback(
    async (id: string) => {
      if (!canEdit) return;
      await bdi.excluirPosto.mutateAsync(id);
    },
    [canEdit, bdi.excluirPosto],
  );

  const updateVerbaNumero = useCallback(
    (id: string, v: number) => {
      setVerbaDrafts((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          percentual: Number.isFinite(v) ? v : 0,
          _dirty: true,
        },
      }));
    },
    [],
  );

  const commitVerba = useCallback(
    async (idx: number) => {
      const v = bdi.verbas[idx];
      if (!v) return;
      const d = verbaDrafts[v.id];
      if (!d || !d._dirty || !canEdit) return;
      await bdi.salvarVerba.mutateAsync({
        id: d.id,
        rubrica: d.rubrica,
        percentual: d.percentual,
        ordem: d.ordem,
        observacao: d.observacao,
      });
      setVerbaDrafts((prev) => ({
        ...prev,
        [v.id]: { ...prev[v.id], _dirty: false },
      }));
    },
    [bdi.verbas, verbaDrafts, canEdit, bdi.salvarVerba],
  );

  const setVersaoDraftField = useCallback(
    (campo: keyof VersaoDraft, v: number) => {
      setVersaoDraft((prev) => ({ ...prev, [campo]: v }));
    },
    [],
  );

  const commitVersaoCampo = useCallback(
    async (campo: keyof VersaoDraft) => {
      if (!canEdit || !bdi.versao) return;
      const valor = versaoDraft[campo];
      if (valor === undefined) return;
      const atual = bdi.versao[campo] ?? 0;
      if (valor === atual) return;
      await bdi.atualizarVersao.mutateAsync({ [campo]: valor });
    },
    [canEdit, bdi.versao, versaoDraft, bdi.atualizarVersao],
  );

  // === Item handlers ===

  const updateItemTexto = useCallback(
    (key: string, campo: CampoItemTexto, v: string) => {
      setItemDrafts((prev) => ({
        ...prev,
        [key]: { ...prev[key], [campo]: v, _dirty: true },
      }));
    },
    [],
  );

  const updateItemNumero = useCallback(
    (key: string, campo: CampoItemNumero, v: number) => {
      setItemDrafts((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [campo]: Number.isFinite(v) ? v : 0,
          _dirty: true,
        },
      }));
    },
    [],
  );

  const commitItem = useCallback(
    async (key: string) => {
      const d = itemDrafts[key];
      if (!d || !d._dirty || !canEdit) return;
      if (!d.label?.trim()) {
        toast.error("Item sem label");
        return;
      }
      await bdi.salvarItem.mutateAsync({
        id: d.id ?? null,
        grupo: d.grupo,
        tipo: d.tipo ?? "moeda",
        campo_key: d.campo_key,
        label: d.label,
        unidade: d.unidade ?? null,
        quantidade: d.quantidade,
        valor_unitario_estimado: d.valor_unitario_estimado,
        valor: d.valor,
        ordem: d.ordem,
        observacao: d.observacao ?? null,
        produto_servico_id: d.produto_servico_id ?? null,
      });
      setItemDrafts((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          id: prev[key]?.id ?? null,
          _dirty: false,
        },
      }));
    },
    [itemDrafts, canEdit, bdi.salvarItem],
  );

  const addItem = useCallback(async () => {
    if (!canEdit) return;
    const localKey = `item-${Date.now()}`;
    await bdi.salvarItem.mutateAsync({
      id: null,
      grupo: "insumo" as BdiItemGrupo,
      tipo: "moeda" as BdiItemTipo,
      campo_key: localKey,
      label: "Novo item",
      unidade: null,
      quantidade: 1,
      valor_unitario_estimado: 0,
      valor: 0,
      ordem: (bdi.itens.length ?? 0) + 1,
      observacao: null,
      produto_servico_id: null,
    });
  }, [canEdit, bdi.salvarItem, bdi.itens.length]);

  const removeItem = useCallback(
    async (id: string | null) => {
      if (!canEdit || !id) return;
      await bdi.excluirItem.mutateAsync(id);
    },
    [canEdit, bdi.excluirItem],
  );

  // === Ações de versão ===

  const handleAssumir = useCallback(async () => {
    if (!licitacaoIdParam) return;
    try {
      await licitacao.assumirLicitacao.mutateAsync();
      toast.success("Licitação assumida");
    } catch (e) {
      toast.error("Não foi possível assumir", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [licitacaoIdParam, licitacao.assumirLicitacao]);

  const handleCriarVersao = useCallback(async () => {
    if (!licitacaoIdParam || !canEdit) return;
    try {
      await bdi.criarVersao.mutateAsync();
      toast.success("Versão BDI criada");
    } catch (e) {
      toast.error("Falha ao criar versão", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [licitacaoIdParam, canEdit, bdi.criarVersao]);

  const salvarRascunho = useCallback(async () => {
    if (!canEdit) return;

    Object.keys(postoDrafts).forEach((postoId) => {
      commitPosto(postoId);
    });

    Object.keys(verbaDrafts).forEach((verbaId) => {
      const idx = bdi.verbas.findIndex((v) => v.id === verbaId);
      if (idx >= 0) commitVerba(idx);
    });

    for (const itemKey of Object.keys(itemDrafts)) {
      if (itemDrafts[itemKey]?._dirty) {
        await commitItem(itemKey);
      }
    }

    (["margem_pct", "tributos_pct", "custo_indireto_pct"] as const).forEach(
      (campo) => {
        const valor = versaoDraft[campo];
        const atual = bdi.versao?.[campo] ?? 0;
        if (valor !== undefined && valor !== atual) {
          commitVersaoCampo(campo);
        }
      },
    );

    toast.success("Rascunho salvo");
  }, [
    canEdit,
    postoDrafts,
    verbaDrafts,
    itemDrafts,
    versaoDraft,
    bdi.verbas,
    bdi.versao,
    commitPosto,
    commitVerba,
    commitItem,
    commitVersaoCampo,
  ]);

  const handleRecalcular = useCallback(async () => {
    if (!bdi.versao) return;
    try {
      await bdi.recalcular.mutateAsync();
      toast.success("Recalculado", {
        description: "Totais oficiais retornados por bdi_recalcular",
      });
    } catch (e) {
      toast.error("Falha ao recalcular", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [bdi.versao, bdi.recalcular]);

  const handleSubmeter = useCallback(async () => {
    if (!bdi.versao || !canEdit) return;
    try {
      await bdi.submeter.mutateAsync("");
      toast.success("Submetido à revisão");
    } catch (e) {
      toast.error("Falha ao submeter", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }, [bdi.versao, canEdit, bdi.submeter]);

  // === Render ===

  if (!licitacaoIdParam) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Composição de Custos & BDI"
          breadcrumb={["Operação", "Composição & BDI"]}
          subtitle="Selecione uma licitação no Pipeline para abrir a composição."
        />
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          Nenhuma licitação selecionada. Acesse pelo Pipeline (duplo clique em
          uma linha).
        </div>
      </div>
    );
  }

  if (!isUuid(licitacaoIdParam)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Composição de Custos & BDI"
          breadcrumb={["Operação", "Composição & BDI"]}
        />
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          Esta licitação ainda está na fonte temporária e não possui UUID real
          no banco. Volte ao Pipeline, use “Importar Grade 2026”, valide e
          confirme a importação antes de abrir a Composição & BDI.
        </div>
      </div>
    );
  }


  if (licitacao.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Composição de Custos & BDI"
          breadcrumb={["Operação", "Composição & BDI"]}
        />
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          Carregando licitação…
        </div>
      </div>
    );
  }

  if (licitacao.error || !licitacao.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Composição de Custos & BDI"
          breadcrumb={["Operação", "Composição & BDI"]}
        />
        <div className="card-elevated border-l-4 border-l-destructive bg-destructive-soft p-6 text-sm text-destructive">
          Licitação não encontrada
          {licitacao.error ? `: ${licitacao.error.message}` : ""}.
        </div>
      </div>
    );
  }

  const empresaIdLegivel = licitacao.data.empresa_id; // EMPRESA_NOME_NAO_RESOLVIDO
  const tituloLicitacao = `${licitacao.data.numero ?? "-"} · ${licitacao.data.objeto ?? ""}`;
  const semResponsavel = !licitacao.data.responsavel_user_id;
  const outroResponsavel =
    !semResponsavel && !isResponsavel && !!licitacao.data.responsavel_user_id;
  const statusNaoRascunho =
    licitacaoStatus !== null && licitacaoStatus !== "rascunho";
  const semVersao = !bdi.versao && !bdi.versaoLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Composição de Custos & BDI"
        breadcrumb={["Operação", "Composição & BDI"]}
        subtitle="Detalhamento por posto, verbas da folha, insumos, tributos e margem - fonte: public.bdi_*."
        actions={
          <>
            {canIncluir && (
              <button
                onClick={salvarRascunho}
                disabled={!canEdit}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" /> Salvar rascunho
              </button>
            )}
            <button
              onClick={handleRecalcular}
              disabled={!bdi.versao || bdi.recalcular.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Calculator className="h-3.5 w-3.5" /> Recalcular
            </button>
            <button
              disabled={!bdi.versao || !canEdit || !canAprovar || bdi.submeter.isPending}
              onClick={handleSubmeter}
              title={
                !canAprovar
                  ? "Sem permissão para aprovar nesta fase"
                  : !canEdit
                  ? "Edição não autorizada"
                  : undefined
              }
              className={`btn-relief inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-all ${
                bdi.versao && canEdit && canAprovar
                  ? "bg-gradient-accent text-accent-foreground"
                  : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
              }`}
            >
              <Send className="h-3.5 w-3.5" /> Submeter à revisão
            </button>
          </>
        }
      />

      {/* Banners de gating */}
      {semResponsavel && (
        <div className="card-elevated flex items-center justify-between gap-3 border-l-4 border-l-warning bg-warning-soft px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-warning">Sem responsável atribuído</p>
            <p className="text-xs text-muted-foreground">
              Assuma a licitação para iniciar a composição.
            </p>
          </div>
          <button
            onClick={handleAssumir}
            disabled={licitacao.assumirLicitacao.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            Assumir licitação
          </button>
        </div>
      )}

      {outroResponsavel && (
        <div className="card-elevated flex items-center gap-3 border-l-4 border-l-info bg-info-soft px-4 py-3 text-sm">
          <span className="rounded bg-info/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info">
            Somente leitura
          </span>
          <span className="text-xs text-muted-foreground">
            Esta licitação tem outro responsável atribuído.
          </span>
        </div>
      )}

      {statusNaoRascunho && (
        <div className="card-elevated flex items-center gap-3 border-l-4 border-l-info bg-info-soft px-4 py-3 text-sm">
          <span className="rounded bg-info/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info">
            Status: {licitacaoStatus}
          </span>
          <span className="text-xs text-muted-foreground">
            Edição liberada apenas em rascunho.
          </span>
        </div>
      )}

      {semVersao && isResponsavel && licitacaoStatus === "rascunho" && (
        <div className="card-elevated flex items-center justify-between gap-3 border-l-4 border-l-primary bg-primary/5 px-4 py-3 text-sm">
          <div>
            <p className="font-semibold">Nenhuma versão BDI ainda</p>
            <p className="text-xs text-muted-foreground">
              Crie a primeira versão para começar a editar.
            </p>
          </div>
          <button
            onClick={handleCriarVersao}
            disabled={bdi.criarVersao.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> Criar versão BDI
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Identificação */}
          <section className="card-elevated p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
              <Building2 className="h-4 w-4 text-primary" /> Identificação
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Empresa (id)" value={empresaIdLegivel} />
              <Field label="Licitação vinculada" value={tituloLicitacao} />
              <Field label="Órgão" value={licitacao.data.orgao ?? "-"} />
              <Field label="Status" value={String(licitacaoStatus ?? "-")} />
            </div>
          </section>

          {/* Tabs */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-sunken p-1">
              {abas
                .filter((a) => !a.isAnalytic)
                .map((a) => {
                  const ativa = abaAtiva === a.id;
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAbaAtiva(a.id)}
                      className={`relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                        ativa
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Dossiê analítico
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-1 shadow-[0_4px_14px_-6px_hsl(var(--primary)/0.25)]">
              {abas
                .filter((a) => a.isAnalytic)
                .map((a) => {
                  const ativa = abaAtiva === a.id;
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAbaAtiva(a.id)}
                      className={`relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                        ativa
                          ? "bg-card text-primary shadow-md ring-1 ring-primary/30"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Aba Postos */}
          {abaAtiva === "postos" && (
            <section className="card-elevated p-5">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <Briefcase className="h-4 w-4 text-primary" /> Postos de trabalho
                </h2>
                {canIncluir && (
                  <button
                    onClick={addPosto}
                    disabled={!canEdit || bdi.salvarPosto.isPending}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar posto
                  </button>
                )}
              </header>

              {bdi.postos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum posto cadastrado nesta versão BDI.
                </p>
              ) : (
                <div className="space-y-4">
                  {bdi.postos.map((p) => {
                    const d = postoDrafts[p.id] ?? toPostoDraft(p);
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border border-border bg-surface-sunken p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex flex-1 items-start gap-3">
                            <input
                              value={d.cargo}
                              onChange={(e) =>
                                updatePostoTexto(p.id, "cargo", e.target.value)
                              }
                              onBlur={() => commitPosto(p.id)}
                              disabled={!canEdit}
                              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <div className="w-20">
                              <input
                                type="number"
                                value={d.qtd}
                                onChange={(e) =>
                                  updatePostoNumero(
                                    p.id,
                                    "qtd",
                                    Number(e.target.value),
                                  )
                                }
                                onBlur={() => commitPosto(p.id)}
                                disabled={!canEdit}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-center text-sm font-semibold outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                              />
                              <p className="mt-1 text-center text-[10px] uppercase text-muted-foreground">
                                Qtd
                              </p>
                            </div>
                          </div>
                          {canIncluir && (
                            <button
                              onClick={() => removePosto(p.id)}
                              disabled={!canEdit || bdi.excluirPosto.isPending}
                              className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive-soft disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            value={d.local ?? ""}
                            onChange={(e) =>
                              updatePostoTexto(p.id, "local", e.target.value)
                            }
                            onBlur={() => commitPosto(p.id)}
                            placeholder="Local de prestação"
                            disabled={!canEdit}
                            className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <NumField
                            label="Salário base"
                            v={d.salario_base}
                            onChange={(v) =>
                              updatePostoNumero(p.id, "salario_base", v)
                            }
                            onBlur={() => commitPosto(p.id)}
                            disabled={!canEdit}
                          />
                          <NumField
                            label="Insalub. (%)"
                            v={d.insalubridade_pct}
                            onChange={(v) =>
                              updatePostoNumero(
                                p.id,
                                "insalubridade_pct",
                                v,
                              )
                            }
                            onBlur={() => commitPosto(p.id)}
                            disabled={!canEdit}
                          />
                          <NumField
                            label="VT (R$)"
                            v={d.vt}
                            onChange={(v) => updatePostoNumero(p.id, "vt", v)}
                            onBlur={() => commitPosto(p.id)}
                            disabled={!canEdit}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Aba Encargos */}
          {abaAtiva === "encargos" && (
            <section className="card-elevated p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
                <Calculator className="h-4 w-4 text-primary" /> Encargos sobre a folha & benefícios
              </h2>
              {bdi.verbas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma verba cadastrada nesta versão BDI.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left">Rubrica</th>
                      <th className="px-3 py-2 text-right">Percentual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bdi.verbas.map((v, i) => {
                      const d = verbaDrafts[v.id] ?? toVerbaDraft(v);
                      return (
                        <tr key={v.id} className="border-b border-border/60">
                          <td className="px-3 py-2.5 font-medium">{v.rubrica}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              step={0.01}
                              value={d.percentual}
                              onChange={(e) =>
                                updateVerbaNumero(v.id, Number(e.target.value))
                              }
                              onBlur={() => commitVerba(i)}
                              disabled={!canEdit}
                              className="ml-auto block h-8 w-24 rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary-soft/60">
                      <td className="px-3 py-2.5 font-bold">Total de encargos</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                        {totais.totalEncargosPct.toFixed(2)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          )}

          {/* Aba Insumos e Operação - fonte real bdi.itens */}
          {abaAtiva === "insumos" && (
            <section className="card-elevated p-5">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <Package className="h-4 w-4 text-primary" /> Insumos e operação
                </h2>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!canEdit || bdi.salvarItem.isPending}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar item
                </button>
              </header>

              {bdi.itens.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum item cadastrado nesta versão BDI.
                </p>
              ) : (
                <div className="space-y-3">
                  {bdi.itens.map((it) => {
                    const k = it.id;
                    const d = itemDrafts[k] ?? toItemDraft(it);
                    return (
                      <div
                        key={k}
                        className="rounded-md border border-border bg-surface-sunken p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <input
                            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-semibold outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            value={d.label}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateItemTexto(k, "label", e.target.value)
                            }
                            onBlur={() => commitItem(k)}
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(d.id)}
                            disabled={!canEdit || bdi.excluirItem.isPending}
                            className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive-soft disabled:opacity-40"
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <input
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Unidade"
                            value={d.unidade ?? ""}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateItemTexto(k, "unidade", e.target.value)
                            }
                            onBlur={() => commitItem(k)}
                          />
                          <input
                            className="h-8 rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            type="number"
                            step="0.001"
                            value={d.quantidade}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateItemNumero(
                                k,
                                "quantidade",
                                Number(e.target.value),
                              )
                            }
                            onBlur={() => commitItem(k)}
                          />
                          <input
                            className="h-8 rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            type="number"
                            step="0.01"
                            value={d.valor_unitario_estimado}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateItemNumero(
                                k,
                                "valor_unitario_estimado",
                                Number(e.target.value),
                              )
                            }
                            onBlur={() => commitItem(k)}
                          />
                          <input
                            className="h-8 rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                            type="number"
                            step="0.01"
                            value={d.valor}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateItemNumero(
                                k,
                                "valor",
                                Number(e.target.value),
                              )
                            }
                            onBlur={() => commitItem(k)}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          grupo: {it.grupo} · tipo: {it.tipo ?? "moeda"} · campo_key: {it.campo_key}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 rounded-md border border-info/30 bg-info-soft px-3 py-2.5 text-[12px] text-info">
                Fonte: <strong>public.bdi_item</strong>. Edição via RPC{" "}
                <code>bdi_salvar_item</code> / <code>bdi_excluir_item</code>.
                Total gerado no banco - frontend não envia campo de total.
              </div>
            </section>
          )}

          {/* Aba Impostos - sliders Radix com onValueCommit */}
          {abaAtiva === "impostos" && (
            <section className="card-elevated p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold">
                <TrendingUp className="h-4 w-4 text-accent" /> Tributos, indiretos e margem
              </h2>
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Custos indiretos (% s/ direto)
                    </label>
                    <span className="font-mono text-sm font-bold text-primary">
                      {Number(custoIndireto).toFixed(2)}%
                    </span>
                  </div>
                  <UiSlider
                    min={0}
                    max={50}
                    step={0.1}
                    value={[custoIndireto]}
                    disabled={!canEdit}
                    onValueChange={(v) =>
                      setVersaoDraftField("custo_indireto_pct", v[0] ?? 0)
                    }
                    onValueCommit={() => commitVersaoCampo("custo_indireto_pct")}
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Carga tributária estimada
                    </label>
                    <span className="font-mono text-sm font-bold text-primary">
                      {Number(tributos).toFixed(2)}%
                    </span>
                  </div>
                  <UiSlider
                    min={0}
                    max={50}
                    step={0.01}
                    value={[tributos]}
                    disabled={!canEdit}
                    onValueChange={(v) =>
                      setVersaoDraftField("tributos_pct", v[0] ?? 0)
                    }
                    onValueCommit={() => commitVersaoCampo("tributos_pct")}
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Margem de lucro desejada
                    </label>
                    <span className="font-mono text-sm font-bold text-accent">
                      {Number(margem).toFixed(2)}%
                    </span>
                  </div>
                  <UiSlider
                    min={0}
                    max={50}
                    step={0.25}
                    value={[margem]}
                    disabled={!canEdit}
                    onValueChange={(v) =>
                      setVersaoDraftField("margem_pct", v[0] ?? 0)
                    }
                    onValueCommit={() => commitVersaoCampo("margem_pct")}
                  />
                </div>
              </div>
              <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12px] text-warning">
                A margem definida aqui é decisão da licitação - será revisada pela Controladoria antes da aprovação final.
              </div>
            </section>
          )}

          {/* DRE / Caixa / Gráfico - FONTE_REAL_NAO_LOCALIZADA (M4) */}
          {abaAtiva === "dre" && (
            <section className="card-elevated overflow-hidden">
              <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-card to-card px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <BarChart3 className="h-4 w-4 text-primary" /> DRE projetada da licitação · 12 meses
                </h2>
                <span className="chip border bg-warning-soft text-warning border-warning/30">
                  FONTE_REAL_NAO_LOCALIZADA · projeção derivada
                </span>
              </header>
              <div className="grid gap-3 p-5 sm:grid-cols-4">
                <KpiMini label="Receita prevista (12m)" value={formatBRL(dreTotais.receitaOrc)} tone="primary" />
                <KpiMini label="Custo total (12m)" value={formatBRL(dreTotais.custoOrc)} tone="warning" />
                <KpiMini label="Tributos (12m)" value={formatBRL(dreTotais.tribOrc)} tone="muted" />
                <KpiMini label="Lucro previsto (12m)" value={formatBRL(dreTotais.lucroOrc)} tone="success" />
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-2 text-left">Linha</th>
                      {projecao.map((p) => (
                        <th key={p.mes} className="px-2 py-2 text-right">{p.mes}</th>
                      ))}
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <DreRow label="(+) Receita bruta" data={projecao.map((p) => p.receitaOrc)} total={dreTotais.receitaOrc} tone="text-success" />
                    <DreRow label="(−) Tributos s/ receita" data={projecao.map((p) => -p.tribOrc)} total={-dreTotais.tribOrc} tone="text-muted-foreground" />
                    <DreRow label="(−) Custo direto + indireto" data={projecao.map((p) => -p.custoOrc)} total={-dreTotais.custoOrc} tone="text-destructive" />
                    <tr className="bg-primary-soft/40 font-bold">
                      <td className="px-2 py-2 text-left">(=) Lucro líquido</td>
                      {projecao.map((p, i) => (
                        <td key={i} className="px-2 py-2 text-right text-primary">{formatBRL(p.lucroOrc)}</td>
                      ))}
                      <td className="px-2 py-2 text-right text-primary">{formatBRL(dreTotais.lucroOrc)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {abaAtiva === "caixa" && (
            <section className="card-elevated overflow-hidden">
              <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/10 via-card to-card px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <Wallet className="h-4 w-4 text-accent" /> Caixa mensal · Orçado x Realizado
                </h2>
                <span className="chip border bg-warning-soft text-warning border-warning/30">
                  FONTE_REAL_NAO_LOCALIZADA · projeção derivada
                </span>
              </header>
              <div className="overflow-x-auto p-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-2 text-left">Mês</th>
                      <th className="px-2 py-2 text-right">Receita orçada</th>
                      <th className="px-2 py-2 text-right">Custo orçado</th>
                      <th className="px-2 py-2 text-right">Caixa orçado</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {projecao.map((p) => (
                      <tr key={p.mes} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="px-2 py-2 text-left font-sans font-semibold">{p.mes}</td>
                        <td className="px-2 py-2 text-right">{formatBRL(p.receitaOrc)}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground">{formatBRL(p.custoOrc)}</td>
                        <td className="px-2 py-2 text-right font-semibold text-primary">{formatBRL(p.caixaOrc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {abaAtiva === "grafico" && (
            <section className="card-elevated overflow-hidden">
              <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/10 via-card to-card px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                  <LineChartIcon className="h-4 w-4 text-accent" /> Caixa da licitação - Orçado x Realizado
                </h2>
                <span className="chip border bg-warning-soft text-warning border-warning/30">
                  FONTE_REAL_NAO_LOCALIZADA · projeção derivada
                </span>
              </header>
              <div className="p-5" style={{ height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projecao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => formatBRL(v as number)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="caixaOrc" name="Caixa orçado" fill="hsl(var(--primary))" opacity={0.85} radius={[4, 4, 0, 0]} />
                    <Area dataKey="caixaReal" name="Caixa realizado" fill="hsl(var(--accent))" stroke="hsl(var(--accent))" fillOpacity={0.25} />
                    <Line type="monotone" dataKey="receitaOrc" name="Receita orçada" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>

        {/* Painel lateral STICKY: BDI consolidado */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card-elevated overflow-hidden">
            <header className="border-b border-border bg-gradient-primary px-5 py-3 text-primary-foreground">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  <h3 className="font-display text-sm font-bold">BDI consolidado</h3>
                </div>
                {bdi.versao?.totais_cache && (
                  <span className="rounded bg-success/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success-foreground">
                    FONTE_OFICIAL_BDI_RECALCULAR
                  </span>
                )}
              </div>
            </header>
            <div className="space-y-3 p-5">
              <Row label="Custo direto / mês" v={formatBRL(totais.custoDiretoMes)} />
              <Row label="Custos indiretos" v={formatBRL(totais.indiretos)} />
              <Row label="Subtotal" v={formatBRL(totais.subtotal)} bold />
              <Row label="Tributos" v={formatBRL(totais.trib)} muted />
              <Row label="Margem de lucro" v={formatBRL(totais.lucro)} accent />
              <div className="border-t border-border pt-3">
                <Row label="Preço de venda / mês" v={formatBRL(totais.total)} highlight />
              </div>
              <div className="rounded-lg bg-primary-soft p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">BDI calculado (preview local)</p>
                <p className="font-display text-3xl font-bold text-primary">{totais.bdi.toFixed(2)}%</p>
              </div>
              {bdi.versao && (
                <p className="text-[10px] text-muted-foreground">
                  Versão: <strong>{bdi.versao.codigo}</strong> · status: {bdi.versao.status}
                </p>
              )}
            </div>
          </div>

          {licitacaoIdParam && bdi.versao && (
            <LicitacaoAprovacaoBox
              licitacaoId={licitacaoIdParam}
              licitacaoCodigo={tituloLicitacao}
              valorEstimado={totais.total * 12}
            />
          )}

          <div className="card-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Próximos passos
            </p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Editar postos / encargos / insumos</li>
              <li>2. Ajustar margem e tributos</li>
              <li>3. Recalcular</li>
              <li>4. Submeter à revisão</li>
              <li>5. Compor BDI oficial do contrato</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ===================== Subcomponentes =====================

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        readOnly
        value={value}
        className="h-9 w-full rounded-md border border-input bg-muted px-3 text-sm font-semibold"
      />
    </div>
  );
}

function NumField({
  label,
  v,
  onChange,
  onBlur,
  disabled,
}: {
  label: string;
  v: number;
  onChange: (v: number) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        value={v}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onBlur={onBlur}
        disabled={disabled}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

function Row({
  label,
  v,
  bold,
  muted,
  accent,
  highlight,
}: {
  label: string;
  v: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={`font-mono ${bold ? "font-bold" : ""} ${
          accent ? "text-accent font-semibold" : ""
        } ${highlight ? "text-primary font-display text-lg font-bold" : ""}`}
      >
        {v}
      </span>
    </div>
  );
}

function KpiMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "warning" | "success" | "muted";
}) {
  const map = {
    primary: "from-primary/15 to-primary/5 text-primary border-primary/20",
    warning: "from-warning/15 to-warning/5 text-warning border-warning/20",
    success: "from-success/15 to-success/5 text-success border-success/20",
    muted: "from-muted to-muted/40 text-foreground border-border",
  } as const;
  return (
    <div
      className={`rounded-lg border bg-gradient-to-br p-3 shadow-[0_2px_8px_-3px_hsl(var(--foreground)/0.08)] ${map[tone]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function DreRow({
  label,
  data,
  total,
  tone,
}: {
  label: string;
  data: number[];
  total: number;
  tone: string;
}) {
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  return (
    <tr className="border-b border-border/60 hover:bg-muted/30">
      <td className="px-2 py-1.5 text-left font-sans">{label}</td>
      {data.map((v, i) => (
        <td key={i} className={`px-2 py-1.5 text-right ${tone}`}>{fmt(v)}</td>
      ))}
      <td className={`px-2 py-1.5 text-right font-bold ${tone}`}>{fmt(total)}</td>
    </tr>
  );
}
