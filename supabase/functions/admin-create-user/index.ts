// Edge Function: admin-create-user
// Cria um novo usuário (auth.users + profile + roles + empresa) usando service_role.
// Requer que o chamador esteja autenticado e tenha role 'admin'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Role =
  | "admin" | "controladoria" | "comercial" | "operacional"
  | "juridico" | "sst" | "diretor_adm" | "diretor_op" | "visitante";

const ALLOWED_ROLES: Role[] = [
  "admin","controladoria","comercial","operacional",
  "juridico","sst","diretor_adm","diretor_op","visitante",
];

interface Body {
  email: string;
  password: string;
  display_name?: string | null;
  empresa_id?: string | null;
  roles?: Role[];
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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    // Cliente que valida o JWT do chamador
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Sessão inválida" }, 401);
    }
    const callerId = userData.user.id;

    // Cliente admin (service role) — nunca exposto ao front
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica se o chamador é admin
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr) return jsonResponse({ error: roleErr.message }, 500);
    if (!isAdmin) return jsonResponse({ error: "Apenas administradores podem criar usuários." }, 403);

    // Valida payload
    let body: Body;
    try { body = await req.json(); }
    catch { return jsonResponse({ error: "JSON inválido" }, 400); }

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const display_name = (body.display_name ?? "").trim() || null;
    const empresa_id = body.empresa_id || null;
    const roles = Array.isArray(body.roles) ? body.roles.filter((r) => ALLOWED_ROLES.includes(r)) : [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "E-mail inválido" }, 400);
    }
    if (!password || password.length < 6) {
      return jsonResponse({ error: "Senha deve ter ao menos 6 caracteres" }, 400);
    }

    // Cria o usuário (já confirmado, sem precisar de e-mail)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name ?? email.split("@")[0] },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Falha ao criar usuário";
      const status = /already|registered|exists/i.test(msg) ? 409 : 400;
      return jsonResponse({ error: msg }, status);
    }

    const newUserId = created.user.id;

    // Garante profile (o trigger handle_new_user já deve criar, mas reforçamos os campos)
    const { error: profErr } = await admin
      .from("profiles")
      .upsert({
        id: newUserId,
        email,
        display_name,
        empresa_id,
      }, { onConflict: "id" });
    if (profErr) {
      // rollback: remove usuário criado se profile falhar
      await admin.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: `Erro ao gravar profile: ${profErr.message}` }, 500);
    }

    // Vincula roles
    if (roles.length > 0) {
      const { error: rolesErr } = await admin
        .from("user_roles")
        .insert(roles.map((r) => ({ user_id: newUserId, role: r })));
      if (rolesErr) {
        return jsonResponse({ error: `Usuário criado, mas falhou ao vincular roles: ${rolesErr.message}`, user_id: newUserId }, 207);
      }
    }

    return jsonResponse({ ok: true, user_id: newUserId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg }, 500);
  }
});
