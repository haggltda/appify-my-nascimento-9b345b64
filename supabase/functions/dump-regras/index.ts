import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await sb
    .from("regra_contabilizacao")
    .select(`codigo_evento,evento,descricao,gatilho,impacta_caixa,entra_dre,exige_contrato,exige_centro_custo,requer_pedido,requer_3way_match,prioridade,ativo,centro_custo_padrao,observacao,filtro,conta_debito:conta_debito_id(classificacao,descricao),conta_credito:conta_credito_id(classificacao,descricao)`)
    .order("codigo_evento", { ascending: true, nullsFirst: false })
    .order("prioridade", { ascending: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
});
