// supabase/functions/auth-criar-acesso/index.ts
// Autosserviço: cria o login (CPF + senha) de um colaborador já cadastrado em
// EMPREGADOS, confirmando identidade por CPF + data de nascimento.
// Modos: ADMINISTRATIVO ou ENCARREGADO (encarregado escolhe o contrato).
//
// Depois de criado, o usuário entra pela aba CPF do login (auth-cpf-login,
// que provisiona a conta Supabase Auth no primeiro acesso).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SITUACOES_BLOQUEADAS = ["DEMITIDO", "DEMITIDA", "RESCISAO", "RESCISÃO", "DESLIGADO", "DESLIGADA"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function soDigitos(s: unknown): string { return String(s ?? "").replace(/\D/g, ""); }
function formatarCpf(d: string): string { return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`; }
function dataBRparaNum(d: unknown): number {
  const m = String(d ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(m[3] + m[2] + m[1]) : 0;
}
// Normaliza DD/MM/YYYY ou YYYY-MM-DD -> YYYY-MM-DD (para comparar nascimento).
function normNasc(s: unknown): string {
  const d = String(s ?? "").trim();
  let m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return soDigitos(d);
}
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Confere a senha do modo (ENCARREGADO/ADMINISTRATIVO) contra PASS_MODO_LOGIN.
async function senhaModoConfere(admin: ReturnType<typeof createClient>, modo: string, senha: string): Promise<boolean> {
  const { data } = await admin.from("PASS_MODO_LOGIN").select("senha_hash").eq("modo", modo).maybeSingle();
  if (!data?.senha_hash) return false;
  return (await sha256Hex(senha)) === String(data.senha_hash).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: "Ambiente Supabase não configurado." }, 500);

  try {
    let body: { action?: string; cpf?: string; nascimento?: string; password?: string; tipo?: string; modo_senha?: string; contrato_id?: number | string; contrato_nome?: string };
    try { body = await req.json(); } catch { return jsonResponse({ error: "JSON inválido" }, 400); }

    const tipo = String(body.tipo ?? "").toUpperCase() === "ENCARREGADO" ? "ENCARREGADO" : "ADMINISTRATIVO";
    const modoSenha = String(body.modo_senha ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const modoOk = modoSenha ? await senhaModoConfere(admin, tipo, modoSenha) : false;

    // action "validar_modo": só confere a senha do modo (gate antes do formulário).
    if (body.action === "validar_modo") {
      if (!modoSenha) return jsonResponse({ error: "Informe a senha do modo." }, 400);
      return modoOk ? jsonResponse({ ok: true }) : jsonResponse({ error: "Senha do modo incorreta." }, 401);
    }
    if (!modoOk) return jsonResponse({ error: "Senha do modo incorreta." }, 401);

    const cpf = soDigitos(body.cpf);
    const senha = String(body.password ?? "");
    const nascNorm = normNasc(body.nascimento);

    if (cpf.length !== 11) return jsonResponse({ error: "Informe um CPF válido (11 dígitos)." }, 400);
    if (normNasc(body.nascimento).length < 8) return jsonResponse({ error: "Informe a data de nascimento." }, 400);
    if (senha.length < 6) return jsonResponse({ error: "A senha deve ter ao menos 6 caracteres." }, 400);
    if (tipo === "ENCARREGADO" && !body.contrato_id) return jsonResponse({ error: "Selecione o contrato pelo qual você é responsável." }, 400);

    const { data: rows, error: selErr } = await admin
      .from("EMPREGADOS")
      .select('"ID","Nome","CPF","Nascimento","Senha","Situação","Admissão"')
      .in("CPF", [formatarCpf(cpf), cpf]);
    if (selErr) return jsonResponse({ error: `Erro ao consultar cadastro: ${selErr.message}` }, 500);
    if (!rows || rows.length === 0) {
      return jsonResponse({ error: "CPF não encontrado. O acesso é para colaboradores já cadastrados na empresa." }, 404);
    }

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
    if (normNasc(emp["Nascimento"]) !== nascNorm) {
      return jsonResponse({ error: "CPF e data de nascimento não conferem." }, 401);
    }

    const senhaAtual = String(emp["Senha"] ?? "").trim();
    if (senhaAtual && !["none", "null"].includes(senhaAtual.toLowerCase())) {
      return jsonResponse({ error: "Este CPF já possui acesso. Faça login ou use 'Esqueci minha senha'." }, 409);
    }

    const patch: Record<string, unknown> = {
      "Senha": await sha256Hex(senha),
      tipo_acesso: tipo,
    };
    if (tipo === "ENCARREGADO") {
      patch["Setor_ERP"] = "ENCARREGADO";   // encarregado só enxerga o Início (gating no front)
      patch.contrato_responsavel_id = Number(body.contrato_id) || null;
      patch.contrato_responsavel = body.contrato_nome ?? null;
    }

    const { error: updErr } = await admin.from("EMPREGADOS").update(patch).eq("ID", emp["ID"]);
    if (updErr) return jsonResponse({ error: `Erro ao criar acesso: ${updErr.message}` }, 500);

    return jsonResponse({ ok: true, nome: emp["Nome"] ?? "", cpf: formatarCpf(cpf), tipo });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
