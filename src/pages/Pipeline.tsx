import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { usePermissoes } from "@/context/PermissoesContext";
import { cn } from "@/lib/utils";
import {
  useGrade,
  useGradeInsert,
  useGradeUpdate,
  useGradeDelete,
  useGradePromover,
} from "@/hooks/useGrade";
import type { GradeItem, GradeFase, GradeInsert } from "@/hooks/useGrade";
import { useUsuariosEmpresa } from "@/hooks/useUsuariosEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, FileText, Eye, History } from "lucide-react";

// ── Constantes ─────────────────────────────────────────────────────────────

const FASES: GradeFase[] = [
  "À Iniciar",
  "Em Andamento",
  "Finalizada",
  "Não Participado",
  "Suspenso/Revogado",
];

const FASE_COLOR: Record<GradeFase, string> = {
  "À Iniciar": "bg-blue-500/15 text-blue-700 border-blue-300/50",
  "Em Andamento": "bg-amber-500/15 text-amber-700 border-amber-300/50",
  "Finalizada": "bg-emerald-500/15 text-emerald-700 border-emerald-300/50",
  "Não Participado": "bg-slate-400/15 text-slate-600 border-slate-300/50",
  "Suspenso/Revogado": "bg-red-400/15 text-red-700 border-red-300/50",
};

