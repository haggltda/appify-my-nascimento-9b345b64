// Arquivo: supabase/functions/enviar-notificacao-push/index.ts
// Envia Web Push (notificação no celular/navegador) pros usuários ligados a
// uma solicitação (criador, responsável, convidados) quando ela muda de
// etapa. Chamado pelo front-end logo depois de um UPDATE de etapa bem
// sucedido — não confia em título/etapa vindos do corpo da requisição,
// busca tudo direto no banco pelo solicitacao_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@gruponascimento.com.br";

const ETAPA_LABEL: Record<string, string> = {
  solicitacao_demanda: "Solicitação da Demanda",
  triagem_inicial: "Triagem Inicial",
  analise_necessidade: "Análise de Necessidade",
  levantamento_funcional: "Levantamento Funcional",
  documentacao_funcional: "Documentação Funcional",
  analise_tecnica: "Análise Técnica",
  aprovacao_priorizacao: "Aprovação e Priorização",
  desenvolvimento: "Desenvolvimento",
  testes_internos: "Testes Internos",
  homologacao_area_solicitante: "Homologação da Área Solicitante",
  treinamento: "Treinamento",
  implantacao: "Implantação",
  acompanhamento_assistido: "Acompanhamento Assistido",
  encerramento: "Encerramento",
};

interface Body {
  solicitacao_id: string;
  etapa_nova: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonResponse({ error: "Variáveis de ambiente não configuradas (Supabase ou VAPID)." }, 500);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Sessão inválida" }, 401);
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400);
    }

    const solicitacaoId = typeof body.solicitacao_id === "string" ? body.solicitacao_id : "";
    const etapaNova = typeof body.etapa_nova === "string" ? body.etapa_nova : "";
    if (!solicitacaoId || !etapaNova) {
      return jsonResponse({ error: "solicitacao_id e etapa_nova são obrigatórios" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: card, error: cardErr } = await admin
      .from("sistema_solicitacao")
      .select("titulo, criado_por, responsavel_user_id")
      .eq("id", solicitacaoId)
      .maybeSingle();

    if (cardErr) return jsonResponse({ error: cardErr.message }, 500);
    if (!card) return jsonResponse({ error: "Solicitação não encontrada" }, 404);

    const { data: convidados } = await admin
      .from("sistema_solicitacao_convidado")
      .select("user_id")
      .eq("solicitacao_id", solicitacaoId);

    const userIds = new Set<string>();
    if (card.criado_por) userIds.add(card.criado_por as string);
    if (card.responsavel_user_id) userIds.add(card.responsavel_user_id as string);
    for (const c of convidados ?? []) userIds.add((c as { user_id: string }).user_id);

    if (userIds.size === 0) {
      return jsonResponse({ ok: true, enviados: 0, motivo: "Sem usuários ligados ao card" });
    }

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", Array.from(userIds));

    if (subsErr) return jsonResponse({ error: subsErr.message }, 500);
    if (!subs || subs.length === 0) {
      return jsonResponse({ ok: true, enviados: 0, motivo: "Ninguém com notificação ativada" });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const etapaLabel = ETAPA_LABEL[etapaNova] ?? etapaNova;
    const payload = JSON.stringify({
      title: "Card movido",
      body: `O card "${card.titulo}" foi movido para ${etapaLabel}.`,
    });

    let enviados = 0;
    const expirados: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          enviados++;
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) expirados.push(s.id as string);
        }
      }),
    );

    if (expirados.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expirados);
    }

    return jsonResponse({ ok: true, enviados, expirados: expirados.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg }, 500);
  }
});
