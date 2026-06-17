// supabase/functions/auth-vincular-empregado/index.ts
// Vincula o usuário Supabase Auth logado (por e-mail) ao seu cadastro EMPREGADOS.
// Confirma a identidade por CPF + data de nascimento. Exclui registros demitidos
// e escolhe a admissão mais recente.
//
// action: "buscar"   -> valida cpf+nascimento e devolve o cadastro (preview)
// action: "vincular" -> valida de novo e grava auth_user_id = usuário atual

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

const SITUACOES_BLOQUEADAS = ["DEMITIDO", "DEMITIDA", "RESCISAO", "RESCISÃO", "DESLIGADO", "DESLIGADA"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function soDigitos(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}
function formatarCpf(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function dataBRparaNum(d: unknown): number {
  const m = String(d ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(m[3] + m[2] + m[1]) : 0;
}

function montarPreview(emp: Record<string, unknown>) {
  return {
    id: emp["ID"],
    nome: emp["Nome"] ?? "",
    cargo: emp["Título do Cargo"] ?? "",
    setor: emp["Setor_ERP"] ?? "",
    perfil: emp["Perfil_ERP"] ?? "",
    lider: emp["LIDER"] ?? "",
    situacao: emp["Situação"] ?? "",
    admissao: emp["Admissão"] ?? "",
    empresa: emp["Nome da Empresa"] ?? "",
    filial: emp["Nome Filial"] ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return jsonResponse({ error: "Variáveis de ambiente Supabase não configuradas." }, 500);
  }

  try {
    // Quem está chamando precisa estar autenticado (login por e-mail já feito).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Sessão inválida" }, 401);
    const callerId = userData.user.id;
    const callerEmail = userData.user.email ?? null;

    let body: { action?: string; cpf?: string; nascimento?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400);
    }

    const action = body.action === "vincular" ? "vincular" : "buscar";
    const cpf = soDigitos(body.cpf);
    const nascInput = soDigitos(body.nascimento); // DDMMYYYY
    if (cpf.length !== 11) return jsonResponse({ error: "Informe um CPF válido (11 dígitos)." }, 400);
    if (nascInput.length !== 8) return jsonResponse({ error: "Informe a data de nascimento (DD/MM/AAAA)." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // O usuário já está vinculado a algum cadastro?
    const { data: jaLink } = await admin
      .from("EMPREGADOS")
      .select('"ID","Nome"')
      .eq("auth_user_id", callerId)
      .maybeSingle();
    if (jaLink && action === "vincular") {
      return jsonResponse({ error: "Sua conta já está vinculada a um cadastro." }, 409);
    }

    const { data: rows, error: selErr } = await admin
      .from("EMPREGADOS")
      .select('"ID","Nome","CPF","Nascimento","Situação","Admissão","Título do Cargo","Setor_ERP","Perfil_ERP","LIDER","Nome da Empresa","Nome Filial","email",auth_user_id')
      .in("CPF", [formatarCpf(cpf), cpf]);

    if (selErr) return jsonResponse({ error: `Erro ao consultar cadastro: ${selErr.message}` }, 500);
    if (!rows || rows.length === 0) return jsonResponse({ error: "CPF não encontrado." }, 404);

    // Não-demitidos primeiro, depois admissão mais recente.
    const candidatos = [...rows].sort((a, b) => {
      const aBloq = SITUACOES_BLOQUEADAS.includes(String(a["Situação"] ?? "").toUpperCase()) ? 1 : 0;
      const bBloq = SITUACOES_BLOQUEADAS.includes(String(b["Situação"] ?? "").toUpperCase()) ? 1 : 0;
      if (aBloq !== bBloq) return aBloq - bBloq;
      return dataBRparaNum(b["Admissão"]) - dataBRparaNum(a["Admissão"]);
    });
    const emp = candidatos[0];

    if (SITUACOES_BLOQUEADAS.includes(String(emp["Situação"] ?? "").toUpperCase())) {
      return jsonResponse({ error: "Cadastro consta como desligado. Procure o RH." }, 403);
    }

    // Confere a data de nascimento.
    if (soDigitos(emp["Nascimento"]) !== nascInput) {
      return jsonResponse({ error: "CPF e data de nascimento não conferem." }, 401);
    }

    // Já vinculado a outra pessoa?
    if (emp.auth_user_id && emp.auth_user_id !== callerId) {
      return jsonResponse({ error: "Este cadastro já está vinculado a outro usuário. Procure o RH." }, 409);
    }

    if (action === "buscar") {
      return jsonResponse({ ok: true, ja_vinculado: emp.auth_user_id === callerId, empregado: montarPreview(emp) });
    }

    // action === "vincular": grava o elo (e preenche o e-mail se estiver vazio).
    const patch: Record<string, unknown> = { auth_user_id: callerId };
    if (!String(emp["email"] ?? "").trim() && callerEmail) patch["email"] = callerEmail;

    const { error: updErr } = await admin.from("EMPREGADOS").update(patch).eq("ID", emp["ID"]);
    if (updErr) {
      const dup = /duplicate|unique/i.test(updErr.message);
      return jsonResponse({ error: dup ? "Sua conta já está vinculada a outro cadastro." : updErr.message }, dup ? 409 : 500);
    }

    return jsonResponse({ ok: true, vinculado: true, empregado: montarPreview(emp) });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
