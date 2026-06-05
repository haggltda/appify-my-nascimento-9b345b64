// Edge function: stream cash flow data as JSON pages using service role (bypasses RLS)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const direcao = (url.searchParams.get("direcao") || "ENTRADA").toUpperCase();
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "5000", 10), 10000);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tipos = direcao === "ENTRADA" ? ["ENTRADA", "entrada"] : ["SAÍDA", "saida", "SAIDA"];

  const { data, error, count } = await sb
    .from("mz_40_fato_fluxo_caixa_realizado")
    .select("*", { count: "exact" })
    .in("impacta_caixa", ["SIM", "sim"])
    .in("tipo_movimento", tipos)
    .order("mz_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ count, rows: data, next: (data?.length ?? 0) === limit ? offset + limit : null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
