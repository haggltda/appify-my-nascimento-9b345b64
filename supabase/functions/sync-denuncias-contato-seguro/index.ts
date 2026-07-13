import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================================
// SYNC DENÚNCIAS — Contato Seguro → CS_DENUNCIAS
//
// Autentica na API da Contato Seguro (JWT com validade de 1 minuto),
// busca as denúncias e faz upsert por cs_id. Somente admins do ERP
// podem disparar. Escreve com service role (bypassa RLS).
//
// Secrets necessários (supabase secrets set ...):
//   CS_API_KEY          — API Key fornecida pela Contato Seguro
//   CS_API_SECRET       — Secret fornecido pela Contato Seguro
//   CS_BASE_URL         — https://backend.tst.contatoseguro.io/api (TST)
//                         https://backend-portal.contatoseguro.com.br/api (PROD)
//   CS_COMPLAINTS_PATH  — rota de listagem de denúncias (ex.: /complaints)
//
// ATENÇÃO: a key atual do cliente (label "hagg") só tem a aplicação
// "people_bulk". A rota de leitura de denúncias depende de a Contato
// Seguro habilitar a aplicação correspondente e informar o path — até
// lá este sync retorna erro orientando a pendência.
// =====================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Primeiro valor presente entre várias chaves possíveis do payload —
// tolerante a variações de nome até termos a documentação oficial da rota.
const pick = (o: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Caller precisa ser admin do ERP ────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const { data: userData } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  const caller = userData?.user;
  if (!caller) return json(401, { success: false, msg: "Não autenticado." });

  // has_role só tem EXECUTE para authenticated — service role consulta a tabela direto.
  const { data: adminRow } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", caller.id).eq("role", "admin").maybeSingle();
  if (!adminRow) return json(403, { success: false, msg: "Somente administradores podem sincronizar denúncias." });

  const log = async (sucesso: boolean, mensagem: string, tot?: number, novas?: number, atual?: number) => {
    await supabase.from("CS_DENUNCIAS_SYNC_LOG").insert({
      executado_por: caller.id, sucesso, mensagem,
      total_recebidas: tot ?? null, novas: novas ?? null, atualizadas: atual ?? null,
    });
  };

  try {
    // Env secrets têm precedência; sem eles cai no Vault via cs_denuncias_config()
    // (EXECUTE só para service_role) — a conta atual não tem privilégio de org
    // para gravar secrets de function, então os valores vivem no Vault.
    let cfg: Record<string, string> = {};
    if (!Deno.env.get("CS_API_KEY")) {
      const { data: cfgData } = await supabase.rpc("cs_denuncias_config");
      cfg = (cfgData as Record<string, string>) ?? {};
    }
    const apiKey = Deno.env.get("CS_API_KEY") ?? cfg.cs_api_key;
    const apiSecret = Deno.env.get("CS_API_SECRET") ?? cfg.cs_api_secret;
    const baseUrl = (Deno.env.get("CS_BASE_URL") ?? cfg.cs_base_url ?? "").replace(/\/+$/, "");
    const complaintsPath = Deno.env.get("CS_COMPLAINTS_PATH") ?? cfg.cs_complaints_path;

    if (!apiKey || !apiSecret || !baseUrl) {
      const msg = "Credenciais Contato Seguro ausentes (env secrets CS_* ou Vault: cs_api_key / cs_api_secret / cs_base_url).";
      await log(false, msg);
      return json(500, { success: false, msg });
    }
    if (!complaintsPath) {
      const msg = "Rota de denúncias ainda não configurada (CS_COMPLAINTS_PATH / Vault cs_complaints_path). " +
        "Pendência: solicitar à Contato Seguro a liberação da API de leitura de denúncias para a key.";
      await log(false, msg);
      return json(422, { success: false, msg, pendencia: "contato_seguro" });
    }

    // ── Auth na Contato Seguro (JWT expira em 1 minuto) ──────────────
    const authRes = await fetch(`${baseUrl}/auth`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "secret": apiSecret },
    });
    if (!authRes.ok) {
      const msg = `Falha na autenticação Contato Seguro (HTTP ${authRes.status}).`;
      await log(false, msg);
      return json(502, { success: false, msg });
    }
    const authBody = await authRes.json();
    const jwt: string | undefined = authBody?.jwt;
    if (!jwt) {
      const msg = "Autenticação Contato Seguro não retornou JWT.";
      await log(false, msg);
      return json(502, { success: false, msg });
    }

    // ── Busca as denúncias ────────────────────────────────────────────
    const listRes = await fetch(`${baseUrl}${complaintsPath.startsWith("/") ? "" : "/"}${complaintsPath}`, {
      headers: { authorization: jwt },
    });
    if (!listRes.ok) {
      const msg = listRes.status === 404 || listRes.status === 403
        ? `Rota de denúncias indisponível para esta key (HTTP ${listRes.status}). ` +
          "A key atual só tem a aplicação people_bulk — confirmar liberação com a Contato Seguro."
        : `Erro ao buscar denúncias (HTTP ${listRes.status}).`;
      await log(false, msg);
      return json(502, { success: false, msg });
    }
    const listBody = await listRes.json();
    const itens: Record<string, unknown>[] = Array.isArray(listBody)
      ? listBody
      : (listBody?.data ?? listBody?.complaints ?? listBody?.items ?? []);

    // ── Upsert por cs_id ──────────────────────────────────────────────
    let novas = 0, atualizadas = 0;
    const { data: existentes } = await supabase.from("CS_DENUNCIAS").select("cs_id");
    const setExistentes = new Set((existentes ?? []).map((r: { cs_id: string }) => r.cs_id));

    const linhas = itens.map((it) => {
      const csId = pick(it, "id", "uuid", "protocol", "protocolo", "code") ?? crypto.randomUUID();
      setExistentes.has(csId) ? atualizadas++ : novas++;
      return {
        cs_id: csId,
        protocolo: pick(it, "protocol", "protocolo", "code"),
        categoria: pick(it, "category", "categoria", "categoryName"),
        assunto: pick(it, "subject", "assunto", "title", "titulo"),
        relato: pick(it, "report", "relato", "description", "descricao", "text"),
        status: pick(it, "status", "situation", "situacao"),
        canal: pick(it, "channel", "canal", "origin", "origem"),
        empresa: pick(it, "company", "empresa", "companyName"),
        area: pick(it, "area", "department", "setor"),
        criado_na_origem: pick(it, "createdAt", "created_at", "date", "data"),
        atualizado_na_origem: pick(it, "updatedAt", "updated_at"),
        raw: it,
        sincronizado_em: new Date().toISOString(),
      };
    });

    if (linhas.length) {
      const { error: upErr } = await supabase
        .from("CS_DENUNCIAS")
        .upsert(linhas, { onConflict: "cs_id" });
      if (upErr) throw upErr;
    }

    const msg = `Sync OK: ${itens.length} recebidas (${novas} novas, ${atualizadas} atualizadas).`;
    await log(true, msg, itens.length, novas, atualizadas);
    return json(200, { success: true, msg, total: itens.length, novas, atualizadas });
  } catch (e) {
    const msg = `Erro no sync: ${e instanceof Error ? e.message : String(e)}`;
    await log(false, msg);
    return json(500, { success: false, msg });
  }
});
