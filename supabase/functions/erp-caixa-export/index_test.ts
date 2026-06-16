// SEG-CAIXA-EXPORT-1 v3 — testes de hardening da Edge Function erp-caixa-export.
// Carrega VITE_SUPABASE_URL/PUBLISHABLE_KEY do .env. Testes que precisam de
// usuários reais são ignorados se as variáveis TEST_* não estiverem definidas.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/erp-caixa-export`;

function call(mode: string, token?: string) {
  const headers: Record<string, string> = { apikey: ANON_KEY };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${FN_URL}?mode=${mode}`, { method: "GET", headers });
}

Deno.test("sem Authorization -> 401", async () => {
  const res = await fetch(`${FN_URL}?mode=refs`, {
    method: "GET",
    headers: { apikey: ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("token invalido -> 401", async () => {
  const res = await call("refs", "abc.invalid.token");
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("anon (apenas apikey) em mode=caixa -> 401", async () => {
  const res = await call("caixa");
  await res.text();
  assertEquals(res.status, 401);
});

async function signIn(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) return null;
  return body.access_token ?? null;
}

const TEST_NOROLE_EMAIL = Deno.env.get("TEST_NOROLE_EMAIL");
const TEST_NOROLE_PASSWORD = Deno.env.get("TEST_NOROLE_PASSWORD");
const TEST_ADMIN_EMAIL = Deno.env.get("TEST_ADMIN_EMAIL");
const TEST_ADMIN_PASSWORD = Deno.env.get("TEST_ADMIN_PASSWORD");
const TEST_SCOPED_EMAIL = Deno.env.get("TEST_SCOPED_EMAIL");
const TEST_SCOPED_PASSWORD = Deno.env.get("TEST_SCOPED_PASSWORD");

Deno.test({
  name: "usuario autenticado sem role permitida -> 403",
  ignore: !(TEST_NOROLE_EMAIL && TEST_NOROLE_PASSWORD),
  fn: async () => {
    const token = await signIn(TEST_NOROLE_EMAIL!, TEST_NOROLE_PASSWORD!);
    assert(token, "login do usuario sem role falhou");
    const res = await call("refs", token!);
    await res.text();
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "admin -> 200 e mode=refs sem campos sensiveis de conta_bancaria",
  ignore: !(TEST_ADMIN_EMAIL && TEST_ADMIN_PASSWORD),
  fn: async () => {
    const token = await signIn(TEST_ADMIN_EMAIL!, TEST_ADMIN_PASSWORD!);
    assert(token, "login admin falhou");
    const res = await call("refs", token!);
    const body = await res.json();
    assertEquals(res.status, 200);
    const cb = body.conta_bancaria ?? [];
    assert(Array.isArray(cb));
    for (const row of cb.slice(0, 50)) {
      assert(!("agencia" in row), "agencia nao deve estar exposta");
      assert(!("conta" in row), "conta nao deve estar exposta");
      assert(!("digito" in row), "digito nao deve estar exposto");
      assert(!("titular" in row), "titular nao deve estar exposto");
    }
  },
});

Deno.test({
  name: "usuario com role mas escopo nao-global -> dados filtrados",
  ignore: !(TEST_SCOPED_EMAIL && TEST_SCOPED_PASSWORD),
  fn: async () => {
    const token = await signIn(TEST_SCOPED_EMAIL!, TEST_SCOPED_PASSWORD!);
    assert(token, "login do usuario escopado falhou");
    const res = await call("refs", token!);
    const body = await res.json();
    assertEquals(res.status, 200);
    assert(body.scope, "payload deve conter scope");
    assertEquals(body.scope.global, false);
    assert(
      typeof body.scope.n_empresas === "number" && body.scope.n_empresas > 0,
    );
    const empresaIds = new Set(
      (body.empresas ?? []).map((e: { id: string }) => e.id),
    );
    for (const cb of body.conta_bancaria ?? []) {
      assert(empresaIds.has(cb.empresa_id), "conta_bancaria fora do escopo");
    }
    for (const cc of body.conta_contabil ?? []) {
      assert(empresaIds.has(cc.empresa_id), "conta_contabil fora do escopo");
    }
  },
});

Deno.test("resposta de erro nao vaza service_role nem JWT", async () => {
  const res = await fetch(`${FN_URL}?mode=refs`, {
    method: "GET",
    headers: { apikey: ANON_KEY },
  });
  const text = await res.text();
  assert(!text.includes("service_role"));
  assert(!text.toLowerCase().includes("bearer "));
  assert(!text.includes("SUPABASE_SERVICE_ROLE_KEY"));
});
