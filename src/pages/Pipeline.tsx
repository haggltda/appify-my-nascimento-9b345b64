import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusChip, CriticidadeChip } from "@/components/StatusChip";
import { licitacoes as licitacoesBase, statusOrdem, statusLabel, formatBRL, formatDate, type StatusLicitacao, type Licitacao } from "@/data/licitacoes";
import gradeSeed from "@/data/licitacoesGradeSeed.json";
import { LayoutGrid, List, Filter, Plus, Search, Calendar, Building, MoreVertical, UserCheck, Hand, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePermissoes } from "@/context/PermissoesContext";

const STORAGE_KEY = "pipeline_responsaveis_v1";

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export default function Pipeline() {
  const [view, setView] = useState<"kanban" | "tabela">("kanban");
  const [overrides, setOverrides] = useState<Record<string, string>>(() => loadOverrides());
  const [target, setTarget] = useState<Licitacao | null>(null);
  const { user } = useAuth();
  const { can } = usePermissoes();
  const [displayName, setDisplayName] = useState<string>("");
  const navigate = useNavigate();

  // B2.1.a — Fase 1 (Pipeline): permissões finas
  const canIncluir = can("incluir", "licitacoes", "pipeline");
  const canExcluir = can("excluir", "licitacoes", "pipeline");
  const canAlterar = can("alterar", "licitacoes", "pipeline");

  const openComposicao = (l: Licitacao) => {
    // Filtro híbrido: licitacao= sempre; (futuro) contrato= se vinculado
    navigate(`/app/composicao?licitacao=${encodeURIComponent(l.id)}`);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name || data?.email || user.email || "Você");
      });
  }, [user]);

  const data = useMemo<Licitacao[]>(
    () => licitacoesBase.map((l) => (overrides[l.id] ? { ...l, responsavel: overrides[l.id] } : l)),
    [overrides]
  );

  const handleConfirmAssume = () => {
    if (!target) return;
    if (!user) {
      toast({ title: "Faça login", description: "Você precisa estar autenticado para assumir um processo.", variant: "destructive" });
      setTarget(null);
      return;
    }
    const nome = displayName || user.email || "Você";
    const next = { ...overrides, [target.id]: nome };
    setOverrides(next);
    saveOverrides(next);
    toast({ title: "Processo assumido", description: `Você é o responsável por ${target.numero}.` });
    setTarget(null);
  };

  const [importing, setImporting] = useState(false);
  const handleImportGrade = async () => {
    if (importing) return;
    if (!confirm(`Importar ${(gradeSeed as any[]).length} licitações da Grade 2026 para o banco? Isso substituirá a carga existente da empresa HAGG.`)) return;
    setImporting(true);
    try {
      const empresaId = "5a61c769-21d8-4e61-b9bb-506b8db0bce8";
      await supabase.from("licitacao").delete().eq("empresa_id", empresaId);
      const rows = gradeSeed as any[];
      const batch = 50;
      for (let i = 0; i < rows.length; i += batch) {
        const { error } = await supabase.from("licitacao").insert(rows.slice(i, i + batch));
        if (error) throw error;
      }
      toast({ title: "Grade importada", description: `${rows.length} licitações carregadas.` });
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline de Oportunidades"
        breadcrumb={["Pipeline"]}
        subtitle="Acompanhe a evolução dos editais por etapa do fluxo. Alterne entre visão Kanban executiva e tabela operacional."
        actions={
          <>
            <div className="inline-flex h-9 items-center rounded-md border border-border bg-card p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium",
                  view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setView("tabela")}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium",
                  view === "tabela" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="h-3.5 w-3.5" /> Tabela
              </button>
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Filter className="h-3.5 w-3.5" /> Filtros avançados
            </button>
            <button
              onClick={handleImportGrade}
              disabled={importing}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" /> {importing ? "Importando..." : "Importar Grade 2026"}
            </button>
            <button
              onClick={() => navigate("/app/editais")}
              className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Nova Oportunidade
            </button>
          </>
        }
      />

      {/* Filtros rápidos */}
      <div className="card-elevated flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar por número, órgão ou objeto…"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <FilterPill label="Empresa" value="Todas" />
        <FilterPill label="Modalidade" value="Todas" />
        <FilterPill label="Órgão" value="Todos" />
        <FilterPill label="Criticidade" value="Todas" />
        <FilterPill label="Período" value="Últimos 90 dias" icon={<Calendar className="h-3 w-3" />} />
      </div>

      {view === "kanban" ? (
        <KanbanView data={data} currentUser={displayName} onAssume={setTarget} onOpen={openComposicao} />
      ) : (
        <TableView data={data} currentUser={displayName} onAssume={setTarget} onOpen={openComposicao} />
      )}

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assumir processo de licitação?</AlertDialogTitle>
            <AlertDialogDescription>
              {target && (
                <>
                  Você está prestes a assumir como <strong>responsável</strong> pelo processo{" "}
                  <span className="font-mono">{target.numero}</span> — {target.objeto}.
                  <br />
                  <br />
                  Responsável atual: <strong>{target.responsavel}</strong>.
                  <br />
                  Novo responsável: <strong>{displayName || "Você"}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAssume}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterPill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary">
      {icon}
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </button>
  );
}

