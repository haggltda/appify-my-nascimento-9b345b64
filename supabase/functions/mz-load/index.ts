// Edge function: carga chunked do Pacote DO ZERO.
// Cada chamada processa até CHUNK_SIZE linhas a partir de offset.
// Cliente faz loop até finalizou=true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { parse } from "https://deno.land/std@0.224.0/csv/parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHUNK_SIZE = 2000;
const INSERT_BATCH = 500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const arquivo: string = body.arquivo;
    const batchId: string = body.batch_id;
    const offset: number = Number(body.offset ?? 0);
    const append: boolean = Boolean(body.append ?? false);
    if (!arquivo || !batchId) return json({ error: "arquivo e batch_id são obrigatórios" }, 400);

    // Busca controle
    const { data: ctrl, error: ctrlErr } = await admin
      .from("mz_status").select("*").eq("arquivo", arquivo).maybeSingle();
    if (ctrlErr || !ctrl) return json({ error: "Arquivo não cadastrado em mz_status" }, 404);
    if (!ctrl.storage_path) return json({ error: "Arquivo ainda não foi enviado ao Storage" }, 400);

    const tabela: string = ctrl.tabela;

    // Se for offset 0:
    //   - modo normal: zera tudo do batch (recomeça)
    //   - modo append: NÃO apaga, apenas marca EM_ANDAMENTO e preserva linhas_carregadas
    if (offset === 0) {
      if (!append) {
        await admin.from(tabela).delete().eq("migration_batch_id", batchId);
        await admin.from("mz_status").update({
          status: "EM_ANDAMENTO",
          iniciou_em: new Date().toISOString(),
          migration_batch_id: batchId,
          linhas_carregadas: 0,
          ultimo_erro: null,
          updated_at: new Date().toISOString(),
        }).eq("arquivo", arquivo);
      } else {
        await admin.from("mz_status").update({
          status: "EM_ANDAMENTO",
          migration_batch_id: batchId,
          ultimo_erro: null,
          updated_at: new Date().toISOString(),
        }).eq("arquivo", arquivo);
      }
    }

    // Baixa o CSV completo (bucket privado).
    // Para arquivos grandes (>50MB) o download via SDK funciona; memória da edge ~256MB.
    const { data: blob, error: dlErr } = await admin.storage.from("migracao-zero").download(ctrl.storage_path);
    if (dlErr || !blob) return json({ error: `Falha ao baixar storage: ${dlErr?.message}` }, 500);

    // Suporte a .gz: descompacta com DecompressionStream nativo do Deno
    let text: string;
    const isGz = ctrl.storage_path.toLowerCase().endsWith(".gz");
    if (isGz) {
      try {
        const ds = new DecompressionStream("gzip");
        const decompressed = blob.stream().pipeThrough(ds);
        const buf = await new Response(decompressed).arrayBuffer();
        text = new TextDecoder("utf-8").decode(buf);
      } catch (e) {
        return json({ error: `Falha ao descompactar .gz: ${e instanceof Error ? e.message : String(e)}` }, 500);
      }
    } else {
      text = await blob.text();
    }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // remove BOM

    // Parse CSV (delimiter ;). std/csv parse retorna array de objetos quando skipFirstRow=true.
    let rows: Record<string, string>[];
    try {
      rows = parse(text, { separator: ";", skipFirstRow: true, lazyQuotes: true }) as Record<string, string>[];
    } catch (e) {
      return json({ error: `Falha ao parsear CSV: ${e instanceof Error ? e.message : String(e)}` }, 500);
    }

    const total = rows.length;
    const end = Math.min(offset + CHUNK_SIZE, total);
    const slice = rows.slice(offset, end);

    // Normalização: remove BOM, lowercase, troca não-alfanum por _
    const normalize = (k: string) => k.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");

    // Monta linhas para insert
    const toInsert = slice.map((r, i) => {
      const obj: Record<string, unknown> = {
        migration_batch_id: batchId,
        arquivo_origem_carga: arquivo,
        linha_csv: offset + i + 2, // +2 = header + 1-based
      };
      for (const [k, v] of Object.entries(r)) {
        const nk = normalize(k);
        if (!nk) continue;
        obj[nk] = v;
      }
      return obj;
    });

    let inserted = 0;
    let lastError: string | null = null;
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const chunk = toInsert.slice(i, i + INSERT_BATCH);
      const { error } = await admin.from(tabela).insert(chunk);
      if (error) { lastError = error.message; break; }
      inserted += chunk.length;
    }

    const novoTotal = (ctrl.linhas_carregadas ?? 0) + inserted;
    const finalizou = !lastError && end >= total;

    await admin.from("mz_status").update({
      linhas_carregadas: novoTotal,
      status: lastError ? "ERRO" : (finalizou ? "OK" : "EM_ANDAMENTO"),
      ultimo_erro: lastError,
      finalizou_em: finalizou ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("arquivo", arquivo);

    return json({
      ok: !lastError,
      arquivo, tabela,
      total_csv: total,
      offset, processed: inserted, next_offset: end,
      finalizou, error: lastError,
      linhas_carregadas_acumulado: novoTotal,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
