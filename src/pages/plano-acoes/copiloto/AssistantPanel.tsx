import { useEffect, useRef } from "react";
import { Mic, Square, Send, Loader2, Sparkles, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useCopilotoChat";

interface Props {
  messages: ChatMessage[];
  text: string;
  setText: (v: string) => void;
  onSend: () => void;
  onMic: () => void;
  isRecording: boolean;
  recLevel: number;
  thinking: boolean;
  transcribing: boolean;
}

export function AssistantPanel({
  messages, text, setText, onSend, onMic, isRecording, recLevel, thinking, transcribing,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking, transcribing]);

  const status = isRecording ? "Ouvindo…" : transcribing ? "Transcrevendo…" : thinking ? "Pensando…" : "Assistente Online";
  const statusColor = isRecording
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : (thinking || transcribing)
      ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
      : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400";

  return (
    <Card className="flex flex-col min-h-0 overflow-hidden border-primary/10">
      <div className="flex items-center justify-between p-3 border-b bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-primary to-primary/60 p-1.5 shadow shadow-primary/20">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Assistente IA</div>
            <div className="text-[11px] text-muted-foreground">Voz ou texto</div>
          </div>
        </div>
        <Badge variant="outline" className={cn("gap-1 text-[10px] uppercase tracking-wide", statusColor)}>
          <Radio className={cn("h-3 w-3", isRecording && "animate-pulse")} />
          {status}
        </Badge>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mic className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Toque no microfone e descreva a ação que deseja criar.</p>
              <p className="text-xs mt-2 opacity-70 px-4">
                Ex.: "Criar uma ação de alta prioridade para revisar contratos vencendo em 30 de maio."
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
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
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {transcribing ? "Transcrevendo áudio…" : "Pensando…"}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-muted/30 p-3 space-y-2">
        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="icon"
            onClick={onMic}
            disabled={transcribing || thinking}
            className={cn(
              "h-11 w-11 rounded-full shrink-0 transition-all shadow",
              isRecording
                ? "bg-destructive hover:bg-destructive/90 scale-110 animate-pulse"
                : "bg-gradient-to-br from-primary to-primary/70 hover:from-primary/90"
            )}
            title={isRecording ? "Parar e transcrever" : "Gravar áudio"}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={isRecording ? "Gravando… toque no microfone para parar" : "Digite e Enter para enviar"}
            rows={1}
            className="resize-none min-h-[44px] bg-background text-sm"
            disabled={isRecording}
          />
          <Button onClick={onSend} disabled={!text.trim() || thinking} size="icon" variant="secondary" className="h-11 w-11 rounded-full shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-destructive transition-all" style={{ width: `${Math.round(recLevel * 100)}%` }} />
            </div>
            <span className="text-xs text-destructive font-mono">REC</span>
          </div>
        )}
      </div>
    </Card>
  );
}
