// Arquivo: supabase/functions/enviar-notificacao-push-reuniao/index.ts
// Envia Web Push pros usuários ligados a uma Ata de Reunião (criador,
// responsável pelo preenchimento, convidados) quando ela muda de evento
// (agendada, aguardando resposta, aguardando assinatura, concluída,
// cancelada). Não confia em título/evento vindos do corpo da requisição além
// do necessário pra buscar — o texto da notificação é resolvido aqui a
// partir do banco.
//
// Implementação do Web Push (VAPID + criptografia aes128gcm, RFC 8291/8292)
// idêntica à de enviar-notificacao-push/index.ts — copiada porque os
// helpers são genéricos, não específicos de nenhuma das duas telas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

type Evento = "agendada" | "em_andamento" | "concluida" | "cancelada" | "convidado";

const EVENTO_TEXTO: Record<Evento, (titulo: string) => { title: string; body: string }> = {
  agendada: (t) => ({ title: "Reunião agendada", body: `A reunião "${t}" foi agendada.` }),
  em_andamento: (t) => ({ title: "Reunião iniciada", body: `A reunião "${t}" foi iniciada — acompanhe a pauta.` }),
  concluida: (t) => ({ title: "Ata concluída", body: `A ata da reunião "${t}" foi concluída.` }),
  cancelada: (t) => ({ title: "Reunião cancelada", body: `A reunião "${t}" foi cancelada.` }),
  convidado: (t) => ({ title: "Você foi convidado", body: `Você foi convidado para a reunião "${t}".` }),
};

interface Body {
  reuniao_id: string;
  evento: Evento;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- helpers de base64url / bytes ----------

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlEncode(buf: Uint8Array): string {
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
}

// ---------- VAPID (RFC 8292) ----------

async function importVapidPrivateKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  const pub = base64UrlDecode(publicKeyB64); // 65 bytes: 0x04 || X(32) || Y(32)
  const d = base64UrlDecode(privateKeyB64); // 32 bytes
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(d),
    x: base64UrlEncode(pub.slice(1, 33)),
    y: base64UrlEncode(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function buildVapidAuthHeader(
  endpoint: string,
  subject: string,
  publicKeyB64: string,
  privateKey: CryptoKey,
): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject };
  const te = new TextEncoder();
  const encHeader = base64UrlEncode(te.encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(te.encode(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;
  // Web Crypto ECDSA já assina no formato IEEE P1363 (r||s) — é exatamente o que JWT ES256 exige.
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, te.encode(signingInput));
  const sig = base64UrlEncode(new Uint8Array(sigBuf));
  return `vapid t=${signingInput}.${sig}, k=${publicKeyB64}`;
}

// ---------- criptografia da mensagem (RFC 8291, content-encoding aes128gcm) ----------

async function encryptPayload(payloadBytes: Uint8Array, p256dhB64: string, authB64: string): Promise<Uint8Array> {
  const uaPublicRaw = base64UrlDecode(p256dhB64); // 65 bytes
  const authSecret = base64UrlDecode(authB64); // 16 bytes
  const te = new TextEncoder();

  const uaPublicKey = await crypto.subtle.importKey("raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256),
  );

  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const keyInfo = concatBytes(te.encode("WebPush: info\0"), uaPublicRaw, asPublicRaw);
  const ikm = (await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])))).slice(0, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);

  const cek = (await hmacSha256(prk, concatBytes(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmacSha256(prk, concatBytes(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const padded = concatBytes(payloadBytes, new Uint8Array([2])); // delimitador de registro único/final

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  const rsBuf = new Uint8Array(4);
  new DataView(rsBuf.buffer).setUint32(0, ciphertext.length, false);

  return concatBytes(salt, rsBuf, new Uint8Array([asPublicRaw.length]), asPublicRaw, ciphertext);
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payloadObj: unknown,
  vapidPrivateKey: CryptoKey,
): Promise<{ ok: boolean; status: number }> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const body = await encryptPayload(payloadBytes, subscription.p256dh, subscription.auth);
  const authHeader = await buildVapidAuthHeader(subscription.endpoint, VAPID_SUBJECT, VAPID_PUBLIC_KEY!, vapidPrivateKey);

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: authHeader,
    },
    body,
  });
  return { ok: res.ok, status: res.status };
}

// ---------- handler ----------

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

    const reuniaoId = typeof body.reuniao_id === "string" ? body.reuniao_id : "";
    const evento = body.evento;
    if (!reuniaoId || !evento || !(evento in EVENTO_TEXTO)) {
      return jsonResponse({ error: "reuniao_id e evento (válido) são obrigatórios" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: reuniao, error: reuniaoErr } = await admin
      .from("reuniao")
      .select("titulo, criado_por, responsavel_preenchimento_user_id")
      .eq("id", reuniaoId)
      .maybeSingle();

    if (reuniaoErr) return jsonResponse({ error: reuniaoErr.message }, 500);
    if (!reuniao) return jsonResponse({ error: "Reunião não encontrada" }, 404);

    const { data: convidados } = await admin
      .from("reuniao_convidado")
      .select("user_id")
      .eq("reuniao_id", reuniaoId);

    const userIds = new Set<string>();
    if (reuniao.criado_por) userIds.add(reuniao.criado_por as string);
    if (reuniao.responsavel_preenchimento_user_id) userIds.add(reuniao.responsavel_preenchimento_user_id as string);
    for (const c of convidados ?? []) userIds.add((c as { user_id: string }).user_id);

    if (userIds.size === 0) {
      return jsonResponse({ ok: true, enviados: 0, motivo: "Sem usuários ligados à reunião" });
    }

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", Array.from(userIds));

    if (subsErr) return jsonResponse({ error: subsErr.message }, 500);
    if (!subs || subs.length === 0) {
      return jsonResponse({ ok: true, enviados: 0, motivo: "Ninguém com notificação ativada" });
    }

    const vapidPrivateKey = await importVapidPrivateKey(VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY);
    const payload = EVENTO_TEXTO[evento](reuniao.titulo as string);

    let enviados = 0;
    const expirados: string[] = [];
    const erros: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          const r = await sendWebPush(
            { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
            payload,
            vapidPrivateKey,
          );
          if (r.ok) {
            enviados++;
          } else if (r.status === 404 || r.status === 410) {
            expirados.push(s.id as string);
          } else {
            erros.push(`status ${r.status}`);
          }
        } catch (e) {
          erros.push(e instanceof Error ? e.message : String(e));
        }
      }),
    );

    if (expirados.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expirados);
    }

    return jsonResponse({ ok: true, enviados, expirados: expirados.length, erros });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg }, 500);
  }
});
