import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { cn } from "@/lib/utils";
import {
  useImplantacaoContratos,
  useChecklistItems,
  useRespostas,
  useRespostaUpsert,
  calcPrazo,
} from "@/hooks/useImplantacao";
import type { ImplantacaoContrato, ChecklistItem, Resposta } from "@/hooks/useImplantacao";
import { CheckCircle2, Circle, Clock, Pencil, Eye, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const { empresa } = useEmpresaAtiva();
  const empresaAtivaId = empresa.id;
  const { data: contratos = [], isLoading, error } = useImplantacaoContratos(empresaAtivaId);
  const { data: checklistItems = [] } = useChecklistItems();

  const [contratoSelecionado, setContratoSelecionado] = useState<string | null>(null);
  const [momentoFiltro, setMomentoFiltro] = useState<string>("");
  const [setorFiltro, setSetorFiltro] = useState<string>("");
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeConfirmados, setNomeConfirmados] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("implantacao:nomes-confirmados");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const qc = useQueryClient();

  const contrato = contratos.find((c) => c.id === contratoSelecionado) ?? null;

  useMemo(() => {
    if (contratos.length > 0 && !contratoSelecionado) {
      setContratoSelecionado(contratos[0].id);
    }
  }, [contratos, contratoSelecionado]);

  const momentos = useMemo(() => [...new Set(checklistItems.map((i) => i.momento).filter(Boolean) as string[])], [checklistItems]);
  const setores  = useMemo(() => [...new Set(checklistItems.map((i) => i.setor).filter(Boolean)  as string[])], [checklistItems]);

  const itensFiltrados = useMemo(() => {
    return checklistItems.filter((i) => {
      if (momentoFiltro && i.momento !== momentoFiltro) return false;
      if (setorFiltro  && i.setor   !== setorFiltro)   return false;
      return true;
    });
  }, [checklistItems, momentoFiltro, setorFiltro]);

  const setoresFiltrados = useMemo(() => [...new Set(itensFiltrados.map((i) => i.setor))], [itensFiltrados]);

  const { data: respostas = [] } = useRespostas(contratoSelecionado, empresaAtivaId ?? null);
  const upsert = useRespostaUpsert(empresaAtivaId ?? "");

  const respostaMap = useMemo(() => {
    const m: Record<string, Resposta> = {};
    respostas.forEach((r) => { m[r.checklist_item_id] = r; });
    return m;
  }, [respostas]);

  const total       = checklistItems.length;
  const respondidos = checklistItems.filter((i) => respostaMap[i.id]?.resposta).length;
  const pct         = total > 0 ? Math.round((respondidos / total) * 100) : 0;

  function confirmarNome(id: string) {
    setNomeConfirmados((prev) => {
      const next = new Set([...prev, id]);
      localStorage.setItem("implantacao:nomes-confirmados", JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Implantação de Contratos"
        breadcrumb={["Contratos", "Implantação"]}
        subtitle="Checklist de implantação por contrato — acompanhe cada setor até a operação plena."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Contratos ativos"  value={String(contratos.filter((c) => c.status === "ativo").length)} />
        <Kpi label="Itens respondidos" value={`${respondidos}/${total}`} />
        <Kpi label="Progresso"         value={`${pct}%`} highlight={pct === 100} />
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
          {/* Seletor de contrato */}
          <div className="card-elevated flex flex-wrap items-center gap-3 p-3">
            <Select value={contratoSelecionado ?? ""} onValueChange={setContratoSelecionado}>
              <SelectTrigger className="h-9 min-w-[260px] max-w-sm">
                <SelectValue placeholder="Selecione o contrato" />
              </SelectTrigger>
              <SelectContent>
                {contratos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
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
                <Button size="sm" variant="outline"
                  className="h-7 gap-1.5 px-2 text-[11px] border-amber-400/50 text-amber-700 hover:bg-amber-50"
                  onClick={() => setEditandoNome(true)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button size="sm" className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => confirmarNome(contrato.id)}>
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
                <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* Filtro de Momento */}
          {momentos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <FiltroBtn active={momentoFiltro === ""} onClick={() => setMomentoFiltro("")}>Todos momentos</FiltroBtn>
              {momentos.map((m) => (
                <FiltroBtn key={m} active={momentoFiltro === m} onClick={() => setMomentoFiltro(momentoFiltro === m ? "" : m)}>{m}</FiltroBtn>
              ))}
            </div>
          )}

          {/* Filtro de Setor */}
          {setores.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <FiltroBtn active={setorFiltro === ""} onClick={() => setSetorFiltro("")} variant="setor">Todos setores</FiltroBtn>
              {setores.map((s) => (
                <FiltroBtn key={s} active={setorFiltro === s} onClick={() => setSetorFiltro(setorFiltro === s ? "" : s)} variant="setor">{s}</FiltroBtn>
              ))}
            </div>
          )}

          {/* Cards por setor */}
          {contrato && checklistItems.length === 0 ? (
            <Empty title="Checklist vazio" message="Nenhum item de checklist cadastrado." />
          ) : contrato ? (
            <div className="space-y-6">
              {setoresFiltrados.map((setor) => {
                const itensSetor = itensFiltrados.filter((i) => i.setor === setor);
                const respSetor  = itensSetor.filter((i) => respostaMap[i.id]?.resposta).length;
                return (
                  <section key={setor}>
                    {/* Header do setor */}
                    <div className="flex items-center gap-3 border-b border-border pb-2 mb-3 flex-wrap">
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">{setor}</span>
                      <span className="font-bold text-sm">{setor}</span>
                      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{respSetor}/{itensSetor.length}</span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${itensSetor.length ? Math.round(respSetor / itensSetor.length * 100) : 0}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Grid de cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {itensSetor.map((item) => (
                        <CardChecklist
                          key={item.id}
                          item={item}
                          contrato={contrato}
                          resposta={respostaMap[item.id] ?? null}
                          onSave={(resposta, obs) =>
                            upsert.mutateAsync({ contratoId: contratoSelecionado!, itemId: item.id, resposta, obs })
                          }
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {editandoNome && contrato && (
        <EditarNomeModal
          contrato={contrato}
          onClose={() => setEditandoNome(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["implantacao", empresaAtivaId] });
            confirmarNome(contrato.id);
          }}
        />
      )}
    </div>
  );
}

// ── Card individual ───────────────────────────────────────────────────────────

function CardChecklist({
  item,
  contrato,
  resposta: savedResp,
  onSave,
}: {
  item: ChecklistItem;
  contrato: ImplantacaoContrato;
  resposta: Resposta | null;
  onSave: (resposta: string, obs: string) => Promise<unknown>;
}) {
  const isSimNao   = item.tipo_resposta === "simnao";
  const prazo      = calcPrazo(item, contrato);
  const answered   = !!savedResp?.resposta;

  const [localResp, setLocalResp] = useState<string>(savedResp?.resposta ?? "");
  const [localObs,  setLocalObs]  = useState<string>(savedResp?.obs ?? "");
  const [state, setState]         = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function handleSave() {
    if (!localResp) return;
    setState("saving");
    try {
      await onSave(localResp, localObs);
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card flex flex-col gap-3 shadow-sm transition-all",
      answered ? "border-l-4 border-l-emerald-400" : "border-border",
      "hover:shadow-md hover:border-primary/30 p-4"
    )}>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.responsavel_acao && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-secondary border border-border px-2 py-0.5 rounded">
              <ArrowRight className="w-3 h-3 text-primary" />
              {item.responsavel_acao}
            </span>
          )}
          {item.categoria && (
            <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
              {item.categoria}
            </span>
          )}
        </div>
        {item.momento && (
          <span className="text-[10px] text-muted-foreground text-right shrink-0 leading-tight max-w-[120px]">
            {item.momento}
          </span>
        )}
      </div>

      {/* Pergunta */}
      <p className="text-sm font-semibold text-foreground leading-snug">{item.item}</p>

      {/* Resposta */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resposta</span>
        {isSimNao ? (
          <div className="flex gap-2">
            {(["Sim", "Não", "N/A"] as const).map((op) => (
              <button
                key={op}
                onClick={() => setLocalResp(localResp === op ? "" : op)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                  localResp === op && op === "Sim"  && "bg-emerald-50 border-emerald-500 text-emerald-700",
                  localResp === op && op === "Não"  && "bg-red-50 border-red-500 text-red-700",
                  localResp === op && op === "N/A"  && "bg-muted border-muted-foreground/40 text-muted-foreground",
                  localResp !== op && "bg-card border-border text-foreground hover:bg-muted/50"
                )}
              >
                {op === "Sim" ? "✓ Sim" : op === "Não" ? "✗ Não" : "N/A"}
              </button>
            ))}
          </div>
        ) : (
          <Textarea
            placeholder="Digite a resposta…"
            className="min-h-[52px] text-xs resize-y"
            value={localResp}
            onChange={(e) => setLocalResp(e.target.value)}
          />
        )}
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observações</span>
        <Textarea
          placeholder="Adicione observações…"
          className="min-h-[40px] text-xs resize-y"
          value={localObs}
          onChange={(e) => setLocalObs(e.target.value)}
        />
      </div>

      {/* Salvar */}
      <Button
        size="sm"
        className={cn(
          "w-full text-xs font-semibold",
          state === "saved"  && "bg-emerald-600 hover:bg-emerald-600",
          state === "failed" && "bg-destructive hover:bg-destructive",
        )}
        disabled={state === "saving" || !localResp}
        onClick={handleSave}
      >
        {state === "saving" ? "Salvando…" : state === "saved" ? "✓ Salvo" : state === "failed" ? "✗ Falhou" : "Salvar"}
      </Button>

      {/* Meta-block */}
      {(item.plano_acao || item.responsavel_acao || item.onde || prazo) && (
        <div className="bg-muted/60 rounded-lg px-3 py-2.5 space-y-1.5 text-[11px]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Meta-block — contexto para execução</p>
          {item.plano_acao && <MetaRow label="Plano de ação" value={item.plano_acao} />}
          {item.responsavel_acao && <MetaRow label="Resp. ação" value={item.responsavel_acao} />}
          {item.onde && <MetaRow label="Onde" value={item.onde} />}
          {prazo && <MetaRow label="Prazo" value={prazo} highlight />}
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[80px] shrink-0 font-semibold">{label}</span>
      <span className={highlight ? "text-orange-600 font-semibold" : "text-foreground"}>{value}</span>
    </div>
  );
}

// ── Filtro pill ───────────────────────────────────────────────────────────────

function FiltroBtn({ children, active, onClick, variant = "momento" }: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  variant?: "momento" | "setor";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs font-semibold px-3 py-1 rounded-full border transition-all",
        active
          ? variant === "setor"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ── Modal editar nome ─────────────────────────────────────────────────────────

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
    const { error } = await supabase.from("implantacao_contrato").update({ nome: nome.trim() }).eq("id", contrato.id);
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
        <DialogHeader><DialogTitle>Editar nome do contrato</DialogTitle></DialogHeader>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-3xl font-bold", highlight ? "text-emerald-600" : "text-foreground")}>{value}</p>
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
