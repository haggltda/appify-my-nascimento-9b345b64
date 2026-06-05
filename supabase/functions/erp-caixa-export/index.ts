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
      async function pageAll(table: string, cols: string, filter?: (q: any) => any) {
        const out: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          let q = sb.from(table).select(cols).order("id", { ascending: true }).range(from, from + step - 1);
          if (filter) q = filter(q);
          const { data, error } = await q;
          if (error) throw new Error(`${table}: ${error.message}`);
          if (!data || data.length === 0) break;
          out.push(...data);
          if (data.length < step) break;
          from += step;
        }
        return out;
      }
      const [empresas, contaBancaria, contaContabil, saldosIniciais, audPlano] = await Promise.all([
        pageAll("empresas", "id,codigo,razao_social,nome_fantasia,cnpj,ativa"),
        pageAll("conta_bancaria", "id,empresa_id,conta_contabil_id,banco_codigo,banco_nome,agencia,conta,digito,tipo,titular,ativa"),
        pageAll("conta_contabil", "id,empresa_id,conta_reduzida,classificacao,descricao,tipo,natureza,saldo_inicial,ativo"),
        pageAll("saldos_iniciais_caixa", "*"),
        pageAll("aud_plano_contas_origem_diagnostico", "conta_contabil_id,classificacao,descricao,categoria,tem_vinculo_real,pode_inativar_futuro,pode_zerar_saldo_futuro,trava_motivo,saldo_replicado_suspeito,banco_inferido,empresa_inferida_codigo,empresa_banco_inferida", (q) => q.eq("batch_id", "p3d-v33-lf-documentada")),
      ]);
      return new Response(JSON.stringify({ empresas, conta_bancaria: contaBancaria, conta_contabil: contaContabil, saldos_iniciais_caixa: saldosIniciais, aud_plano: audPlano }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    const got = data?.length ?? 0;
    const hasMore = got > 0 && (got >= 1000 || got >= limit);
    return new Response(JSON.stringify({ count, rows: data, next: hasMore ? offset + got : null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
