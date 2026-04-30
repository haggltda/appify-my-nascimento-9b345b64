// Edge function: consulta status da NFe na SEFAZ via serviço externo (NFe.io / outro)
// Decisão usuário 2-A: estrutura preparada, integração desligada — ativa quando NFEIO_API_KEY estiver configurado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const nfeioKey = Deno.env.get("NFEIO_API_KEY"); // opcional

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { nf_id } = await req.json();
    if (!nf_id) return json({ error: "nf_id obrigatório" }, 400);

    const { data: nf, error } = await admin
      .from("nf_entrada")
      .select("id, chave_acesso, empresa_id")
      .eq("id", nf_id)
      .single();
    if (error || !nf) return json({ error: "NF não encontrada" }, 404);

    if (!nfeioKey) {
      // Modo "preparado, mas desligado"
      await admin.from("nf_entrada").update({
        sefaz_status: "consulta_indisponivel",
        sefaz_consultado_em: new Date().toISOString(),
      }).eq("id", nf_id);

      await admin.from("nf_entrada_log").insert({
        nf_id, empresa_id: nf.empresa_id,
        evento: "sefaz_consulta_indisponivel",
        detalhes: { motivo: "NFEIO_API_KEY não configurado" },
        user_id: user.id,
      });

      return json({
        ok: false,
        status: "consulta_indisponivel",
        mensagem: "Integração SEFAZ desligada. Configure NFEIO_API_KEY (ou outro serviço) nas secrets para ativar.",
      });
    }

    // Modo "integração real" (placeholder para NFe.io — ajustar endpoint conforme contrato)
    // Documentação: https://nfe.io/docs/api/v1/
    const resp = await fetch(`https://api.nfe.io/v1/nfes/${nf.chave_acesso}`, {
      headers: { "Authorization": nfeioKey },
    });
    const data = await resp.json();

    const status = data?.status ?? "desconhecido";
    await admin.from("nf_entrada").update({
      sefaz_status: status,
      sefaz_consultado_em: new Date().toISOString(),
    }).eq("id", nf_id);

    await admin.from("nf_entrada_log").insert({
      nf_id, empresa_id: nf.empresa_id,
      evento: "sefaz_consultada",
      detalhes: data,
      user_id: user.id,
    });

    return json({ ok: true, status, raw: data });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
