import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// CENTRAL DE SERVIÇOS - Denúncias (Canal de Ética / Contato Seguro)
// Espelho local das denúncias ANÔNIMAS da plataforma Contato Seguro.
// A confidencialidade é garantida pela RLS no banco (autoridade final):
// sem papel admin, o select de CS_DENUNCIAS volta vazio. Quem acessa este
// módulo é definido no painel Módulos & Menus (/app/administracao?tab=modulos).
// "Sincronizar agora" chama a edge function sync-denuncias-contato-seguro.
// =====================================================================

interface Denuncia {
  id: number; cs_id: string; protocolo?: string; categoria?: string;
  assunto?: string; relato?: string; status?: string; canal?: string;
  empresa?: string; area?: string; criado_na_origem?: string;
  atualizado_na_origem?: string; sincronizado_em?: string; raw?: Record<string, unknown>;
}

const fmtDt = (s?: string) => { if (!s) return "-"; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
const statusCor = (s?: string): { bg: string; c: string } => {
  const t = (s || "").toLowerCase();
  if (/(conclu|encerr|fechad|resolvid)/.test(t)) return { bg: "#dcfce7", c: "#15803d" };
  if (/(andamento|análise|analise|apura)/.test(t)) return { bg: "#fef9c3", c: "#a16207" };
  if (/(nova|aberta|pendente|recebid)/.test(t)) return { bg: "#fff7ed", c: "#ea580c" };
  return { bg: "#e0f2fe", c: "#0369a1" };
};

export default function Denuncias() {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCat, setFCat] = useState("");
  const [detalhe, setDetalhe] = useState<Denuncia | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);

  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 5000); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("CS_DENUNCIAS").select("*").order("criado_na_origem", { ascending: false, nullsFirst: false }).limit(2000);
    setDenuncias(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-denuncias-contato-seguro", { body: {} });
      if (error) {
        let msg = error.message;
        try { const ctx = await (error as any).context?.json?.(); if (ctx?.msg) msg = ctx.msg; } catch { /* usa error.message */ }
        toast(msg, "err");
      } else {
        toast(data?.msg ?? "Sincronização concluída.", data?.success ? "ok" : "err");
      }
    } catch (e) {
      toast("Erro ao chamar a sincronização: " + (e instanceof Error ? e.message : String(e)), "err");
    }
    setSincronizando(false);
    load();
  };

  const categorias = [...new Set(denuncias.map(d => d.categoria).filter(Boolean))] as string[];
  const statuses = [...new Set(denuncias.map(d => d.status).filter(Boolean))] as string[];
  const filtradas = denuncias.filter(d => {
    if (fStatus && d.status !== fStatus) return false;
    if (fCat && d.categoria !== fCat) return false;
    if (busca) { const q = busca.toLowerCase(); return [d.protocolo, d.assunto, d.relato, d.categoria, d.empresa, d.area].some(x => (x || "").toLowerCase().includes(q)); }
    return true;
  });
  const abertas = denuncias.filter(d => !/(conclu|encerr|fechad|resolvid)/.test((d.status || "").toLowerCase())).length;

  const card = (label: string, valor: number | string, cor: string) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 18px", flex: 1, minWidth: 130, boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor, marginTop: 2 }}>{valor}</div>
    </div>
  );

  // Sem regra de permissão no front: a confidencialidade é garantida pela RLS
  // do banco - para quem não é admin, o select de CS_DENUNCIAS volta vazio.
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <style>{`
        .dn-fi{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:13px;background:#fff;box-sizing:border-box}
        .dn-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 3px rgba(15,49,113,.1)}
        .dn-btn{border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:12px;padding:9px 15px}
        .dn-btn:disabled{opacity:.6;cursor:not-allowed}
        .dn-ov{position:fixed;inset:0;z-index:700;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        .dn-modal{background:#fff;border-radius:16px;padding:22px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 16px 40px rgba(15,23,42,.18)}
        .dn-row:hover{background:#f8fafc}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 16, background: "linear-gradient(135deg,#fff,#fff8f8)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f3171" }}>🛡️ Denúncias - Canal de Ética</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
            Denúncias anônimas da plataforma Contato Seguro. Conteúdo confidencial - acesso definido no painel Módulos & Menus.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="dn-btn" onClick={sincronizar} disabled={sincronizando} style={{ background: "#0f3171", color: "#fff", boxShadow: "0 10px 22px rgba(15,49,113,.18)" }}>
            {sincronizando ? "Sincronizando…" : "⟳ Sincronizar agora"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          {card("Total de denúncias", denuncias.length, "#0f3171")}
          {card("Em aberto", abertas, "#ea580c")}
          {card("Concluídas", denuncias.length - abertas, "#15803d")}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input className="dn-fi" style={{ width: "100%", maxWidth: 380 }} placeholder="🔎 Pesquisar (protocolo, assunto, relato…)" value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="dn-fi" style={{ maxWidth: 190 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Todos os status</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="dn-fi" style={{ maxWidth: 210 }} value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">Todas as categorias</option>{categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? <div style={{ padding: 50, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
          : filtradas.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 46, textAlign: "center", color: "#94a3b8", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              {denuncias.length === 0
                ? <>Nenhuma denúncia sincronizada ainda. Use “Sincronizar agora” - se a integração ainda não estiver liberada pela Contato Seguro, a mensagem de pendência aparece aqui.</>
                : "Nenhuma denúncia encontrada com os filtros atuais."}
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      {["Protocolo", "Data", "Categoria", "Assunto", "Status"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".4px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(d => {
                      const sc = statusCor(d.status);
                      return (
                        <tr key={d.id} className="dn-row" style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setDetalhe(d)}>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f3171", whiteSpace: "nowrap" }}>{d.protocolo || d.cs_id}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#475569" }}>{fmtDt(d.criado_na_origem)}</td>
                          <td style={{ padding: "10px 14px", color: "#475569" }}>{d.categoria || "-"}</td>
                          <td style={{ padding: "10px 14px", color: "#0f172a", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.assunto || (d.relato || "").slice(0, 80) || "-"}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ background: sc.bg, color: sc.c, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 700 }}>{d.status || "-"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>

      {detalhe && (
        <div className="dn-ov" onClick={() => setDetalhe(null)}>
          <div className="dn-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetalhe(null)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>Denúncia {detalhe.protocolo || detalhe.cs_id}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Recebida em {fmtDt(detalhe.criado_na_origem)} · Sincronizada em {fmtDt(detalhe.sincronizado_em)}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {[["Status", detalhe.status], ["Categoria", detalhe.categoria], ["Canal", detalhe.canal], ["Empresa", detalhe.empresa], ["Área", detalhe.area]].map(([k, v]) => v ? (
                <div key={k} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 12px", fontSize: 12 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 700 }}>{k}: </span><span style={{ color: "#0f172a", fontWeight: 600 }}>{v}</span>
                </div>
              ) : null)}
            </div>

            {detalhe.assunto && <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{detalhe.assunto}</div>}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, fontSize: 13.5, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {detalhe.relato || "Sem texto de relato no payload - veja os dados completos abaixo."}
            </div>
            <details style={{ marginTop: 14 }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>Dados completos recebidos da Contato Seguro (JSON)</summary>
              <pre style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 11.5, overflowX: "auto", marginTop: 8 }}>{JSON.stringify(detalhe.raw ?? {}, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 800, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.t === "err" ? "#fee2e2" : t.t === "ok" ? "#dcfce7" : "#e0f2fe", color: t.t === "err" ? "#b91c1c" : t.t === "ok" ? "#15803d" : "#0369a1", border: "1px solid rgba(0,0,0,.06)", borderRadius: 12, padding: "10px 16px", fontSize: 12.5, fontWeight: 600, maxWidth: 420, boxShadow: "0 10px 24px rgba(15,23,42,.15)" }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
