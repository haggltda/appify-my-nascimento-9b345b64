// Copiloto IA — Cria a ação efetivamente após confirmação humana
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIORIDADES = ["emergencial","alta","media","baixa","nao_informada"] as const;

function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const supaUser = createClient(supaUrl, anon, { global: { headers: { Authorization: auth } } });
    const supaAdmin = createClient(supaUrl, service);

    const { data: userData } = await supaUser.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: pode } = await supaUser.rpc("pode_usar_copiloto", { _uid: user.id });
    if (!pode) return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { draft = {}, conversa_id = null } = await req.json();

    const titulo = String(draft.titulo ?? "").trim();
    const acao = String(draft.acao ?? "").trim();
    const prioridade = String(draft.prioridade_normalizada ?? "").trim();
    const dataFim = draft.data_fim_planejado;

    const errors: string[] = [];
    if (!titulo) errors.push("titulo");
    if (!acao) errors.push("acao");
    if (!PRIORIDADES.includes(prioridade as any)) errors.push("prioridade_normalizada");
    if (!isISODate(dataFim)) errors.push("data_fim_planejado");
    if (errors.length) {
      return new Response(JSON.stringify({ error: "Campos inválidos", fields: errors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pega empresa do profile
    const { data: profile } = await supaAdmin.from("profiles").select("empresa_id").eq("id", user.id).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "Usuário sem empresa associada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const insertRow: Record<string, unknown> = {
      empresa_id: empresaId,
      titulo,
      acao,
      problema: draft.problema ?? null,
      comite: draft.comite ?? null,
      area: draft.area ?? null,
      setor: draft.setor ?? null,
      prioridade_normalizada: prioridade,
      data_fim_planejado: dataFim,
      data_inicio_planejado: isISODate(draft.data_inicio_planejado) ? draft.data_inicio_planejado : null,
      responsavel_nome_origem: draft.responsavel_nome ?? null,
      custo_previsto: typeof draft.custo_previsto === "number" ? draft.custo_previsto : 0,
      origem: "copiloto_ia",
      status_normalizado: "nao_iniciada",
      criado_por: user.id,
      atualizado_por: user.id,
    };

    const { data: inserted, error: insErr } = await supaAdmin
      .from("plano_acao")
      .insert(insertRow)
      .select("id")
      .single();

    if (insErr) {
      console.error("insert plano_acao error:", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ id: inserted.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
