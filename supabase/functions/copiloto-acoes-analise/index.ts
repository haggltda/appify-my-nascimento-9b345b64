// Copiloto IA — Análise estruturada (sob demanda)
// Retorna JSON: contexto[], sugestoes[], qualificacao_problema{...}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um analista sênior de gestão corporativa do ERP do Grupo Nascimento.
Sua tarefa é analisar o RASCUNHO de uma ação (e o histórico curto de chat) e produzir cinco blocos:

1) "contexto": 4 a 8 bullets curtos com leitura estruturada (tema principal, objetivo, problema central, área impactada, comitê relacionado, prioridade sugerida, dependências, impacto esperado, pontos de atenção). Use português do Brasil, objetivo, sem floreio.

2) "sugestoes": 3 a 7 recomendações práticas (envolver área X, validar com Controladoria, prever testes, treinamento, evidências, revisar prazo, definir responsável formal, validar comitê correto). Cada item curto, acionável.

3) "qualificacao_problema": avalie o campo "problema":
   - clareza: "Alta" | "Média" | "Baixa"
   - problema_original: ecoe o texto recebido (ou "" se vazio)
   - problema_sugerido: redação melhor, completa, com causa, efeito e impacto. Se o original já estiver Alto, pode repetir ou refinar levemente.
   - pontos_ausentes: lista curta (ex: "causa raiz", "impacto financeiro", "prazo", "responsável", "evidência")
   - perguntas_recomendadas: 2 a 4 perguntas que o gestor deveria responder

Se faltar contexto suficiente (sem título, ação e problema), retorne contexto/sugestoes vazios e clareza "Baixa" com perguntas pedindo o mínimo.

4) "gantt_etapas": entre 3 e 8 etapas sugeridas para o cronograma da ação. Cada etapa: { etapa, inicio (YYYY-MM-DD), fim (YYYY-MM-DD), status: "sugerido" }.
   - Use as etapas relevantes dentre: Diagnóstico, Validação, Planejamento, Execução, Testes, Treinamento, Implantação, Acompanhamento.
   - Se o rascunho tiver "data_inicio_planejado" use-a como base; senão, use a data de hoje (assuma o dia atual). Distribua de forma realista até "data_fim_planejado" (se houver) ou em ~60 dias.
   - NUNCA invente etapas inúteis; se faltar contexto, retorne lista vazia.

5) "riscos": entre 0 e 6 riscos materiais. Cada risco: { risco (nome curto), severidade ("Alta"|"Média"|"Baixa"), justificativa (1 frase), recomendacao (1 frase prática) }.
   - Tipos a considerar: Dados, Cronograma, Financeiro, Operacional, Integração, Governança, Compliance/LGPD.
   - Se faltar contexto, retorne lista vazia.

NUNCA invente dados de banco. NUNCA escreva nada além de chamar a tool "analise_acao".`;

const tools = [
  {
    type: "function",
    function: {
      name: "analise_acao",
      description: "Retorna a análise estruturada do rascunho da ação.",
      parameters: {
        type: "object",
        properties: {
          contexto: { type: "array", items: { type: "string" } },
          sugestoes: { type: "array", items: { type: "string" } },
          qualificacao_problema: {
            type: "object",
            properties: {
              clareza: { type: "string", enum: ["Alta", "Média", "Baixa"] },
              problema_original: { type: "string" },
              problema_sugerido: { type: "string" },
              pontos_ausentes: { type: "array", items: { type: "string" } },
              perguntas_recomendadas: { type: "array", items: { type: "string" } },
            },
            required: ["clareza", "problema_original", "problema_sugerido", "pontos_ausentes", "perguntas_recomendadas"],
            additionalProperties: false,
          },
        },
        required: ["contexto", "sugestoes", "qualificacao_problema"],
        additionalProperties: false,
      },
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
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const draft = body?.draft ?? {};
    const messages = Array.isArray(body?.messages) ? body.messages.slice(-10) : [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumoChat = messages
      .map((m: any) => `${m.role === "user" ? "Usuário" : "IA"}: ${String(m.content ?? "").slice(0, 500)}`)
      .join("\n");

    const userPrompt = `RASCUNHO ATUAL (JSON):
${JSON.stringify(draft, null, 2)}

HISTÓRICO RECENTE DO CHAT (até 10 últimas mensagens):
${resumoChat || "(vazio)"}

Gere a análise chamando a tool "analise_acao".`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "analise_acao" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      const msg = aiResp.status === 429
        ? "Limite de requisições atingido. Tente novamente em instantes."
        : aiResp.status === 402
        ? "Créditos da IA esgotados. Adicione créditos no workspace."
        : "Falha ao chamar a IA.";
      console.error("AI gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta da IA sem estrutura esperada." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: any = {};
    try { parsed = JSON.parse(call.function.arguments); } catch {
      return new Response(JSON.stringify({ error: "JSON inválido da IA." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("copiloto-acoes-analise error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
