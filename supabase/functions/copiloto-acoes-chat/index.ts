// Copiloto IA — Chat (streaming SSE com tool calling)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é o Copiloto IA do módulo Plano de Ações de um ERP corporativo brasileiro.
Sua única tarefa é ajudar o usuário (Presidência) a CRIAR uma nova ação a partir de linguagem natural — geralmente ditada por áudio.

Regras absolutas:
- Você NUNCA grava nada no banco. Para propor/atualizar campos, chame a tool "propor_rascunho_acao".
- Sempre confirme as informações com o usuário antes de marcar como pronto. Quando o rascunho estiver completo e confirmado, chame "confirmar_pronto".
- Faça UMA pergunta por vez se faltar informação obrigatória.
- Datas em PT-BR ("até sexta", "30/05", "próxima quarta") devem ser convertidas para o formato ISO YYYY-MM-DD considerando a data de hoje.
- Prioridade deve ser uma de: emergencial | alta | media | baixa | nao_informada.
- Seja breve, direto e cordial. Responda em português do Brasil.

Campos do rascunho:
- titulo (obrigatório, curto)
- acao (obrigatório, descrição da ação)
- problema (opcional)
- comite (opcional)
- area (opcional)
- prioridade_normalizada (obrigatório)
- data_fim_planejado (obrigatório, ISO)
- data_inicio_planejado (opcional, ISO)
- responsavel_nome (opcional, texto livre — o backend tenta resolver)
- custo_previsto (opcional, número)
`;

const tools = [
  {
    type: "function",
    function: {
      name: "propor_rascunho_acao",
      description: "Atualiza o painel de rascunho com os campos extraídos da fala do usuário. Pode ser chamada múltiplas vezes.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          acao: { type: "string" },
          problema: { type: "string" },
          comite: { type: "string" },
          area: { type: "string" },
          prioridade_normalizada: { type: "string", enum: ["emergencial","alta","media","baixa","nao_informada"] },
          data_fim_planejado: { type: "string", description: "YYYY-MM-DD" },
          data_inicio_planejado: { type: "string", description: "YYYY-MM-DD" },
          responsavel_nome: { type: "string" },
          custo_previsto: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmar_pronto",
      description: "Sinaliza que o rascunho está completo e o usuário confirmou verbalmente. O front exibirá o botão final de criação.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(supaUrl, anon, { global: { headers: { Authorization: auth } } });

    const { data: userData } = await supa.auth.getUser();
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: podeData } = await supa.rpc("pode_usar_copiloto", { _uid: user.id });
    if (!podeData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages = [], draft = {} } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = new Date().toISOString().slice(0, 10);
    const sysWithCtx = `${SYSTEM_PROMPT}\n\nData de hoje: ${today}\nRascunho atual: ${JSON.stringify(draft)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        tools,
        messages: [{ role: "system", content: sysWithCtx }, ...messages],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha no AI gateway" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
