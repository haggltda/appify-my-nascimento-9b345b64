import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { cn } from "@/lib/utils";
import {
  useImplantacaoContratos,
  useChecklistItems,
  useRespostas,
  useRespostaUpsert,
  calcPrazo,
} from "@/hooks/useImplantacao";
import type { ImplantacaoContrato, ChecklistItem, Resposta } from "@/hooks/useImplantacao";
import { CheckCircle2, Circle, Clock, Building2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Implantacao() {
  const { data: empresaAtivaId } = useEmpresaId();
  const { data: contratos = [], isLoading, error } = useImplantacaoContratos(empresaAtivaId ?? null);
  const { data: checklistItems = [] } = useChecklistItems();

  const [contratoSelecionado, setContratoSelecionado] = useState<string | null>(null);
  const [momentoFiltro, setMomentoFiltro] = useState<string>("Todos");
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeConfirmados, setNomeConfirmados] = useState<Set<string>>(() => new Set());
  const qc = useQueryClient();

  const contrato = contratos.find((c) => c.id === contratoSelecionado) ?? null;

  // Seleciona o primeiro automaticamente
  useMemo(() => {
    if (contratos.length > 0 && !contratoSelecionado) {
      setContratoSelecionado(contratos[0].id);
    }
  }, [contratos, contratoSelecionado]);

  const momentos = useMemo(() => {
    const set = new Set(checklistItems.map((i) => i.momento ?? "Geral"));
    return ["Todos", ...Array.from(set)];
  }, [checklistItems]);

  const itensFiltrados = useMemo(() => {
    if (momentoFiltro === "Todos") return checklistItems;
    return checklistItems.filter((i) => (i.momento ?? "Geral") === momentoFiltro);
  }, [checklistItems, momentoFiltro]);

  const setores = useMemo(() => {
    const set = new Set(itensFiltrados.map((i) => i.setor));
    return Array.from(set);
  }, [itensFiltrados]);

  // KPIs
  const { data: respostas = [] } = useRespostas(contratoSelecionado, empresaAtivaId ?? null);
  const respostaMap = useMemo(() => {
    const m: Record<string, Resposta> = {};
    respostas.forEach((r) => { m[r.checklist_item_id] = r; });
    return m;
  }, [respostas]);

  const total = checklistItems.length;
  const respondidos = checklistItems.filter(
    (i) => respostaMap[i.id]?.resposta && respostaMap[i.id].resposta !== ""
  ).length;
  const pct = total > 0 ? Math.round((respondidos / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Implantação de Contratos"
        breadcrumb={["Contratos", "Implantação"]}
        subtitle="Checklist de implantação por contrato — acompanhe cada setor até a operação plena."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Contratos ativos" value={String(contratos.filter((c) => c.status === "ativo").length)} />
        <Kpi label="Itens respondidos" value={`${respondidos}/${total}`} />
        <Kpi label="Progresso" value={`${pct}%`} highlight={pct === 100} />
      </div>

      {!empresaAtivaId ? (
        <Empty title="Selecione uma empresa" message="" />
      ) : isLoading ? (
        <Empty title="Carregando contratos…" message="" />
      ) : error ? (
        <Empty title="Erro" message={(error as Error).message} tone="error" />
      ) : contratos.length === 0 ? (
        <Empty title="Nenhum contrato" message="Promova licitações ganhas no módulo Capa de Edital para criar contratos aqui." />
      ) : (
        <div className="space-y-4">
          {/* Seletor de contrato + filtro de momento */}
          <div className="card-elevated flex flex-wrap items-center gap-3 p-3">
            <Select
              value={contratoSelecionado ?? ""}
              onValueChange={setContratoSelecionado}
            >
              <SelectTrigger className="h-9 min-w-[260px] max-w-sm">
                <SelectValue placeholder="Selecione o contrato" />
              </SelectTrigger>
              <SelectContent>
                {contratos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={momentoFiltro} onValueChange={setMomentoFiltro}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {momentos.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {contrato && (
              <div className="text-xs text-muted-foreground">
                Início: <span className="font-medium text-foreground">{contrato.data_inicio ?? "—"}</span>
                {" · "}Abertura: <span className="font-medium text-foreground">{contrato.abertura ?? "—"}</span>
              </div>
            )}
          </div>

          {/* Banner confirmação de nome */}
          {contrato && !nomeConfirmados.has(contrato.id) && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3">
              <div className="text-xs text-amber-700">
                <span className="font-semibold">O nome do contrato está correto?</span>
                <span className="ml-2 font-mono">"{contrato.nome}"</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline"
                  className="h-7 gap-1.5 px-2 text-[11px] border-amber-400/50 text-amber-700 hover:bg-amber-50"
                  onClick={() => setEditandoNome(true)}
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setNomeConfirmados((s) => new Set([...s, contrato.id]))}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          )}

          {/* Barra de progresso */}
          {contrato && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso geral</span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Checklist por setor */}
          {contrato && checklistItems.length === 0 ? (
            <Empty title="Checklist vazio" message="Nenhum item de checklist cadastrado. Importe o Excel na tabela checklist_items no Supabase." />
          ) : contrato ? (
            <div className="space-y-3">
              {setores.map((setor) => (
                <SetorAccordion
                  key={setor}
                  setor={setor}
                  items={itensFiltrados.filter((i) => i.setor === setor)}
                  contrato={contrato}
                  respostaMap={respostaMap}
                  empresaId={empresaAtivaId!}
                  contratoId={contratoSelecionado!}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Modal editar nome */}
      {editandoNome && contrato && (
        <EditarNomeModal
          contrato={contrato}
          onClose={() => setEditandoNome(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["implantacao", empresaAtivaId] });
            setNomeConfirmados((s) => new Set([...s, contrato.id]));
          }}
        />
      )}
    </div>
  );
}

// ── Accordion por setor ───────────────────────────────────────────────────

function SetorAccordion({
  setor, items, contrato, respostaMap, empresaId, contratoId,
}: {
  setor: string;
  items: ChecklistItem[];
  contrato: ImplantacaoContrato;
  respostaMap: Record<string, Resposta>;
  empresaId: string;
  contratoId: string;
}) {
  const [open, setOpen] = useState(true);
  const upsert = useRespostaUpsert(empresaId);

  const respondidos = items.filter((i) => respostaMap[i.id]?.resposta).length;

  return (
    <div className="card-elevated overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-muted/30"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{setor}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {respondidos}/{items.length}
          </span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-border border-t border-border">
          {items.map((item) => {
            const resp = respostaMap[item.id];
            const prazo = calcPrazo(item, contrato);

            return (
              <div key={item.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{item.item}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {item.momento && <span>Momento: <strong>{item.momento}</strong></span>}
                    {prazo && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {prazo}</span>}
                    {item.responsavel_acao && <span>Resp.: {item.responsavel_acao}</span>}
                  </div>
                  {item.plano_acao && (
                    <p className="text-[11px] italic text-muted-foreground">{item.plano_acao}</p>
                  )}
                </div>

                {/* Resposta */}
                <div className="shrink-0">
                  {item.tipo_resposta === "simnao" ? (
                    <div className="flex gap-2">
                      {["Sim", "Não", "N/A"].map((op) => (
                        <Button
                          key={op}
                          size="sm"
                          variant={resp?.resposta === op ? "default" : "outline"}
                          className={cn(
                            "h-7 px-2 text-[11px]",
                            resp?.resposta === op && op === "Sim" && "bg-emerald-600 hover:bg-emerald-700",
                            resp?.resposta === op && op === "Não" && "bg-red-600 hover:bg-red-700",
                          )}
                          onClick={() =>
                            upsert.mutate({ contratoId, itemId: item.id, resposta: op })
                          }
                        >
                          {op}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="h-8 w-36 rounded-md border border-border bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                      placeholder="Resposta…"
                      defaultValue={resp?.resposta ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) upsert.mutate({ contratoId, itemId: item.id, resposta: v });
                      }}
                    />
                  )}
                </div>

                {/* Ícone de status */}
                <div className="shrink-0 pt-0.5">
                  {resp?.resposta ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal editar nome do contrato ─────────────────────────────────────────

function EditarNomeModal({ contrato, onClose, onSaved }: {
  contrato: ImplantacaoContrato;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(contrato.nome);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nome.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("implantacao_contrato")
      .update({ nome: nome.trim() })
      .eq("id", contrato.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nome atualizado!" });
      onSaved();
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar nome do contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-xs">Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || !nome.trim()} onClick={handleSave}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-3xl font-bold", highlight ? "text-emerald-600" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function Empty({ title, message, tone = "muted" }: { title: string; message: string; tone?: "muted" | "error" }) {
  return (
    <div className={cn(
      "rounded-lg border px-4 py-12 text-center text-sm",
      tone === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted/30 text-muted-foreground"
    )}>
      <p className="text-base font-semibold">{title}</p>
      {message && <p className="mt-1 text-xs">{message}</p>}
    </div>
  );
}
