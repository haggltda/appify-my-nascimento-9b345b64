import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChatRole = "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string; }
export type Draft = Partial<{
  titulo: string;
  acao: string;
  problema: string;
  comite: string;
  area: string;
  prioridade_normalizada: "emergencial"|"alta"|"media"|"baixa"|"nao_informada";
  data_fim_planejado: string;
  data_inicio_planejado: string;
  responsavel_nome: string;
  custo_previsto: number;
}>;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copiloto-acoes-chat`;
const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copiloto-acoes-transcrever`;
const CRIAR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copiloto-acoes-criar`;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useCopilotoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [pronto, setPronto] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef<Draft>({});
  draftRef.current = draft;

  const updateDraft = useCallback((patch: Draft) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const send = useCallback(async (texto: string) => {
    if (!texto.trim()) return;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: texto };
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);

    try {
      const headers = await authHeader();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          draft: draftRef.current,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
        if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos à workspace.");
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || "Falha na chamada da IA");
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let assistantText = "";
      let assistantStarted = false;
      // Acumuladores de tool calls (streaming OpenAI-compatible)
      const toolBuffers = new Map<number, { name: string; args: string }>();
      let done = false;

      const upsertAssistant = (chunk: string) => {
        assistantText += chunk;
        setMessages((prev) => {
          if (assistantStarted) {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
            }
          }
          assistantStarted = true;
          return [...prev, { role: "assistant", content: assistantText }];
        });
      };

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;
            if (typeof delta.content === "string" && delta.content) upsertAssistant(delta.content);
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const cur = toolBuffers.get(idx) ?? { name: "", args: "" };
                if (tc.function?.name) cur.name = tc.function.name;
                if (tc.function?.arguments) cur.args += tc.function.arguments;
                toolBuffers.set(idx, cur);
              }
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      // Aplica tool calls
      for (const { name, args } of toolBuffers.values()) {
        try {
          const parsed = args ? JSON.parse(args) : {};
          if (name === "propor_rascunho_acao") {
            updateDraft(parsed);
          } else if (name === "confirmar_pronto") {
            setPronto(true);
          }
        } catch (err) {
          console.error("Falha ao parsear tool args", name, args, err);
        }
      }
      if (!assistantText) {
        setMessages((prev) => [...prev, { role: "assistant", content: "(rascunho atualizado)" }]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Erro");
    } finally {
      setThinking(false);
    }
  }, [messages, updateDraft]);

  const transcribe = useCallback(async (base64: string, mime: string): Promise<string> => {
    setTranscribing(true);
    setError(null);
    try {
      const headers = await authHeader();
      const resp = await fetch(STT_URL, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: base64, mime }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Falha na transcrição");
      return j.texto ?? "";
    } catch (e: any) {
      setError(e?.message ?? "Erro");
      return "";
    } finally {
      setTranscribing(false);
    }
  }, []);

  const criar = useCallback(async (): Promise<string | null> => {
    setError(null);
    const headers = await authHeader();
    const resp = await fetch(CRIAR_URL, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ draft: draftRef.current }),
    });
    const j = await resp.json();
    if (!resp.ok) {
      setError(j.error || "Falha ao criar ação");
      return null;
    }
    return j.id as string;
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setDraft({});
    setPronto(false);
    setError(null);
  }, []);

  return { messages, draft, pronto, thinking, transcribing, error, send, transcribe, criar, reset, updateDraft, setPronto };
}
