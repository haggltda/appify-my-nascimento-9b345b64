// Edge function: ERP cash export + reference dump for P3.G diagnostics (read-only, service role)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const mode = url.searchParams.get("mode") || "caixa";

  try {
    if (mode === "refs") {
      const [empresas, contaBancaria, contaContabil, saldosIniciais, audPlano] = await Promise.all([
        sb.from("empresas").select("id,codigo,razao_social,nome_fantasia,cnpj,ativa"),
        sb.from("conta_bancaria").select("id,empresa_id,conta_contabil_id,banco_codigo,banco_nome,agencia,conta,digito,tipo,titular,ativa"),
        sb.from("conta_contabil").select("id,empresa_id,conta_reduzida,classificacao,descricao,tipo,natureza,saldo_inicial,ativo").limit(20000),
        sb.from("saldos_iniciais_caixa").select("*").limit(5000),
        sb.from("aud_plano_contas_origem_diagnostico").select("conta_contabil_id,classificacao,descricao,categoria,tem_vinculo_real,pode_inativar_futuro,pode_zerar_saldo_futuro,trava_motivo,saldo_replicado_suspeito,banco_inferido,empresa_inferida_codigo,empresa_banco_inferida").eq("batch_id", "p3d-v33-lf-documentada").limit(20000),
      ]);
      return new Response(JSON.stringify({
        empresas: empresas.data ?? [],
        conta_bancaria: contaBancaria.data ?? [],
        conta_contabil: contaContabil.data ?? [],
        saldos_iniciais_caixa: saldosIniciais.data ?? [],
        aud_plano: audPlano.data ?? [],
        errors: { empresas: empresas.error?.message, contaBancaria: contaBancaria.error?.message, contaContabil: contaContabil.error?.message, saldosIniciais: saldosIniciais.error?.message, audPlano: audPlano.error?.message },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // default: caixa pagination
    const direcao = (url.searchParams.get("direcao") || "ENTRADA").toUpperCase();
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "5000", 10), 10000);
    const tipos = direcao === "ENTRADA" ? ["ENTRADA", "entrada"] : ["SAÍDA", "saida", "SAIDA"];
    const { data, error, count } = await sb
      .from("mz_40_fato_fluxo_caixa_realizado")
      .select("*", { count: "exact" })
      .in("impacta_caixa", ["SIM", "sim"])
      .in("tipo_movimento", tipos)
      .order("mz_id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ count, rows: data, next: (data?.length ?? 0) === limit ? offset + limit : null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
