import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Caixas de envio — só e-mail é automatizado nesta fase; WhatsApp/SMS/protesto/etc
// sempre ficam pra ação manual de alguém, mesmo sem exigir aprovação formal.
const CAIXA_POR_SETOR: Record<string, string | undefined> = {
  financeiro: Deno.env.get("COBRANCA_EMAIL_FINANCEIRO"),
  juridico: Deno.env.get("COBRANCA_EMAIL_JURIDICO"),
};

function renderizar(texto: string | null, vars: Record<string, string>): string {
  if (!texto) return "";
  return texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => vars[chave] ?? "");
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

let tokenCache: { token: string; expiraEm: number } | null = null;

async function obterTokenGraph(): Promise<string> {
  const agora = Date.now();
  if (tokenCache && tokenCache.expiraEm > agora + 30_000) return tokenCache.token;

  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao autenticar no Graph: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiraEm: agora + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function enviarEmailGraph(caixa: string, destinatarios: string[], assunto: string, corpoHtml: string) {
  const token = await obterTokenGraph();
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(caixa)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: assunto,
        body: { contentType: "HTML", content: corpoHtml },
        toRecipients: destinatarios.map((email) => ({ emailAddress: { address: email } })),
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) throw new Error(`Graph sendMail falhou: ${res.status} ${await res.text()}`);
  return { status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resultado = { processadas: 0, enviadas: 0, aguardandoAprovacao: 0, falhas: 0 };

  try {
    const { data: execucoes, error: eExec } = await supabase
      .from("regua_cobranca_execucao")
      .select("id, titulo_id, etapa_id, canal, empresa_id")
      .eq("status", "pendente")
      .lte("agendado_para", new Date().toISOString())
      .limit(200);
    if (eExec) throw eExec;

    for (const exec of execucoes ?? []) {
      resultado.processadas++;
      try {
        const { data: titulo, error: eTit } = await supabase
          .from("titulo_receber")
          .select("id, contrato_id, sacado_nome, numero, valor, data_emissao, data_vencimento, sacado_email")
          .eq("id", exec.titulo_id)
          .maybeSingle();
        if (!titulo) throw new Error("Título não encontrado");

        const { data: etapa } = await supabase
          .from("regua_cobranca_etapa")
          .select("id, canal, template_id, setor_remetente, exige_aprovacao")
          .eq("id", exec.etapa_id)
          .maybeSingle();
        if (!etapa) throw new Error("Etapa não encontrada");

        const { data: template } = await supabase
          .from("template_mensagem")
          .select("assunto, corpo")
          .eq("id", etapa.template_id)
          .maybeSingle();

        let contrato: { numero: string; orgao: string; empresa_id: string } | null = null;
        if (titulo.contrato_id) {
          const { data } = await supabase
            .from("contrato")
            .select("numero, orgao, empresa_id")
            .eq("id", titulo.contrato_id)
            .maybeSingle();
          contrato = data;
        }

        let razaoSocial = "";
        const empresaId = contrato?.empresa_id ?? exec.empresa_id;
        if (empresaId) {
          const { data: emp } = await supabase.from("empresas").select("razao_social").eq("id", empresaId).maybeSingle();
          razaoSocial = emp?.razao_social ?? "";
        }

        const diasAtraso = Math.floor(
          (Date.now() - new Date(titulo.data_vencimento).getTime()) / 86_400_000,
        );

        const vars: Record<string, string> = {
          contrato: contrato?.orgao ?? contrato?.numero ?? titulo.sacado_nome,
          razao_social: razaoSocial,
          numero_documento: titulo.numero,
          valor: fmtMoney(Number(titulo.valor)),
          data_emissao: fmtDate(titulo.data_emissao),
          data_vencimento: fmtDate(titulo.data_vencimento),
          dias_atraso: String(Math.max(diasAtraso, 0)),
        };

        const assuntoRenderizado = renderizar(template?.assunto ?? null, vars);
        const corpoRenderizado = renderizar(template?.corpo ?? null, vars);

        // Destinatário: contrato_email_cobranca (contrato de verdade) > sacado_email do título
        let destinatarios: string[] = [];
        if (titulo.contrato_id) {
          const { data: emails } = await supabase
            .from("contrato_email_cobranca")
            .select("email")
            .eq("contrato_id", titulo.contrato_id);
          destinatarios = (emails ?? []).map((e: any) => e.email).filter(Boolean);
        }
        if (destinatarios.length === 0 && titulo.sacado_email) destinatarios = [titulo.sacado_email];

        const precisaAprovacao = etapa.exige_aprovacao || etapa.canal !== "email";

        if (precisaAprovacao) {
          await supabase
            .from("regua_cobranca_execucao")
            .update({
              status: "aguardando_aprovacao",
              destinatario: destinatarios.join("; ") || null,
              assunto: assuntoRenderizado,
              conteudo: corpoRenderizado,
            })
            .eq("id", exec.id);
          resultado.aguardandoAprovacao++;
          continue;
        }

        if (destinatarios.length === 0) {
          await supabase
            .from("regua_cobranca_execucao")
            .update({ status: "falhou", erro: "Nenhum e-mail de destinatário cadastrado (contrato_email_cobranca / sacado_email)." })
            .eq("id", exec.id);
          resultado.falhas++;
          continue;
        }

        const caixa = CAIXA_POR_SETOR[etapa.setor_remetente ?? "financeiro"];
        if (!caixa) throw new Error(`Caixa de envio não configurada para o setor "${etapa.setor_remetente}"`);

        const respostaGraph = await enviarEmailGraph(caixa, destinatarios, assuntoRenderizado, corpoRenderizado);

        await supabase
          .from("regua_cobranca_execucao")
          .update({
            status: "executada",
            executado_em: new Date().toISOString(),
            destinatario: destinatarios.join("; "),
            assunto: assuntoRenderizado,
            conteudo: corpoRenderizado,
            resposta: respostaGraph,
          })
          .eq("id", exec.id);
        resultado.enviadas++;
      } catch (erroItem: any) {
        console.error("regua-cobranca-tick item error", exec.id, erroItem);
        await supabase
          .from("regua_cobranca_execucao")
          .update({ status: "falhou", erro: String(erroItem?.message ?? erroItem) })
          .eq("id", exec.id);
        resultado.falhas++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("regua-cobranca-tick error", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