const FASE_DOT: Record<GradeFase, string> = {
  "À Iniciar": "bg-blue-500",
  "Em Andamento": "bg-amber-500",
  "Finalizada": "bg-emerald-500",
  "Não Participado": "bg-slate-400",
  "Suspenso/Revogado": "bg-red-500",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ANOS = [2024, 2025, 2026, 2027];

// ── Componente principal ───────────────────────────────────────────────────

export default function Pipeline() {
  const { data: empresaAtivaId } = useEmpresaId();
  const { can } = usePermissoes();

  const canIncluir = can("incluir", "licitacoes", "pipeline");
  const canAlterar = can("alterar", "licitacoes", "pipeline");
  const canExcluir = can("excluir", "licitacoes", "pipeline");

  const { data: items = [], isLoading, error } = useGrade(empresaAtivaId ?? null);
  const insert = useGradeInsert(empresaAtivaId ?? "");
  const update = useGradeUpdate(empresaAtivaId ?? "");
  const remove = useGradeDelete(empresaAtivaId ?? "");
  const promover = useGradePromover(empresaAtivaId ?? "");
  const { data: usuarios = [] } = useUsuariosEmpresa();

  // filtros
  const [faseAtiva, setFaseAtiva] = useState<GradeFase | "Todas">("Todas");
  const [mesAtivo, setMesAtivo] = useState<number | null>(null);
  const [anoAtivo, setAnoAtivo] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("Todos");

  // lista de responsáveis únicos para o filtro
  const responsaveis = useMemo(() => {
    const set = new Set(items.map((i) => i.responsavel).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [items]);

  // modais
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GradeItem | null>(null);
  const [viewItem, setViewItem] = useState<GradeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GradeItem | null>(null);
  const [promoverTarget, setPromoverTarget] = useState<GradeItem | null>(null);

  // stats
  const stats = useMemo(() => {
    const map: Record<GradeFase, number> = {
      "À Iniciar": 0, "Em Andamento": 0, "Finalizada": 0,
      "Não Participado": 0, "Suspenso/Revogado": 0,
    };
    items.forEach((i) => { if (i.fase in map) map[i.fase]++; });
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];

    if (faseAtiva !== "Todas") list = list.filter((i) => i.fase === faseAtiva);

    if (mesAtivo !== null || anoAtivo !== null) {
      list = list.filter((i) => {
        if (!i.data) return false;
        const d = new Date(i.data + "T00:00:00");
        if (mesAtivo !== null && d.getMonth() !== mesAtivo) return false;
        if (anoAtivo !== null && d.getFullYear() !== anoAtivo) return false;
        return true;
      });
    }

    if (responsavelFiltro !== "Todos") {
      list = list.filter((i) => i.responsavel === responsavelFiltro);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(
        (i) =>
          i.edital?.toLowerCase().includes(q) ||
          i.objeto?.toLowerCase().includes(q) ||
          i.cidade?.toLowerCase().includes(q) ||
          i.responsavel?.toLowerCase().includes(q)
      );
    }

    // ordenação contextual
    if (faseAtiva === "À Iniciar") {
      list.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
    } else if (faseAtiva === "Em Andamento" || faseAtiva === "Finalizada") {
      list.sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999));
    }

    return list;
  }, [items, faseAtiva, mesAtivo, anoAtivo, busca, responsavelFiltro]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(item: GradeItem) {
    setEditing(item);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        breadcrumb={["Pipeline"]}
        subtitle="Grade de licitações — pré-análise de editais antes da Capa de Edital."
        actions={
          canIncluir ? (
            <Button size="sm" onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Entrada
            </Button>
          ) : null
        }
      />

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        {FASES.map((f) => (
          <button
            key={f}
            onClick={() => setFaseAtiva(faseAtiva === f ? "Todas" : f)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition",
              faseAtiva === f
                ? FASE_COLOR[f]
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", FASE_DOT[f])} />
            {f}
            <span className="ml-1 font-bold tabular-nums">{stats[f]}</span>
          </button>
        ))}
        {faseAtiva !== "Todas" && (
          <button
            onClick={() => setFaseAtiva("Todas")}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
          >
            Todas
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="card-elevated flex flex-wrap items-center gap-3 p-3">
        <Input
          placeholder="Buscar edital, objeto, cidade…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Select
          value={mesAtivo !== null ? String(mesAtivo) : "_"}
          onValueChange={(v) => setMesAtivo(v === "_" ? null : Number(v))}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Todos os meses</SelectItem>
            {MESES.map((m, i) => (
              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={anoAtivo !== null ? String(anoAtivo) : "_"}
          onValueChange={(v) => setAnoAtivo(v === "_" ? null : Number(v))}
        >
          <SelectTrigger className="h-9 w-[100px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Todos</SelectItem>
            {ANOS.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro por responsável */}
        {responsaveis.length > 0 && (
          <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Conteúdo */}
      {!empresaAtivaId ? (
        <EmptyState title="Selecione uma empresa" message="Escolha uma empresa para visualizar a grade de licitações." />
      ) : isLoading ? (
        <EmptyState title="Carregando…" message="Buscando entradas da grade." />
      ) : error ? (
        <EmptyState title="Erro ao carregar" message={(error as Error).message} tone="error" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={faseAtiva !== "Todas" ? `Nenhuma entrada em "${faseAtiva}"` : "Nenhuma entrada cadastrada"}
          message={canIncluir ? 'Clique em "Nova Entrada" para começar.' : "Nenhum edital foi registrado ainda."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <GradeCard
              key={item.id}
              item={item}
              canAlterar={canAlterar}
              canExcluir={canExcluir}
              onEdit={() => openEdit(item)}
              onView={() => setViewItem(item)}
              onDelete={() => setDeleteTarget(item)}
              onPromover={() => setPromoverTarget(item)}
              promovendo={promover.isPending && promoverTarget?.id === item.id}
            />
          ))}
        </div>
      )}

      {/* Sheet de criação/edição */}
      <GradeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        usuarios={usuarios}
        onSave={(payload) => {
          if (editing) {
            update.mutate(
              { id: editing.id, changes: payload, current: editing },
              { onSuccess: () => setSheetOpen(false) }
            );
          } else {
            insert.mutate(payload as GradeInsert, {
              onSuccess: () => setSheetOpen(false),
            });
          }
        }}
        isSaving={insert.isPending || update.isPending}
      />

      {/* Modal visualizar / historico */}
      {viewItem && (
        <ViewModal item={viewItem} onClose={() => setViewItem(null)} />
      )}

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O edital{" "}
              <strong>{deleteTarget?.edital || deleteTarget?.objeto || "selecionado"}</strong> será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar promoção para Capa */}
      <AlertDialog open={!!promoverTarget} onOpenChange={(o) => !o && setPromoverTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar Capa de Edital?</AlertDialogTitle>
            <AlertDialogDescription>
              Uma Capa de Edital será criada para{" "}
              <strong>{promoverTarget?.objeto || promoverTarget?.edital || "este edital"}</strong> e ficará
              disponível no módulo <strong>Capa de Edital Licitações</strong>. Os dados da grade serão pré-preenchidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (promoverTarget)
                  promover.mutate(promoverTarget, { onSuccess: () => setPromoverTarget(null) });
              }}
            >
              Criar Capa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

function GradeCard({
  item,
  canAlterar,
  canExcluir,
  onEdit,
  onView,
  onDelete,
  onPromover,
  promovendo,
}: {
  item: GradeItem;
  canAlterar: boolean;
  canExcluir: boolean;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onPromover: () => void;
  promovendo: boolean;
}) {
  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  return (
    <article className="card-floating space-y-3 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-mono text-muted-foreground">{item.edital || "Sem número"}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{item.objeto || "—"}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            FASE_COLOR[item.fase]
          )}
        >
          {item.fase}
        </span>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span><span className="font-medium text-foreground">Cidade:</span> {item.cidade || "—"} {item.uf ? `/ ${item.uf}` : ""}</span>
        <span><span className="font-medium text-foreground">Abertura:</span> {fmtDate(item.data)}</span>
        <span><span className="font-medium text-foreground">Responsável:</span> {item.responsavel || "—"}</span>
        <span><span className="font-medium text-foreground">Posição:</span> {item.posicao ?? "—"}</span>
        {item.valor_global && (
          <span className="col-span-2"><span className="font-medium text-foreground">Valor:</span> {item.valor_global}</span>
        )}
      </div>

      {item.status_obs && (
        <p className="rounded bg-muted/50 px-2 py-1 text-[11px] italic text-muted-foreground line-clamp-2">
          {item.status_obs}
        </p>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canAlterar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canExcluir && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {canAlterar && !item.capa_id && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={onPromover}
            disabled={promovendo}
            title="Criar Capa de Edital para este edital"
          >
            <FileText className="h-3 w-3" />
            {promovendo ? "Criando…" : "Criar Capa"}
          </Button>
        )}
        {item.capa_id && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Capa criada
          </span>
        )}
      </div>
    </article>
  );
}

// ── Sheet form ─────────────────────────────────────────────────────────────

import type { UsuarioEmpresaOption } from "@/hooks/useUsuariosEmpresa";

const EMPTY_FORM = {
  edital: "", fase: "À Iniciar" as GradeFase, responsavel: "", cidade: "",
  uf: "", data: "", horario: "", objeto: "", qtd_pessoas: "",
  valor_global: "", posicao: "", status_obs: "", data_captacao: "",
};

function GradeSheet({
  open, onOpenChange, editing, onSave, isSaving, usuarios,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: GradeItem | null;
  onSave: (p: Partial<GradeItem>) => void;
  isSaving: boolean;
  usuarios: UsuarioEmpresaOption[];
}) {
  const [f, setF] = useState({ ...EMPTY_FORM });

  // Preenche quando abre para edição
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setF({
        edital: editing.edital ?? "",
        fase: editing.fase,
        responsavel: editing.responsavel ?? "",
        cidade: editing.cidade ?? "",
        uf: editing.uf ?? "",
        data: editing.data ?? "",
        horario: editing.horario ?? "",
        objeto: editing.objeto ?? "",
        qtd_pessoas: editing.qtd_pessoas !== null ? String(editing.qtd_pessoas) : "",
        valor_global: editing.valor_global ?? "",
        posicao: editing.posicao !== null ? String(editing.posicao) : "",
        status_obs: editing.status_obs ?? "",
        data_captacao: editing.data_captacao ?? "",
      });
    } else {
      setF({ ...EMPTY_FORM });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      edital: f.edital || null,
      fase: f.fase,
      responsavel: f.responsavel || null,
      cidade: f.cidade || null,
      uf: f.uf || null,
      data: f.data || null,
      horario: f.horario || null,
      objeto: f.objeto || null,
      qtd_pessoas: f.qtd_pessoas ? Number(f.qtd_pessoas) : null,
      valor_global: f.valor_global || null,
      posicao: f.posicao ? Number(f.posicao) : null,
      status_obs: f.status_obs || null,
      data_captacao: f.data_captacao || null,
    });
  }

  const field = (label: string, key: keyof typeof f, opts?: { type?: string; required?: boolean }) => (
    <div className="space-y-1">
      <Label htmlFor={key} className="text-xs">{label}{opts?.required && <span className="text-destructive"> *</span>}</Label>
      <Input
        id={key}
        type={opts?.type ?? "text"}
        value={f[key]}
        onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
        className="h-9"
        required={opts?.required}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Entrada" : "Nova Entrada"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {field("Nº do Edital", "edital")}

          <div className="space-y-1">
            <Label className="text-xs">Fase <span className="text-destructive">*</span></Label>
            <Select value={f.fase} onValueChange={(v) => setF((p) => ({ ...p, fase: v as GradeFase }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASES.map((fa) => <SelectItem key={fa} value={fa}>{fa}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {field("Objeto / Descrição", "objeto")}

          <div className="grid grid-cols-2 gap-3">
            {field("Data de captação", "data_captacao", { type: "date" })}
            {field("Data de Abertura", "data", { type: "date" })}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            {usuarios.length > 0 ? (
              <Select
                value={f.responsavel || "_"}
                onValueChange={(v) => setF((p) => ({ ...p, responsavel: v === "_" ? "" : v }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">— Sem responsável —</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.display_name ?? u.email ?? u.id}>
                      {u.display_name || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={f.responsavel}
                onChange={(e) => setF((p) => ({ ...p, responsavel: e.target.value }))}
                className="h-9"
                placeholder="Nome do responsável"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("Cidade", "cidade")}
            <div className="space-y-1">
              <Label htmlFor="uf" className="text-xs">UF</Label>
              <Input id="uf" value={f.uf} onChange={(e) => setF((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} className="h-9" maxLength={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("Horário de Abertura", "horario")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("Qtd. Pessoas", "qtd_pessoas", { type: "number" })}
            {field("Posição", "posicao", { type: "number" })}
          </div>

          {field("Valor Global", "valor_global")}

          <div className="space-y-1">
            <Label htmlFor="status_obs" className="text-xs">Observações / Status</Label>
            <Textarea
              id="status_obs"
              value={f.status_obs}
              onChange={(e) => setF((p) => ({ ...p, status_obs: e.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Salvando…" : editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de visualização ──────────────────────────────────────────────────

function ViewModal({ item, onClose }: { item: GradeItem; onClose: () => void }) {
  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", FASE_COLOR[item.fase])}>
              {item.fase}
            </span>
            {item.edital || item.objeto || "Detalhe do Edital"}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3 text-sm">
          <Row label="Objeto" value={item.objeto} />
          <Row label="Cidade / UF" value={[item.cidade, item.uf].filter(Boolean).join(" / ") || "—"} />
          <Row label="Captação" value={fmtDate(item.data_captacao)} />
          <Row label="Abertura" value={`${fmtDate(item.data)}${item.horario ? " às " + item.horario : ""}`} />
          <Row label="Responsável" value={item.responsavel} />
          <Row label="Posição" value={item.posicao !== null ? String(item.posicao) : null} />
          <Row label="Qtd. Pessoas" value={item.qtd_pessoas !== null ? String(item.qtd_pessoas) : null} />
          <Row label="Valor Global" value={item.valor_global} />
          {item.status_obs && <Row label="Obs." value={item.status_obs} />}

          {item.historico.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Histórico de alterações
              </p>
              <div className="space-y-1.5">
                {item.historico.map((h, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{h.campo}</span>
                    {" "}alterado de{" "}
                    <span className="font-mono">{h.de}</span>
                    {" "}para{" "}
                    <span className="font-mono">{h.para}</span>
                    <span className="ml-2 text-[10px] opacity-60">{h.ts}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ title, message, tone = "muted" }: { title: string; message: string; tone?: "muted" | "error" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-12 text-center text-sm",
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-muted/30 text-muted-foreground"
      )}
    >
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-xs">{message}</p>
    </div>
  );
}
