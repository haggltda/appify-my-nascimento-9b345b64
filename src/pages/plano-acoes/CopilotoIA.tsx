import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Mic, Square, Send, Loader2, RefreshCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { usePermissoes } from "@/context/PermissoesContext";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useCopilotoChat, type Draft } from "@/hooks/useCopilotoChat";
import { useComitesMap } from "@/hooks/useComitesMap";
import { PRIORIDADE_LABEL, PRIORIDADES } from "@/types/planoAcao";
import { cn } from "@/lib/utils";

function PermissionDenied() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="p-8 text-center max-w-md">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-2">
          O Copiloto IA está disponível apenas para a Presidência e Administração.
        </p>
      </Card>
    </div>
  );
}

function DraftField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | undefined; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input value={value ?? ""} type={type} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-background/50" />
    </div>
  );
}

export default function CopilotoIA() {
  const navigate = useNavigate();
  const { roles, loading } = usePermissoes();
  const allowed = roles.includes("admin") || roles.includes("presidencia");

  const { messages, draft, pronto, thinking, transcribing, error, send, transcribe, criar, reset, updateDraft } = useCopilotoChat();
  const recorder = useAudioRecorder();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);

  const { data: comitesMap = {} } = useComitesMap();
  const comitesList = Object.keys(comitesMap).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const areasDoComite = (draft.comite && comitesMap[draft.comite]?.areas) || [];
  const areaAtual = areasDoComite.find((a: any) => a.nome === draft.area) || null;
  const setoresDaArea: string[] = areaAtual?.setores ?? [];

  // Auto-preenche líder/responsável quando comitê ou área mudam
  useEffect(() => {
    if (!draft.comite) return;
    const info = comitesMap[draft.comite];
    if (!info) return;
    if (draft.area && !info.areasNomes.includes(draft.area)) {
      updateDraft({ area: "", setor: "" });
    }
  }, [draft.comite, comitesMap]);

  useEffect(() => {
    if (!draft.area || !areaAtual) return;
    const patch: Partial<Draft> = {};
    if (areaAtual.gestor && !draft.responsavel_nome) patch.responsavel_nome = areaAtual.gestor;
    if (draft.setor && !setoresDaArea.includes(draft.setor)) patch.setor = "";
    if (Object.keys(patch).length) updateDraft(patch as Draft);
  }, [draft.area, areaAtual]);

  useEffect(() => {
    if (error) toast({ title: "Copiloto IA", description: error, variant: "destructive" });
  }, [error]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  if (!allowed) return <PermissionDenied />;

  const handleMic = async () => {
    if (recorder.isRecording) {
      const out = await recorder.stop();
      if (!out) return;
      const texto = await transcribe(out.base64, out.mime);
      if (texto) await send(texto);
    } else {
      try { await recorder.start(); } catch (e: any) {
        toast({ title: "Microfone", description: e?.message ?? "Permita o acesso ao microfone.", variant: "destructive" });
      }
    }
  };

  const handleSendText = async () => {
    if (!text.trim()) return;
    const t = text;
    setText("");
    await send(t);
  };

  const camposObrig = ["titulo", "acao", "prioridade_normalizada", "data_fim_planejado"] as const;
  const faltando = camposObrig.filter((c) => !(draft as any)[c]);
  const podeCriar = pronto && faltando.length === 0;

  const handleCriar = async () => {
    setCreating(true);
    const id = await criar();
    setCreating(false);
    if (id) {
      toast({ title: "Ação criada", description: "Plano de ação registrado com sucesso." });
      reset();
      navigate(`/app/plano-acoes/${id}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary to-primary/60 p-2.5 shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Copiloto IA</h1>
            <p className="text-xs text-muted-foreground">Crie ações por voz ou texto. Acesso restrito à Presidência.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}><RefreshCcw className="h-4 w-4 mr-1" /> Nova conversa</Button>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        {/* Chat */}
        <Card className="lg:col-span-3 flex flex-col min-h-0 overflow-hidden border-primary/10">
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Toque no microfone e descreva a ação que deseja criar.</p>
                  <p className="text-xs mt-1 opacity-70">Ex.: "Criar uma ação de alta prioridade para revisar contratos vencendo em 30 de maio."</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {(thinking || transcribing) && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {transcribing ? "Transcrevendo áudio…" : "Pensando…"}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t bg-muted/30 p-3">
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="icon"
                onClick={handleMic}
                disabled={transcribing || thinking}
                className={cn(
                  "h-12 w-12 rounded-full shrink-0 transition-all shadow-lg",
                  recorder.isRecording
                    ? "bg-destructive hover:bg-destructive/90 scale-110 animate-pulse"
                    : "bg-gradient-to-br from-primary to-primary/70 hover:from-primary/90"
                )}
                title={recorder.isRecording ? "Parar e transcrever" : "Gravar áudio"}
              >
                {recorder.isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                placeholder={recorder.isRecording ? "Gravando… toque no microfone para parar" : "Ou digite aqui e Enter para enviar"}
                rows={1}
                className="resize-none min-h-[48px] bg-background"
                disabled={recorder.isRecording}
              />
              <Button onClick={handleSendText} disabled={!text.trim() || thinking} size="icon" variant="secondary" className="h-12 w-12 rounded-full shrink-0">
                <Send className="h-5 w-5" />
              </Button>
            </div>
            {recorder.isRecording && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-destructive transition-all" style={{ width: `${Math.round(recorder.level * 100)}%` }} />
                </div>
                <span className="text-xs text-destructive font-mono">REC</span>
              </div>
            )}
          </div>
        </Card>

        {/* Painel de rascunho */}
        <Card className="lg:col-span-2 flex flex-col min-h-0 border-primary/10">
          <div className="p-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Ação em rascunho</h2>
              {pronto && <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">Pronta</Badge>}
            </div>
            {faltando.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Faltando: {faltando.map((c) => c.replace(/_/g, " ")).join(", ")}
              </p>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              <DraftField label="Título *" value={draft.titulo} onChange={(v) => updateDraft({ titulo: v })} placeholder="Curto e descritivo" />
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ação *</Label>
                <Textarea rows={3} value={draft.acao ?? ""} onChange={(e) => updateDraft({ acao: e.target.value })} placeholder="O que será feito" className="bg-background/50" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Problema</Label>
                <Textarea rows={2} value={draft.problema ?? ""} onChange={(e) => updateDraft({ problema: e.target.value })} className="bg-background/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Prioridade *</Label>
                  <Select value={draft.prioridade_normalizada ?? ""} onValueChange={(v) => updateDraft({ prioridade_normalizada: v as Draft["prioridade_normalizada"] })}>
                    <SelectTrigger className="bg-background/50"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <DraftField label="Data fim *" type="date" value={draft.data_fim_planejado} onChange={(v) => updateDraft({ data_fim_planejado: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Comitê</Label>
                  {comitesList.length > 0 ? (
                    <Select value={draft.comite || "__none"} onValueChange={(v) => updateDraft({ comite: v === "__none" ? "" : v })}>
                      <SelectTrigger className="bg-background/50"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {comitesList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={draft.comite ?? ""} onChange={(e) => updateDraft({ comite: e.target.value })} className="bg-background/50" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Área</Label>
                  {areasDoComite.length > 0 ? (
                    <Select value={draft.area || "__none"} disabled={!draft.comite} onValueChange={(v) => updateDraft({ area: v === "__none" ? "" : v })}>
                      <SelectTrigger className="bg-background/50"><SelectValue placeholder={draft.comite ? "—" : "Escolha o comitê"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {areasDoComite.map((a: any) => <SelectItem key={a.nome} value={a.nome}>{a.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={draft.area ?? ""} disabled={!draft.comite} onChange={(e) => updateDraft({ area: e.target.value })} placeholder={draft.comite ? "Digite a área" : "Escolha o comitê"} className="bg-background/50" />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Setor</Label>
                {setoresDaArea.length > 0 ? (
                  <Select value={draft.setor || "__none"} disabled={!draft.area} onValueChange={(v) => updateDraft({ setor: v === "__none" ? "" : v })}>
                    <SelectTrigger className="bg-background/50"><SelectValue placeholder={draft.area ? "—" : "Escolha a área"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {setoresDaArea.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={draft.setor ?? ""} disabled={!draft.area} onChange={(e) => updateDraft({ setor: e.target.value })} placeholder={draft.area ? "Sem setores cadastrados" : "Escolha a área"} className="bg-background/50" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DraftField label="Início planejado" type="date" value={draft.data_inicio_planejado} onChange={(v) => updateDraft({ data_inicio_planejado: v })} />
                <DraftField label="Custo previsto" type="number" value={draft.custo_previsto?.toString()} onChange={(v) => updateDraft({ custo_previsto: v ? Number(v) : undefined })} />
              </div>
              <DraftField label="Responsável (nome)" value={draft.responsavel_nome} onChange={(v) => updateDraft({ responsavel_nome: v })} />
            </div>
          </ScrollArea>
          <div className="p-3 border-t bg-muted/30 flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1"><X className="h-4 w-4 mr-1" /> Descartar</Button>
            <Button onClick={handleCriar} disabled={!podeCriar || creating} className="flex-1 bg-gradient-to-r from-primary to-primary/80">
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Confirmar e criar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