function AssumirButton({ licitacao, currentUser, onAssume, compact }: {
  licitacao: Licitacao;
  currentUser: string;
  onAssume: (l: Licitacao) => void;
  compact?: boolean;
}) {
  const isMine = currentUser && licitacao.responsavel === currentUser;
  const temResponsavel = !!licitacao.responsavel && licitacao.responsavel.trim() !== "" && licitacao.responsavel.toLowerCase() !== "—";
  if (isMine) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-medium text-primary",
        compact ? "text-[10px]" : "text-xs"
      )}>
        <UserCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        Você é o responsável
      </span>
    );
  }
  if (temResponsavel) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-muted-foreground",
        compact ? "text-[10px]" : "text-xs"
      )} title={`Atribuído a ${licitacao.responsavel}`}>
        <UserCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        Atribuído
      </span>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onAssume(licitacao); }}
      className={cn(
        "btn-relief inline-flex items-center gap-1 rounded-md bg-gradient-accent font-semibold text-accent-foreground transition hover:opacity-90",
        compact ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-xs"
      )}
    >
      <Hand className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Assumir
    </button>
  );
}

function KanbanView({ data, currentUser, onAssume, onOpen }: {
  data: Licitacao[];
  currentUser: string;
  onAssume: (l: Licitacao) => void;
  onOpen: (l: Licitacao) => void;
}) {
  const cols: StatusLicitacao[] = ["oportunidade", "em_analise", "parecer_tecnico", "controladoria", "aprovacao_diretoria", "pregao", "vencida"];
  return (
    <div className="overflow-x-auto pb-4 scroll-elegant">
      <div className="flex gap-4" style={{ minWidth: cols.length * 300 }}>
        {cols.map((s) => {
          const items = data.filter((l) => l.status === s);
          return (
            <div key={s} className="w-[300px] shrink-0">
              <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <StatusChip status={s} />
                  <span className="text-xs font-semibold text-muted-foreground">{items.length}</span>
                </div>
                <button className="text-muted-foreground hover:text-foreground"><MoreVertical className="h-3.5 w-3.5" /></button>
              </div>
              <div className="space-y-2.5">
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum processo nesta etapa
                  </div>
                )}
                {items.map((l) => (
                  <article key={l.id} onDoubleClick={() => onOpen(l)} className="card-floating cursor-pointer p-3.5 hover:border-primary/40" title="Duplo-clique para abrir Composição & BDI">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[11px] text-muted-foreground">{l.numero}</p>
                      <CriticidadeChip value={l.criticidade} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug">{l.objeto}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Building className="h-3 w-3" /> {l.orgao}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{l.empresa}</span>
                      <span className="font-mono text-[11px] font-semibold">{formatBRL(l.valorEstimado)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{l.responsavel}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {formatDate(l.prazo)}</span>
                    </div>
                    <div className="mt-2.5 flex justify-end border-t border-border pt-2">
                      <AssumirButton licitacao={l} currentUser={currentUser} onAssume={onAssume} compact />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableView({ data, currentUser, onAssume, onOpen }: {
  data: Licitacao[];
  currentUser: string;
  onAssume: (l: Licitacao) => void;
  onOpen: (l: Licitacao) => void;
}) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Processo</th>
              <th className="px-3 py-3 text-left">Órgão / Modalidade</th>
              <th className="px-3 py-3 text-left">Empresa</th>
              <th className="px-3 py-3 text-left">Etapa</th>
              <th className="px-3 py-3 text-left">Criticidade</th>
              <th className="px-3 py-3 text-right">Valor</th>
              <th className="px-3 py-3 text-left">Responsável</th>
              <th className="px-3 py-3 text-right">Prazo</th>
              <th className="px-5 py-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((l) => (
              <tr key={l.id} onDoubleClick={() => onOpen(l)} className="group cursor-pointer hover:bg-muted/40" title="Duplo-clique para abrir Composição & BDI">
                <td className="px-5 py-3">
                  <p className="font-mono text-[11px] text-muted-foreground">{l.numero}</p>
                  <p className="line-clamp-1 max-w-sm text-sm font-medium">{l.objeto}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs">{l.orgao}</p>
                  <p className="text-[11px] text-muted-foreground">{l.modalidade}</p>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{l.empresa}</span>
                </td>
                <td className="px-3 py-3"><StatusChip status={l.status} /></td>
                <td className="px-3 py-3"><CriticidadeChip value={l.criticidade} /></td>
                <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{formatBRL(l.valorEstimado)}</td>
                <td className="px-3 py-3 text-xs">{l.responsavel}</td>
                <td className="px-3 py-3 text-right text-xs text-muted-foreground">{formatDate(l.prazo)}</td>
                <td className="px-5 py-3 text-center">
                  <AssumirButton licitacao={l} currentUser={currentUser} onAssume={onAssume} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>Mostrando 1–{data.length} de {data.length} processos</span>
        <div className="flex items-center gap-1">
          <button className="rounded border border-border px-2 py-1 hover:bg-secondary">Anterior</button>
          <button className="rounded bg-primary px-2 py-1 text-primary-foreground">1</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-secondary">Próximo</button>
        </div>
      </div>
    </div>
  );
}
