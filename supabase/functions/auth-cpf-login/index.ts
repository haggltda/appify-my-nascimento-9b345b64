// supabase/functions/auth-cpf-login/index.ts
// Login por CPF contra a tabela EMPREGADOS (senha SHA-256 legada).
// Verifica a senha no servidor (service role), garante um usuário Supabase Auth
// correspondente e devolve um token de magic-link para o front estabelecer a sessão.
//
// Fluxo no client:
//   const { token_hash } = await invoke('auth-cpf-login', { cpf, password })
//   await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Situações que NÃO permitem acesso (espelha SITUACOES_BLOQUEADAS do app legado).
const SITUACOES_BLOQUEADAS = ["DEMITIDO", "DEMITIDA", "RESCISAO", "RESCISÃO", "DESLIGADO", "DESLIGADA"];
const ATIVO_INATIVOS = ["INATIVO", "INATIVA", "0", "NAO", "NÃO", "FALSE", "N", "BLOQUEADO"];

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

// DD/MM/YYYY -> número YYYYMMDD (para ordenar admissão mais recente). 0 se inválido.
function dataBRparaNum(d: unknown): number {
  const m = String(d ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(m[3] + m[2] + m[1]) : 0;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse({ error: "Variáveis de ambiente Supabase não configuradas." }, 500);
  }

  try {
    let body: { cpf?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400);
    }

    const cpf = soDigitos(body.cpf);
    const senha = String(body.password ?? "");
    if (cpf.length !== 11) return jsonResponse({ error: "Informe um CPF válido (11 dígitos)." }, 400);
    if (!senha) return jsonResponse({ error: "Informe a senha." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Busca todos os registros do CPF (formatado e em dígitos).
    const { data: rows, error: selErr } = await admin
      .from("EMPREGADOS")
      .select('"ID","Nome","CPF","Senha","Situação","Admissão","Ativo_ERP","email","Título do Cargo",auth_user_id')
      .in("CPF", [formatarCpf(cpf), cpf]);

    if (selErr) return jsonResponse({ error: `Erro ao consultar cadastro: ${selErr.message}` }, 500);
    if (!rows || rows.length === 0) return jsonResponse({ error: "CPF não encontrado." }, 404);

    // Prioriza: tem senha → não-demitido → admissão mais recente.
    const candidatos = [...rows].sort((a, b) => {
      const aSenha = a["Senha"] ? 0 : 1;
      const bSenha = b["Senha"] ? 0 : 1;
      if (aSenha !== bSenha) return aSenha - bSenha;
      const aBloq = SITUACOES_BLOQUEADAS.includes(String(a["Situação"] ?? "").toUpperCase()) ? 1 : 0;
      const bBloq = SITUACOES_BLOQUEADAS.includes(String(b["Situação"] ?? "").toUpperCase()) ? 1 : 0;
      if (aBloq !== bBloq) return aBloq - bBloq;
      return dataBRparaNum(b["Admissão"]) - dataBRparaNum(a["Admissão"]);
    });
    const emp = candidatos[0];

    const senhaDb = String(emp["Senha"] ?? "").trim();
    if (!senhaDb || ["none", "null"].includes(senhaDb.toLowerCase())) {
      return jsonResponse({ error: "Usuário sem senha cadastrada. Use o login por e-mail ou solicite acesso." }, 403);
    }

    const ativo = String(emp["Ativo_ERP"] ?? "").trim().toUpperCase();
    if (ativo && ATIVO_INATIVOS.includes(ativo)) {
      return jsonResponse({ error: "Acesso bloqueado. Contate o administrador." }, 403);
    }
    if (SITUACOES_BLOQUEADAS.includes(String(emp["Situação"] ?? "").toUpperCase())) {
      return jsonResponse({ error: "Colaborador desligado. Acesso indisponível." }, 403);
    }

    // Verifica a senha (SHA-256 puro, igual ao app legado).
    const senhaOk = senhaDb.length === 64
      ? (await sha256Hex(senha)) === senhaDb.toLowerCase()
      : senha === senhaDb; // texto puro legado
    if (!senhaOk) return jsonResponse({ error: "Senha incorreta." }, 401);

    // Resolve o usuário Supabase Auth correspondente.
    let authEmail: string | null = null;

    if (emp.auth_user_id) {
      const { data: got } = await admin.auth.admin.getUserById(emp.auth_user_id as string);
      authEmail = got?.user?.email ?? null;
    }

    if (!authEmail) {
      // Cria identidade Auth para este colaborador. Usa e-mail real se houver,
      // senão um e-mail sintético determinístico por CPF.
      const emailReal = String(emp["email"] ?? "").trim().toLowerCase();
      authEmail = emailReal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailReal)
        ? emailReal
        : `cpf-${cpf}@cpf.local`;

      const randomPw = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: authEmail,
        password: randomPw,
        email_confirm: true,
        user_metadata: { display_name: emp["Nome"] ?? authEmail, origem: "cpf", cpf },
      });

      let newUserId = created?.user?.id ?? null;
      if (createErr && /already|registered|exists/i.test(createErr.message)) {
        // E-mail já existe no Auth → reaproveita esse usuário.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        newUserId = list?.users?.find((u) => u.email?.toLowerCase() === authEmail)?.id ?? null;
      } else if (createErr) {
        return jsonResponse({ error: `Falha ao provisionar usuário: ${createErr.message}` }, 500);
      }
      if (!newUserId) return jsonResponse({ error: "Não foi possível resolver o usuário." }, 500);

      // profiles + role padrão (acesso a menus é concedido pelo admin no painel).
      await admin.from("profiles").upsert(
        { id: newUserId, email: authEmail, display_name: emp["Nome"] ?? null, ativo: true },
        { onConflict: "id" },
      );
      const { data: perfis } = await admin.from("perfil_metadata").select("role");
      if ((perfis ?? []).some((p: { role: string }) => p.role === "usuario")) {
        await admin.from("user_roles").upsert(
          { user_id: newUserId, role: "usuario" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      }

      // Amarra o cadastro EMPREGADOS a esse usuário.
      await admin.from("EMPREGADOS").update({ auth_user_id: newUserId }).eq("ID", emp["ID"]);
    }

    // Emite token de magic-link para o front estabelecer a sessão.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return jsonResponse({ error: `Falha ao gerar sessão: ${linkErr?.message ?? "sem token"}` }, 500);
    }

    return jsonResponse({
      ok: true,
      token_hash: linkData.properties.hashed_token,
      email: authEmail,
      nome: emp["Nome"] ?? null,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
